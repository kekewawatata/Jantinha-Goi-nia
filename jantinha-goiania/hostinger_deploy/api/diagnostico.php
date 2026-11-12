<?php
// api/diagnostico.php — Teste de conexão ao banco de dados
// ACESSE: salmon-magpie-797971.hostingersite.com/api/diagnostico
// REMOVA este arquivo depois de diagnosticar!

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

ini_set('display_errors', '1');
error_reporting(E_ALL);

$resultado = [];

// 1. Versão do PHP
$resultado['php_version'] = phpversion();

// 2. Extensão PDO disponível?
$resultado['pdo_disponivel'] = extension_loaded('pdo');
$resultado['pdo_mysql_disponivel'] = extension_loaded('pdo_mysql');

// 3. Credenciais
$host     = 'localhost';
$port     = '3306';
$dbname   = 'u423151460_database';
$username = 'u423151460_usuario';
$password = '/Wv24?-p$AGa';

$resultado['host']     = $host;
$resultado['dbname']   = $dbname;
$resultado['username'] = $username;

// 4. Tenta conectar
try {
    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $resultado['conexao'] = 'OK';

    // 5. Verifica tabela usuarios
    try {
        $r = $pdo->query("SELECT COUNT(*) as c FROM usuarios");
        $resultado['usuarios_count'] = $r->fetch()['c'];
        $resultado['tabela_usuarios'] = 'existe';
    } catch (Exception $e) {
        $resultado['tabela_usuarios'] = 'NAO EXISTE: ' . $e->getMessage();
    }

    // 6. Testa SHA256 de adm123
    $resultado['sha256_adm123'] = hash('sha256', 'adm123');

    // 7. Busca usuario adm
    try {
        $stmt = $pdo->prepare("SELECT id, email, senha_hash, perfil FROM usuarios WHERE email = ?");
        $stmt->execute(['adm@jantinha.com']);
        $u = $stmt->fetch();
        if ($u) {
            $resultado['usuario_adm'] = [
                'id'         => $u['id'],
                'email'      => $u['email'],
                'perfil'     => $u['perfil'],
                'senha_hash' => $u['senha_hash'],
                'hash_bate'  => $u['senha_hash'] === hash('sha256', 'adm123') ? 'SIM ✅' : 'NAO ❌',
            ];
        } else {
            $resultado['usuario_adm'] = 'NAO ENCONTRADO';
        }
    } catch (Exception $e) {
        $resultado['usuario_adm'] = 'ERRO: ' . $e->getMessage();
    }

} catch (PDOException $e) {
    $resultado['conexao'] = 'FALHOU';
    $resultado['erro_conexao'] = $e->getMessage();
    $resultado['erro_codigo']  = $e->getCode();
}

// 8. Verifica se config.php existe
$configFile = __DIR__ . '/config.php';
$resultado['config_php_existe'] = file_exists($configFile) ? 'sim' : 'nao';

// 9. Teste do .htaccess – verifica REQUEST_URI
$resultado['request_uri'] = $_SERVER['REQUEST_URI'] ?? 'desconhecido';
$resultado['script_name'] = $_SERVER['SCRIPT_NAME'] ?? 'desconhecido';

echo json_encode($resultado, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
