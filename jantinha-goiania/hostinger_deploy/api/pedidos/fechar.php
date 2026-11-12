<?php
// hostinger_deploy/api/pedidos/fechar.php
require_once __DIR__ . '/../db.php';

$user = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$id = $_GET['id'] ?? null;
$input = get_json_input();
if (!$id) {
    $id = $input['id'] ?? null;
}

$forma_pagamento = trim($input['forma_pagamento'] ?? '');
$valor_pago      = (float)($input['valor_pago'] ?? 0);

if (!$id || !$forma_pagamento) {
    json_response(['error' => 'Dados de pagamento incompletos'], 400);
}

$pdo = get_db();
try {
    $pdo->beginTransaction();

    $stmtUpd = $pdo->prepare("
        UPDATE pedidos
        SET forma_pagamento = ?, valor_pago = ?, status = 'em_preparo', atualizado_em = NOW()
        WHERE id = ?
    ");
    $stmtUpd->execute([$forma_pagamento, $valor_pago, $id]);

    // Baixa o estoque de todos os itens do pedido
    process_order_stock_reduction($pdo, $id, $user['id']);

    // Busca detalhes do pedido para o fluxo de caixa
    $stmtPed = $pdo->prepare("SELECT valor_total, tipo FROM pedidos WHERE id = ?");
    $stmtPed->execute([$id]);
    $ped = $stmtPed->fetch();

    $catNome = ($ped && $ped['tipo'] === 'mesa') ? 'Venda Mesa' : 'Venda Balcão';
    $stmtCat = $pdo->prepare("SELECT id FROM categorias_financeiro WHERE nome = ? LIMIT 1");
    $stmtCat->execute([$catNome]);
    $cat = $stmtCat->fetch();
    $catId = $cat ? (int)$cat['id'] : 1;

    $valorTotal = $ped ? (float)$ped['valor_total'] : $valor_pago;

    $stmtFluxo = $pdo->prepare("
        INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_pedido_id, data_lancamento, usuario_id, criado_em)
        VALUES (?, 'entrada', ?, ?, ?, ?, CURDATE(), ?, NOW())
    ");
    $stmtFluxo->execute([guidv4(), $catId, $valorTotal, "Venda #" . substr($id, 0, 8), $id, $user['id']]);

    $pdo->commit();

    json_response(['ok' => true]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['error' => $e->getMessage()], 500);
}
