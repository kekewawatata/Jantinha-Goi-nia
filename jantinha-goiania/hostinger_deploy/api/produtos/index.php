<?php
// hostinger_deploy/api/produtos/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $categoria = $_GET['categoria'] ?? null;
    $disponivelOnly = ($_GET['disponivel'] ?? 'true') !== 'false';

    $sql = "
        SELECT p.id, p.nome, p.descricao, p.preco_venda, p.preco_custo,
               p.disponivel, p.destino_producao, p.permite_adicional,
               cp.nome as categoria, cp.icone as categoria_icone
        FROM produtos p
        JOIN categorias_produto cp ON cp.id = p.categoria_id
        WHERE p.ativo = 1
    ";
    $params = [];

    if ($disponivelOnly) {
        $sql .= " AND p.disponivel = 1";
    }
    if ($categoria) {
        $sql .= " AND cp.nome = ?";
        $params[] = $categoria;
    }
    $sql .= " ORDER BY cp.id, p.nome";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response($stmt->fetchAll());
}

if ($method === 'POST') {
    require_admin();
    $input = get_json_input();
    $nome             = trim($input['nome'] ?? '');
    $preco_venda      = (float)($input['preco_venda'] ?? 0);
    $categoria_id     = (int)($input['categoria_id'] ?? 0);
    $destino_producao = trim($input['destino_producao'] ?? 'balcao');
    $descricao        = trim($input['descricao'] ?? '');

    if (!$nome || $preco_venda <= 0 || !$categoria_id) {
        json_response(['error' => 'Campos obrigatórios: nome, preco_venda, categoria_id'], 400);
    }

    $id = guidv4();
    $stmt = $pdo->prepare("
        INSERT INTO produtos (id, nome, descricao, preco_venda, categoria_id, destino_producao, ativo, disponivel, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())
    ");
    $stmt->execute([$id, $nome, $descricao, $preco_venda, $categoria_id, $destino_producao]);

    json_response(['id' => $id, 'mensagem' => 'Produto criado com sucesso'], 201);
}

if ($method === 'DELETE') {
    require_admin();
    $id = $_GET['id'] ?? null;
    if (!$id) {
        json_response(['error' => 'ID obrigatório'], 400);
    }
    $stmt = $pdo->prepare("UPDATE produtos SET ativo = 0, disponivel = 0, atualizado_em = NOW() WHERE id = ?");
    $stmt->execute([$id]);
    json_response(['mensagem' => 'Produto removido do cardápio']);
}

if ($method === 'PATCH') {
    require_admin();
    $input = get_json_input();
    $id = $input['id'] ?? null;
    if (!$id) {
        json_response(['error' => 'ID obrigatório'], 400);
    }
    $disponivel = !empty($input['disponivel']) ? 1 : 0;
    $stmt = $pdo->prepare("UPDATE produtos SET disponivel = ?, atualizado_em = NOW() WHERE id = ?");
    $stmt->execute([$disponivel, $id]);
    json_response(['mensagem' => 'Produto atualizado']);
}

json_response(['error' => 'Método não permitido'], 405);
