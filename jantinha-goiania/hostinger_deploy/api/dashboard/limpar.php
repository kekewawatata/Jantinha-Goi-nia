<?php
// hostinger_deploy/api/dashboard/limpar.php
require_once __DIR__ . '/../db.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$pdo = get_db();

try {
    $pdo->beginTransaction();

    // 1. Limpa movimentações de estoque vinculadas a pedidos
    $pdo->exec("DELETE FROM movimentacoes_estoque WHERE referencia_tipo = 'pedido'");

    // 2. Limpa alertas
    $pdo->exec("DELETE FROM alertas_estoque");

    // 3. Limpa fluxo de caixa de pedidos
    $pdo->exec("
        DELETE FROM fluxo_caixa 
        WHERE referencia_pedido_id IS NOT NULL 
           OR categoria_id IN (SELECT id FROM categorias_financeiro WHERE nome IN ('Venda Balcão', 'Venda Mesa'))
    ");
    $pdo->exec("UPDATE fluxo_caixa SET referencia_pedido_id = NULL WHERE referencia_pedido_id IS NOT NULL");

    // 4. Limpa itens de pedidos
    $pdo->exec("DELETE FROM itens_pedido");

    // 5. Limpa pedidos
    $pdo->exec("DELETE FROM pedidos");

    // 6. Reseta sequência para 0
    $pdo->exec("UPDATE pedido_seq SET seq = 0 WHERE id = 1");

    $pdo->commit();

    json_response([
        'ok'       => true,
        'mensagem' => 'Histórico de pedidos e vendas do Dashboard limpo com sucesso! A sequência recomeçará do #1.',
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(['error' => $e->getMessage()], 500);
}
