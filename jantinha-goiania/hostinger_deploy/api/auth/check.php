<?php
// hostinger_deploy/api/auth/check.php
require_once __DIR__ . '/../db.php';

$user = get_authenticated_user();
if (!$user) {
    json_response(['authenticated' => false], 401);
}

json_response([
    'authenticated' => true,
    'user'          => $user,
]);
