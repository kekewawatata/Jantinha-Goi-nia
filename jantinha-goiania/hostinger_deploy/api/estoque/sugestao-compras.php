<?php
// hostinger_deploy/api/estoque/sugestao-compras.php
// Calcula sugestão de compras com base no consumo médio dos últimos N dias vs estoque atual.
require_once __DIR__ . '/../db.php';

$pdo = get_db();
require_admin();

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    json_response(['error' => 'Método não permitido'], 405);
}

$dias = isset($_GET['dias']) ? (int)$_GET['dias'] : 7;
if ($dias < 1) $dias = 1;
if ($dias > 30) $dias = 30;

// 1. Insumos ativos
$stmtInsumos = $pdo->query("
    SELECT
      i.id, i.nome,
      i.estoque_atual, i.estoque_minimo, i.estoque_maximo,
      i.custo_unitario,
      um.sigla AS unidade
    FROM insumos i
    JOIN unidades_medida um ON um.id = i.unidade_medida_id
    WHERE i.ativo = 1
    ORDER BY i.nome
");
$insumos = $stmtInsumos->fetchAll();

// 2. Consumo real dos últimos N dias (somente saída por venda)
$stmtConsumo = $pdo->prepare("
    SELECT
      insumo_id,
      SUM(quantidade) AS total_consumido
    FROM movimentacoes_estoque
    WHERE tipo = 'saida_venda'
      AND criado_em >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY insumo_id
");
$stmtConsumo->execute([$dias]);
$consumoRows = $stmtConsumo->fetchAll();

$consumoMap = [];
foreach ($consumoRows as $r) {
    $consumoMap[$r['insumo_id']] = (float)$r['total_consumido'];
}

$sugestoes = [];

foreach ($insumos as $ins) {
    $insId          = (string)$ins['id'];
    $estoqueAtual   = (float)$ins['estoque_atual'];
    $estoqueMinimo  = (float)$ins['estoque_minimo'];
    $estoqueMaximo  = $ins['estoque_maximo'] !== null ? (float)$ins['estoque_maximo'] : null;
    $custoUnitario  = (float)$ins['custo_unitario'];

    $totalConsumido  = $consumoMap[$insId] ?? 0.0;
    $consumoMedioDia = $totalConsumido / $dias;

    $diasRestantes = $consumoMedioDia > 0
        ? (int)floor($estoqueAtual / $consumoMedioDia)
        : null;

    $metaEstoque = $estoqueMaximo !== null
        ? $estoqueMaximo
        : max($estoqueMinimo * 3, $estoqueMinimo + ($consumoMedioDia * $dias));

    $quantidadeSugerida = (int)max(0, ceil($metaEstoque - $estoqueAtual));

    if ($quantidadeSugerida <= 0 && $estoqueAtual > $estoqueMinimo) {
        continue;
    }

    if ($estoqueAtual == 0 || ($diasRestantes !== null && $diasRestantes <= 1)) {
        $urgencia = 'critico';
    } elseif ($estoqueAtual <= $estoqueMinimo || ($diasRestantes !== null && $diasRestantes <= 3)) {
        $urgencia = 'alto';
    } elseif ($diasRestantes !== null && $diasRestantes <= 7) {
        $urgencia = 'medio';
    } else {
        $urgencia = 'baixo';
    }

    $custoEstimado = round($quantidadeSugerida * $custoUnitario, 2);

    $sugestoes[] = [
        'id'                  => $insId,
        'nome'                => $ins['nome'],
        'unidade'             => $ins['unidade'],
        'estoque_atual'       => round($estoqueAtual),
        'estoque_minimo'      => round($estoqueMinimo),
        'custo_unitario'      => $custoUnitario,
        'consumo_medio_dia'   => round($consumoMedioDia, 1),
        'dias_restantes'      => $diasRestantes,
        'quantidade_sugerida' => $quantidadeSugerida,
        'custo_estimado'      => $custoEstimado,
        'urgencia'            => $urgencia,
    ];
}

$ordemUrgencia = ['critico' => 0, 'alto' => 1, 'medio' => 2, 'baixo' => 3];
usort($sugestoes, function($a, $b) use ($ordemUrgencia) {
    $diff = $ordemUrgencia[$a['urgencia']] - $ordemUrgencia[$b['urgencia']];
    if ($diff !== 0) return $diff;
    $da = $a['dias_restantes'] ?? 9999;
    $db = $b['dias_restantes'] ?? 9999;
    return $da - $db;
});

$totalEstimado = 0;
foreach ($sugestoes as $s) {
    $totalEstimado += $s['custo_estimado'];
}

json_response([
    'periodo_dias'   => $dias,
    'total_estimado' => round($totalEstimado, 2),
    'itens'          => $sugestoes,
]);
