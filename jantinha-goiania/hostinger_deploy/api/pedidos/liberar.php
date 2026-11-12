<?php
// hostinger_deploy/api/pedidos/liberar.php
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
$mesa_numero = trim($input['mesa_numero'] ?? '');
$forma_pagamento = trim($input['forma_pagamento'] ?? 'dinheiro');
$valor_pago = (float)($input['valor_pago'] ?? 0);

$pdo = get_db();

try {
    $pdo->beginTransaction();

    // Se passou mesa_numero mas não id, busca o pedido ativo da mesa
    if (!$id && $mesa_numero) {
        $stmtBusca = $pdo->prepare("
            SELECT id, valor_total, forma_pagamento
            FROM pedidos
            WHERE mesa_numero = ? AND status IN ('aberto', 'em_preparo', 'pronto')
            ORDER BY criado_em DESC
            LIMIT 1
        ");
        $stmtBusca->execute([$mesa_numero]);
        $row = $stmtBusca->fetch();
        if (!$row) {
            $pdo->rollBack();
            json_response(['error' => 'Nenhum pedido ativo encontrado para a mesa ' . $mesa_numero], 404);
        }
        $id = $row['id'];
    }

    if (!$id) {
        $pdo->rollBack();
        json_response(['error' => 'Identificador do pedido ou mesa não informado'], 400);
    }

    // Busca dados do pedido
    $stmtPed = $pdo->prepare("SELECT id, numero, tipo, mesa_numero, valor_total, forma_pagamento FROM pedidos WHERE id = ?");
    $stmtPed->execute([$id]);
    $ped = $stmtPed->fetch();

    if (!$ped) {
        $pdo->rollBack();
        json_response(['error' => 'Pedido não encontrado'], 404);
    }

    $valorTotal = (float)$ped['valor_total'];
    if ($valor_pago <= 0) {
        $valor_pago = $valorTotal;
    }
    if (!$forma_pagamento && !empty($ped['forma_pagamento'])) {
        $forma_pagamento = $ped['forma_pagamento'];
    }
    if (!$forma_pagamento) {
        $forma_pagamento = 'dinheiro';
    }

    // Atualiza status do pedido para 'entregue' (finalizado)
    $stmtUpd = $pdo->prepare("
        UPDATE pedidos
        SET status = 'entregue',
            forma_pagamento = ?,
            valor_pago = ?,
            entregue_em = NOW(),
            atualizado_em = NOW()
        WHERE id = ?
    ");
    $stmtUpd->execute([$forma_pagamento, $valor_pago, $id]);

    // Atualiza todos os itens do pedido para entregue
    $pdo->prepare("
        UPDATE itens_pedido
        SET status_producao = 'entregue'
        WHERE pedido_id = ? AND status_producao != 'cancelado'
    ")->execute([$id]);

    // Baixa do estoque de todos os insumos dos itens deste pedido
    process_order_stock_reduction($pdo, $id, $user['id']);

    // Registra entrada no fluxo de caixa se ainda não registrado
    $stmtCheckFluxo = $pdo->prepare("SELECT id FROM fluxo_caixa WHERE referencia_pedido_id = ?");
    $stmtCheckFluxo->execute([$id]);
    if (!$stmtCheckFluxo->fetch()) {
        $catNome = ($ped['tipo'] === 'mesa') ? 'Venda Mesa' : 'Venda Balcão';
        $stmtCat = $pdo->prepare("SELECT id FROM categorias_financeiro WHERE nome = ? LIMIT 1");
        $stmtCat->execute([$catNome]);
        $cat = $stmtCat->fetch();
        $catId = $cat ? (int)$cat['id'] : 2;

        $stmtFluxo = $pdo->prepare("
            INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_pedido_id, data_lancamento, usuario_id, criado_em)
            VALUES (?, 'entrada', ?, ?, ?, ?, CURDATE(), ?, NOW())
        ");
        $stmtFluxo->execute([guidv4(), $catId, $valorTotal, "Mesa " . ($ped['mesa_numero'] ?? '') . " - Pedido #" . $ped['numero'], $id, $user['id']]);
    }

    $pdo->commit();

    json_response([
        'ok' => true,
        'mensagem' => 'Mesa liberada e conta fechada com sucesso!',
        'pedidoId' => $id,
        'valorTotal' => $valorTotal,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['error' => $e->getMessage()], 500);
}
