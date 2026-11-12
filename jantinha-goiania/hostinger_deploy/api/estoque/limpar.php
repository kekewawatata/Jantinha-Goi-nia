<?php
// hostinger_deploy/api/estoque/limpar.php
require_once __DIR__ . '/../db.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$pdo = get_db();
try {
    $pdo->beginTransaction();
    $pdo->exec("UPDATE insumos SET estoque_atual = 0, atualizado_em = NOW()");
    $pdo->exec("UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE resolvido = 0");
    $pdo->commit();

    json_response(['ok' => true, 'mensagem' => 'Estoque limpo com sucesso! Todas as quantidades foram zeradas.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['error' => $e->getMessage()], 500);
}
