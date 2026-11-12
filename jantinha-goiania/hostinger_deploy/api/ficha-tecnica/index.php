<?php
// hostinger_deploy/api/ficha-tecnica/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $produtoId = $_GET['produto_id'] ?? null;
    if (!$produtoId) {
        json_response(['error' => 'produto_id obrigatório'], 400);
    }
    $stmt = $pdo->prepare("
        SELECT ft.id, ft.insumo_id, i.nome as insumo_nome, ft.quantidade_bruta, ft.observacao
        FROM ficha_tecnica ft
        JOIN insumos i ON i.id = ft.insumo_id
        WHERE ft.produto_id = ?
        ORDER BY ft.ordem
    ");
    $stmt->execute([$produtoId]);
    json_response($stmt->fetchAll());
}

if ($method === 'POST') {
    require_admin();
    $input = get_json_input();
    $produto_id       = trim($input['produto_id'] ?? '');
    $insumo_id        = trim($input['insumo_id'] ?? '');
    $quantidade_bruta = (float)($input['quantidade_bruta'] ?? 0);

    if (!$produto_id || !$insumo_id || $quantidade_bruta <= 0) {
        json_response(['error' => 'produto_id, insumo_id e quantidade_bruta são obrigatórios'], 400);
    }

    $id = guidv4();
    $stmt = $pdo->prepare("
        INSERT INTO ficha_tecnica (id, produto_id, insumo_id, quantidade_bruta, ordem, criado_em)
        VALUES (?, ?, ?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE quantidade_bruta = VALUES(quantidade_bruta)
    ");
    $stmt->execute([$id, $produto_id, $insumo_id, $quantidade_bruta]);

    json_response(['mensagem' => 'Vínculo criado com sucesso'], 201);
}

if ($method === 'DELETE') {
    require_admin();
    $id = $_GET['id'] ?? null;
    if (!$id) {
        json_response(['error' => 'id obrigatório'], 400);
    }
    $stmt = $pdo->prepare("DELETE FROM ficha_tecnica WHERE id = ?");
    $stmt->execute([$id]);
    json_response(['mensagem' => 'Vínculo removido']);
}

json_response(['error' => 'Método não permitido'], 405);
