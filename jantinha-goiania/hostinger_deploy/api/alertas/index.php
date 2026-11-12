<?php
// hostinger_deploy/api/alertas/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT ae.id, ae.tipo_alerta, ae.mensagem, ae.criado_em,
               i.nome as insumo_nome, i.estoque_atual, i.estoque_minimo
        FROM alertas_estoque ae
        JOIN insumos i ON i.id = ae.insumo_id
        WHERE ae.resolvido = 0
        ORDER BY ae.criado_em DESC
    ");
    json_response($stmt->fetchAll());
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        json_response(['error' => 'id obrigatório'], 400);
    }
    $stmt = $pdo->prepare("UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    json_response(['ok' => true]);
}

json_response(['error' => 'Método não permitido'], 405);
