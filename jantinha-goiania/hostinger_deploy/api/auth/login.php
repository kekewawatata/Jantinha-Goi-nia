<?php
// hostinger_deploy/api/auth/login.php
require_once __DIR__ . '/../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método não permitido'], 405);
}

$input = get_json_input();
$email = strtolower(trim($input['email'] ?? ''));
$senha = trim($input['senha'] ?? '');

if (!$email || !$senha) {
    json_response(['error' => 'E-mail e senha são obrigatórios'], 400);
}

$pdo = get_db();

// 1. Garante que a tabela usuarios exista e tenha os dados padrão
try {
    $countStmt = $pdo->query("SELECT COUNT(*) as c FROM usuarios");
    $count = (int)($countStmt->fetch()['c'] ?? 0);
} catch (Exception $e) {
    // Tabela usuarios ainda não existe -> cria automaticamente!
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS usuarios (
          id varchar(36) NOT NULL,
          nome varchar(100) NOT NULL,
          email varchar(100) NOT NULL,
          senha_hash varchar(64) NOT NULL,
          perfil enum('adm','caixa','cozinha') NOT NULL,
          ativo tinyint(1) NOT NULL DEFAULT 1,
          criado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ultimo_acesso datetime DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $count = 0;
}

if ($count === 0) {
    $stmtSeed = $pdo->prepare("
        INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, criado_em)
        VALUES 
        ('usr-adm-001', 'Administrador', 'adm@jantinha.com', ?, 'adm', 1, NOW()),
        ('usr-caixa-002', 'Atendente Caixa', 'caixa@jantinha.com', ?, 'caixa', 1, NOW())
    ");
    $stmtSeed->execute([
        hash('sha256', 'adm123'),
        hash('sha256', 'caixa123'),
    ]);
}

$senhaHash = hash('sha256', $senha);

// 2. Busca o usuário pelo e-mail
$stmt = $pdo->prepare("SELECT id, nome, email, senha_hash, perfil FROM usuarios WHERE LOWER(email) = ? AND ativo = 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    json_response(['error' => 'E-mail não encontrado no sistema'], 401);
}

// 3. Validação da senha (suporta SHA-256 e texto puro com auto-upgrade)
$valido = false;
if (hash_equals($user['senha_hash'], $senhaHash)) {
    $valido = true;
} elseif ($user['senha_hash'] === $senha) {
    // Caso tenha sido inserida em texto puro diretamente no phpMyAdmin
    $valido = true;
    $pdo->prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?")->execute([$senhaHash, $user['id']]);
}

if (!$valido) {
    json_response(['error' => 'Senha incorreta para este e-mail'], 401);
}

// 4. Atualiza último acesso
$pdo->prepare("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?")->execute([$user['id']]);

$token = gerar_token($user);

// Configura cookie HTTP-Only para 24 horas
setcookie('auth_token', $token, [
    'expires'  => time() + 86400,
    'path'     => '/',
    'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
    'httponly' => true,
    'samesite' => 'Lax',
]);

json_response([
    'ok'    => true,
    'user'  => [
        'id'     => $user['id'],
        'nome'   => $user['nome'],
        'email'  => $user['email'],
        'perfil' => $user['perfil'],
    ],
    'token' => $token,
]);
