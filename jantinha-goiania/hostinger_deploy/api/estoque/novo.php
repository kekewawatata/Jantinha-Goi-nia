<?php
// hostinger_deploy/api/estoque/novo.php
require_once __DIR__ . '/../db.php';

$user = require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$input = get_json_input();
$nome           = trim($input['nome'] ?? '');
$quantidade     = (float)($input['quantidade'] ?? 0);
$custo_total    = (float)($input['custo_total'] ?? 0);
$estoque_minimo = (float)($input['estoque_minimo'] ?? 5);
$perecivel      = !empty($input['perecivel']) ? 1 : 0;
$validade_dias  = !empty($input['validade_dias']) ? (int)$input['validade_dias'] : null;
$data_validade  = trim($input['data_validade'] ?? '') ?: null;
$fornecedor     = trim($input['fornecedor'] ?? '') ?: null;
$nota_fiscal    = trim($input['nota_fiscal'] ?? '') ?: null;

if (!$nome || $quantidade <= 0 || $custo_total === null) {
    json_response(['error' => 'Nome, quantidade em unidades e custo total são obrigatórios.'], 400);
}

$custo_unitario = $custo_total > 0 ? $custo_total / $quantidade : 0;
$insumoId = guidv4();
$loteId = guidv4();
$pdo = get_db();

try {
    $pdo->beginTransaction();

    // 1. Obter id da unidade 'un'
    $stmtUn = $pdo->query("SELECT id FROM unidades_medida WHERE sigla = 'un' LIMIT 1");
    $un = $stmtUn->fetch();
    if (!$un) {
        $pdo->exec("INSERT IGNORE INTO unidades_medida (sigla, nome) VALUES ('un', 'Unidade')");
        $stmtUn = $pdo->query("SELECT id FROM unidades_medida WHERE sigla = 'un' LIMIT 1");
        $un = $stmtUn->fetch();
    }
    $unidadeId = $un ? (int)$un['id'] : 1;

    // 2. Inserir insumo
    $stmtIns = $pdo->prepare("
        INSERT INTO insumos (id, nome, unidade_medida_id, custo_unitario, estoque_atual, estoque_minimo, fator_rendimento, perecivel, validade_dias, ativo, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, 1.0, ?, ?, 1, NOW(), NOW())
    ");
    $stmtIns->execute([$insumoId, $nome, $unidadeId, $custo_unitario, $quantidade, $estoque_minimo, $perecivel, $validade_dias]);

    // 3. Registrar lote de entrada
    $stmtLote = $pdo->prepare("
        INSERT INTO lotes_estoque (id, insumo_id, quantidade, custo_total, custo_unitario, data_compra, data_validade, fornecedor, nota_fiscal, usuario_id, criado_em)
        VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, NOW())
    ");
    $stmtLote->execute([$loteId, $insumoId, $quantidade, $custo_total, $custo_unitario, $data_validade, $fornecedor, $nota_fiscal, $user['id']]);

    // 4. Registrar movimentação
    $stmtMov = $pdo->prepare("
        INSERT INTO movimentacoes_estoque (id, insumo_id, tipo, quantidade, custo_unitario, referencia_id, referencia_tipo, observacao, usuario_id, criado_em)
        VALUES (?, ?, 'entrada', ?, ?, ?, 'lote', 'Cadastro inicial de estoque', ?, NOW())
    ");
    $stmtMov->execute([guidv4(), $insumoId, $quantidade, $custo_unitario, $loteId, $user['id']]);

    // 5. Lançar despesa no financeiro
    if ($custo_total > 0) {
        $stmtCat = $pdo->query("SELECT id FROM categorias_financeiro WHERE nome = 'Compra de Insumos' LIMIT 1");
        $cat = $stmtCat->fetch();
        $categoriaId = $cat ? (int)$cat['id'] : 4;

        $stmtFluxo = $pdo->prepare("
            INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_lote_id, data_lancamento, usuario_id, criado_em)
            VALUES (?, 'saida', ?, ?, ?, ?, CURDATE(), ?, NOW())
        ");
        $stmtFluxo->execute([guidv4(), $categoriaId, $custo_total, "Compra de Produto: {$nome} ({$quantidade} un)", $loteId, $user['id']]);
    }

    $pdo->commit();

    json_response([
        'ok'       => true,
        'mensagem' => "Produto \"{$nome}\" adicionado com sucesso! Despesa de R$ " . number_format($custo_total, 2, ',', '.') . " contabilizada.",
        'insumoId' => $insumoId,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['error' => $e->getMessage()], 500);
}
