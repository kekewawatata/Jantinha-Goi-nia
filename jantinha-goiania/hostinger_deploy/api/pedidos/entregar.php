<?php
// hostinger_deploy/api/pedidos/entregar.php
require_once __DIR__ . '/../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$id = $_GET['id'] ?? null;
if (!$id) {
    // Tenta pegar do corpo ou da URL reescrita
    $input = get_json_input();
    $id = $input['id'] ?? null;
}

if (!$id) {
    json_response(['error' => 'ID do pedido é obrigatório'], 400);
}

$pdo = get_db();
try {
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE pedidos SET status = 'entregue', entregue_em = NOW(), atualizado_em = NOW() WHERE id = ?")->execute([$id]);
    $pdo->prepare("UPDATE itens_pedido SET status_producao = 'entregue' WHERE pedido_id = ? AND status_producao != 'cancelado'")->execute([$id]);
    $pdo->commit();

    json_response(['ok' => true, 'mensagem' => 'Pedido marcado como entregue com sucesso!']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['error' => $e->getMessage()], 500);
}
