<?php
// hostinger_deploy/api/pedidos/item_status.php
require_once __DIR__ . '/../db.php';

$input = get_json_input();
$itemId = $_GET['itemId'] ?? $input['itemId'] ?? null;
$status = $input['status'] ?? null;

$statusValidos = ['em_preparo', 'pronto', 'entregue', 'cancelado'];
if (!$itemId || !in_array($status, $statusValidos)) {
    json_response(['error' => 'Status ou ID do item inválido'], 400);
}

$pdo = get_db();
try {
    $pdo->prepare("UPDATE itens_pedido SET status_producao = ? WHERE id = ?")->execute([$status, $itemId]);

    if ($status === 'pronto') {
        $stmtItem = $pdo->prepare("SELECT pedido_id FROM itens_pedido WHERE id = ?");
        $stmtItem->execute([$itemId]);
        $item = $stmtItem->fetch();
        if ($item) {
            $stmtPendentes = $pdo->prepare("
                SELECT COUNT(*) as c FROM itens_pedido
                WHERE pedido_id = ? AND status_producao NOT IN ('pronto','entregue','cancelado')
            ");
            $stmtPendentes->execute([$item['pedido_id']]);
            $pend = $stmtPendentes->fetch();
            if ((int)($pend['c'] ?? 0) === 0) {
                $pdo->prepare("UPDATE pedidos SET status = 'pronto', atualizado_em = NOW() WHERE id = ?")->execute([$item['pedido_id']]);
            }
        }
    }

    json_response(['ok' => true]);
} catch (Exception $e) {
    json_response(['error' => $e->getMessage()], 500);
}
