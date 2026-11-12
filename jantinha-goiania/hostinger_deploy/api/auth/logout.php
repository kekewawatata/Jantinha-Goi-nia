<?php
// hostinger_deploy/api/auth/logout.php
require_once __DIR__ . '/../db.php';

setcookie('auth_token', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);

json_response(['ok' => true]);
