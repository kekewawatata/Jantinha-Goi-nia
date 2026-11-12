<?php
// hostinger_deploy/api/financeiro/limpar.php
require_once __DIR__ . '/../db.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$pdo = get_db();
try {
    $pdo->exec("DELETE FROM fluxo_caixa");
    json_response([
        'ok'       => true,
        'mensagem' => 'Histórico financeiro limpo com sucesso! Todas as entradas e saídas foram zeradas.',
    ]);
} catch (Exception $e) {
    json_response(['error' => $e->getMessage()], 500);
}
