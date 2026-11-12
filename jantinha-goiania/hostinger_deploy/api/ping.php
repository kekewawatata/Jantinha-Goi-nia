<?php
// api/ping.php — Teste simples SEM banco de dados
// Acesse: /api/ping.php (com extensão) ou /api/ping (via htaccess)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
echo json_encode([
    'ok'          => true,
    'php'         => phpversion(),
    'hora'        => date('d/m/Y H:i:s'),
    'message'     => 'PHP funcionando no Hostinger!',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? '?',
    'method'      => $_SERVER['REQUEST_METHOD'] ?? '?',
]);
