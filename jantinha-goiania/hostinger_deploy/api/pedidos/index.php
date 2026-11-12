<?php
// hostinger_deploy/api/pedidos/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = $_GET['status'] ?? 'aberto,em_preparo,pronto';
    $destino = $_GET['destino'] ?? null;
    $mesa = $_GET['mesa'] ?? null;

    $statusValidos = ['aberto', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
    $statusArray = array_filter(array_map('trim', explode(',', $status)), function($s) use ($statusValidos) {
        return in_array($s, $statusValidos);
    });

    if (empty($statusArray)) {
        json_response([]);
    }

    $inPlaceholders = implode(',', array_fill(0, count($statusArray), '?'));

    $sql = "
        SELECT
            p.id, p.numero, p.tipo, p.mesa_numero, p.status,
            p.valor_total, p.valor_pago, p.forma_pagamento, p.observacao, p.criado_em,
            JSON_ARRAYAGG(JSON_OBJECT(
                'id',                     ip.id,
                'produto_id',             ip.produto_id,
                'produto_nome',           pr.nome,
                'categoria',              cp.nome,
                'quantidade',             ip.quantidade,
                'preco_unitario',         ip.preco_unitario,
                'status_producao',        ip.status_producao,
                'destino_producao',       ip.destino_producao,
                'espetinho_escolhido_id', ip.espetinho_escolhido_id,
                'espetinho_nome',         esp.nome,
                'observacao_item',        ip.observacao_item
            )) as itens
        FROM pedidos p
        JOIN itens_pedido ip ON ip.pedido_id = p.id
        JOIN produtos pr      ON pr.id = ip.produto_id
        JOIN categorias_produto cp ON cp.id = pr.categoria_id
        LEFT JOIN produtos esp ON esp.id = ip.espetinho_escolhido_id
        WHERE p.status IN ($inPlaceholders)
    ";
    $params = array_values($statusArray);

    if ($mesa) {
        $sql .= " AND p.mesa_numero = ?";
        $params[] = $mesa;
    }

    if ($destino) {
        $sql .= " AND ip.destino_producao = ?";
        $params[] = $destino;
    }

    $sql .= " GROUP BY p.id ORDER BY p.criado_em ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $pedidos = array_map(function($r) {
        $itens = $r['itens'];
        if (is_string($itens)) {
            $itens = json_decode($itens, true) ?: [];
        }
        $r['itens'] = $itens ?: [];
        return $r;
    }, $rows);

    json_response($pedidos);
}

if ($method === 'POST') {
    $user = require_auth();
    $input = get_json_input();

    $tipo        = $input['tipo'] ?? 'mesa';
    $itens       = $input['itens'] ?? [];
    $mesa_numero = trim($input['mesa_numero'] ?? '') ?: null;
    $observacao  = trim($input['observacao'] ?? '') ?: null;

    if (empty($itens)) {
        json_response(['error' => 'Pedido sem itens'], 400);
    }

    foreach ($itens as &$item) {
        if (empty($item['produto_id'])) {
            json_response(['error' => 'Item inválido: produto_id ausente.'], 400);
        }
        if (empty($item['quantidade']) || (int)$item['quantidade'] <= 0) {
            json_response(['error' => 'Item inválido: quantidade inválida.'], 400);
        }
        if (empty($item['destino_producao'])) {
            $item['destino_producao'] = 'balcao';
        }
    }
    unset($item);

    try {
        $pdo->beginTransaction();

        $valorNovosItens = 0;
        foreach ($itens as $i) {
            $valorNovosItens += (float)$i['preco_unitario'] * (int)$i['quantidade'];
        }

        // Verifica se é atendimento de mesa e se essa mesa já tem uma comanda ativa/aberta
        $pedidoExistente = null;
        if ($mesa_numero && strtolower($mesa_numero) !== 'balcão' && strtolower($mesa_numero) !== 'balcao') {
            $stmtBusca = $pdo->prepare("
                SELECT id, numero, valor_total
                FROM pedidos
                WHERE mesa_numero = ? AND status IN ('aberto', 'em_preparo', 'pronto')
                ORDER BY criado_em DESC
                LIMIT 1
            ");
            $stmtBusca->execute([$mesa_numero]);
            $pedidoExistente = $stmtBusca->fetch();
        }

        if ($pedidoExistente) {
            // ── ACRÉSCIMO DE ITENS NA MESA OCUPADA EXISTENTE ──
            $pedidoId = $pedidoExistente['id'];
            $seq = (int)$pedidoExistente['numero'];
            $novoTotal = (float)$pedidoExistente['valor_total'] + $valorNovosItens;

            $stmtUpd = $pdo->prepare("
                UPDATE pedidos
                SET valor_total = ?, atualizado_em = NOW()
                WHERE id = ?
            ");
            $stmtUpd->execute([$novoTotal, $pedidoId]);
        } else {
            // ── NOVO PEDIDO / NOVA MESA OCUPADA ──
            $pdo->exec("UPDATE pedido_seq SET seq = seq + 1 WHERE id = 1");
            $stmtSeq = $pdo->query("SELECT seq FROM pedido_seq WHERE id = 1");
            $seq = (int)($stmtSeq->fetch()['seq'] ?? 1);

            $pedidoId = guidv4();
            $novoTotal = $valorNovosItens;

            $stmtPed = $pdo->prepare("
                INSERT INTO pedidos (id, numero, tipo, mesa_numero, status, valor_total, usuario_caixa_id, observacao, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, 'em_preparo', ?, ?, ?, NOW(), NOW())
            ");
            $stmtPed->execute([$pedidoId, $seq, $tipo, $mesa_numero, $novoTotal, $user['id'], $observacao]);
        }

        // Insere os novos itens do pedido
        $stmtItem = $pdo->prepare("
            INSERT INTO itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, espetinho_escolhido_id, observacao_item, status_producao, destino_producao, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");

        foreach ($itens as $item) {
            $statusInicial = $item['destino_producao'] === 'balcao' ? 'pronto' : 'aguardando';
            $stmtItem->execute([
                guidv4(),
                $pedidoId,
                $item['produto_id'],
                (int)$item['quantidade'],
                (float)$item['preco_unitario'],
                $item['espetinho_escolhido_id'] ?? null,
                $item['observacao_item'] ?? null,
                $statusInicial,
                $item['destino_producao'],
            ]);
        }

        $pdo->commit();

        json_response([
            'pedidoId'   => $pedidoId,
            'numero'     => $seq,
            'valorTotal' => $novoTotal,
            'acrescentado' => ($pedidoExistente !== null),
        ], 201);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['error' => $e->getMessage()], 500);
    }
}

json_response(['error' => 'Método não permitido'], 405);
