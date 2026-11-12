<?php
// hostinger_deploy/api/financeiro/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $inicio = $_GET['inicio'] ?? date('Y-m-01');
    $fim    = $_GET['fim']    ?? date('Y-m-d');

    // 1. Lançamentos no período
    $stmtLanc = $pdo->prepare("
        SELECT fc.id, fc.tipo, fc.valor, fc.descricao, fc.data_lancamento, fc.criado_em,
               cf.nome as categoria, cf.icone as categoria_icone,
               u.nome as usuario_nome
        FROM fluxo_caixa fc
        JOIN categorias_financeiro cf ON cf.id = fc.categoria_id
        LEFT JOIN usuarios u ON u.id = fc.usuario_id
        WHERE fc.data_lancamento BETWEEN ? AND ?
        ORDER BY fc.criado_em DESC
        LIMIT 200
    ");
    $stmtLanc->execute([$inicio, $fim]);
    $lancamentos = $stmtLanc->fetchAll();

    // 2. Resumo de entradas e saídas
    $stmtResumo = $pdo->prepare("
        SELECT tipo, ROUND(COALESCE(SUM(valor), 0), 2) as total
        FROM fluxo_caixa
        WHERE data_lancamento BETWEEN ? AND ?
        GROUP BY tipo
    ");
    $stmtResumo->execute([$inicio, $fim]);
    $resumoRows = $stmtResumo->fetchAll();

    $resumo = [
        ['tipo' => 'entrada', 'total' => 0],
        ['tipo' => 'saida',   'total' => 0],
    ];
    foreach ($resumoRows as $r) {
        if ($r['tipo'] === 'entrada') $resumo[0]['total'] = (float)$r['total'];
        if ($r['tipo'] === 'saida')   $resumo[1]['total'] = (float)$r['total'];
    }

    // 3. Totais agrupados por categoria
    $stmtPorCat = $pdo->prepare("
        SELECT cf.nome as categoria, cf.icone, cf.tipo, ROUND(SUM(fc.valor), 2) as total
        FROM fluxo_caixa fc
        JOIN categorias_financeiro cf ON cf.id = fc.categoria_id
        WHERE fc.data_lancamento BETWEEN ? AND ?
        GROUP BY cf.id, cf.nome, cf.icone, cf.tipo
        ORDER BY total DESC
    ");
    $stmtPorCat->execute([$inicio, $fim]);
    $porCategoria = $stmtPorCat->fetchAll();

    json_response([
        'resumo'       => $resumo,
        'lancamentos'  => $lancamentos ?: [],
        'porCategoria' => $porCategoria ?: [],
    ]);
}

if ($method === 'POST') {
    $user = require_admin();
    $input = get_json_input();

    $categoria_id = (int)($input['categoria_id'] ?? 0);
    $valor        = (float)($input['valor'] ?? 0);
    $descricao    = trim($input['descricao'] ?? '');

    if (!$categoria_id || $valor <= 0 || !$descricao) {
        json_response(['error' => 'Dados incompletos'], 400);
    }

    $stmtCat = $pdo->prepare("SELECT tipo FROM categorias_financeiro WHERE id = ?");
    $stmtCat->execute([$categoria_id]);
    $cat = $stmtCat->fetch();
    $tipo = $cat ? $cat['tipo'] : 'saida';

    $stmt = $pdo->prepare("
        INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, data_lancamento, usuario_id, criado_em)
        VALUES (?, ?, ?, ?, ?, CURDATE(), ?, NOW())
    ");
    $stmt->execute([guidv4(), $tipo, $categoria_id, $valor, $descricao, $user['id']]);

    json_response(['ok' => true]);
}

json_response(['error' => 'Método não permitido'], 405);
