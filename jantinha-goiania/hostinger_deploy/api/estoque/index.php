<?php
// hostinger_deploy/api/estoque/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT
            i.id, i.nome, i.descricao,
            i.estoque_atual, i.estoque_minimo, i.estoque_maximo,
            i.custo_unitario, i.fator_rendimento, i.perecivel, i.validade_dias,
            um.sigla AS unidade, um.nome AS unidade_nome,
            CASE
                WHEN i.estoque_atual = 0                         THEN 'zerado'
                WHEN i.estoque_atual <= i.estoque_minimo         THEN 'critico'
                WHEN i.estoque_atual <= i.estoque_minimo * 1.5   THEN 'baixo'
                ELSE 'ok'
            END AS status_estoque
        FROM insumos i
        JOIN unidades_medida um ON um.id = i.unidade_medida_id
        WHERE i.ativo = 1
        ORDER BY
            CASE
                WHEN i.estoque_atual = 0                       THEN 1
                WHEN i.estoque_atual <= i.estoque_minimo       THEN 2
                WHEN i.estoque_atual <= i.estoque_minimo * 1.5 THEN 3
                ELSE 4
            END, i.nome
    ");
    json_response($stmt->fetchAll());
}

if ($method === 'POST') {
    $user = require_admin();
    $input = get_json_input();

    $insumo_id    = trim($input['insumo_id'] ?? '');
    $quantidade   = (float)($input['quantidade'] ?? 0);
    $custo_total  = (float)($input['custo_total'] ?? 0);
    $fornecedor   = trim($input['fornecedor'] ?? '') ?: null;
    $nota_fiscal  = trim($input['nota_fiscal'] ?? '') ?: null;
    $data_validade = trim($input['data_validade'] ?? '') ?: null;

    if (!$insumo_id || $quantidade <= 0 || $custo_total <= 0) {
        json_response(['error' => 'Dados incompletos ou inválidos'], 400);
    }

    $custo_unitario = $custo_total / $quantidade;
    $loteId = guidv4();

    try {
        $pdo->beginTransaction();

        $stmtLote = $pdo->prepare("
            INSERT INTO lotes_estoque (id, insumo_id, quantidade, custo_total, custo_unitario, data_compra, data_validade, fornecedor, nota_fiscal, usuario_id, criado_em)
            VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, NOW())
        ");
        $stmtLote->execute([$loteId, $insumo_id, $quantidade, $custo_total, $custo_unitario, $data_validade, $fornecedor, $nota_fiscal, $user['id']]);

        $stmtUpd = $pdo->prepare("UPDATE insumos SET estoque_atual = estoque_atual + ?, custo_unitario = ?, atualizado_em = NOW() WHERE id = ?");
        $stmtUpd->execute([$quantidade, $custo_unitario, $insumo_id]);

        $stmtMov = $pdo->prepare("
            INSERT INTO movimentacoes_estoque (id, insumo_id, tipo, quantidade, custo_unitario, referencia_id, referencia_tipo, usuario_id, criado_em)
            VALUES (?, ?, 'entrada', ?, ?, ?, 'lote', ?, NOW())
        ");
        $stmtMov->execute([guidv4(), $insumo_id, $quantidade, $custo_unitario, $loteId, $user['id']]);

        // Categoria de compra
        $stmtCat = $pdo->query("SELECT id FROM categorias_financeiro WHERE nome = 'Compra de Insumos' LIMIT 1");
        $cat = $stmtCat->fetch();
        $catId = $cat ? $cat['id'] : 4;

        $stmtIns = $pdo->prepare("SELECT nome FROM insumos WHERE id = ?");
        $stmtIns->execute([$insumo_id]);
        $insumo = $stmtIns->fetch();
        $insumoNome = $insumo ? $insumo['nome'] : 'Insumo';

        $stmtFluxo = $pdo->prepare("
            INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_lote_id, data_lancamento, usuario_id, criado_em)
            VALUES (?, 'saida', ?, ?, ?, ?, CURDATE(), ?, NOW())
        ");
        $stmtFluxo->execute([guidv4(), $catId, $custo_total, "Compra: {$insumoNome} ({$quantidade} un)", $loteId, $user['id']]);

        // Resolve alertas pendentes desse insumo
        $stmtRes = $pdo->prepare("UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE insumo_id = ? AND resolvido = 0");
        $stmtRes->execute([$insumo_id]);

        $pdo->commit();

        json_response(['ok' => true, 'loteId' => $loteId]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['error' => $e->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    require_admin();
    $id = $_GET['id'] ?? null;
    if (!$id) {
        json_response(['error' => 'ID do insumo é obrigatório'], 400);
    }

    try {
        $stmtIns = $pdo->prepare("SELECT nome FROM insumos WHERE id = ?");
        $stmtIns->execute([$id]);
        $ins = $stmtIns->fetch();
        if (!$ins) {
            json_response(['error' => 'Insumo não encontrado'], 404);
        }

        $pdo->beginTransaction();
        $pdo->prepare("UPDATE insumos SET ativo = 0, atualizado_em = NOW() WHERE id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM ficha_tecnica WHERE insumo_id = ?")->execute([$id]);
        $pdo->prepare("UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE insumo_id = ?")->execute([$id]);
        $pdo->commit();

        json_response(['ok' => true, 'mensagem' => "Insumo \"{$ins['nome']}\" removido do estoque com sucesso!"]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['error' => $e->getMessage()], 500);
    }
}

json_response(['error' => 'Método não permitido'], 405);
