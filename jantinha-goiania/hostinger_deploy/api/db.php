<?php
// hostinger_deploy/api/db.php
// Conexão MySQL via PDO com tratamento global de erros em JSON e credenciais fixadas

// Buffer de saída: impede que avisos do PHP corrompam o JSON antes de ser enviado
ob_start();

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Garante que qualquer erro ou exceção não tratada sempre retorne JSON
set_exception_handler(function(Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
});

set_error_handler(function($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) return false;
    http_response_code(500);
    echo json_encode(['error' => "$message na linha $line"], JSON_UNESCAPED_UNICODE);
    exit;
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function get_config() {
    static $config = null;
    if ($config === null) {
        $configFile = __DIR__ . '/config.php';
        if (file_exists($configFile)) {
            $config = require $configFile;
        } else {
            $config = [
                'host'     => 'localhost',
                'port'     => '3306',
                'dbname'   => 'u423151460_database',
                'username' => 'u423151460_usuario',
                'password' => '/Wv24?-p$AGa',
                'secret'   => 'jantinha-secret-hostinger-2026',
            ];
        }
    }
    return $config;
}

function ensure_database_schema(PDO $pdo) {
    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        $check = $pdo->query("SHOW TABLES LIKE 'produtos'");
        if (!$check->fetch()) {
            $paths = [
                __DIR__ . '/../jantinha.sql',
                __DIR__ . '/jantinha.sql',
                $_SERVER['DOCUMENT_ROOT'] . '/jantinha.sql',
            ];
            foreach ($paths as $file) {
                if (file_exists($file)) {
                    $sql = file_get_contents($file);
                    if ($sql) {
                        $pdo->exec($sql);
                        break;
                    }
                }
            }
        }
    } catch (Exception $e) {
        // Ignora caso não consiga
    }
}

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $cfg = get_config();
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['dbname']};charset=utf8mb4";
        try {
            $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            ensure_database_schema($pdo);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Falha de conexão com o banco de dados MySQL: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

function json_response($data, int $status = 200) {
    ob_clean(); // Limpa qualquer saída PHP (avisos/notices) que tenha sido bufferizada
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function guidv4(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function gerar_token(array $user): string {
    $cfg = get_config();
    $payload = [
        'id'     => $user['id'],
        'nome'   => $user['nome'],
        'email'  => $user['email'],
        'perfil' => $user['perfil'],
        'exp'    => time() + 86400,
    ];
    $b64 = base64url_encode(json_encode($payload));
    $sig = hash_hmac('sha256', $b64, $cfg['secret']);
    $sigB64 = base64url_encode(hex2bin($sig));
    return "{$b64}.{$sigB64}";
}

function get_authenticated_user(): ?array {
    $token = $_COOKIE['auth_token'] ?? null;
    if (!$token) {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $auth, $m)) {
            $token = $m[1];
        }
    }
    if (!$token) return null;

    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;
    [$b64, $sig] = $parts;

    $cfg = get_config();
    $expectedSig = base64url_encode(hex2bin(hash_hmac('sha256', $b64, $cfg['secret'])));
    if (!hash_equals($expectedSig, $sig)) return null;

    $payload = json_decode(base64url_decode($b64), true);
    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) return null;

    return [
        'id'     => $payload['id'],
        'nome'   => $payload['nome'],
        'email'  => $payload['email'],
        'perfil' => $payload['perfil'],
    ];
}

function require_auth(): array {
    $user = get_authenticated_user();
    if (!$user) {
        json_response(['error' => 'Não autorizado'], 401);
    }
    return $user;
}

function require_admin(): array {
    $user = require_auth();
    if ($user['perfil'] !== 'adm') {
        json_response(['error' => 'Acesso negado: privilégio de administrador necessário'], 403);
    }
    return $user;
}

// Funções de baixa de estoque e alertas
function check_stock_alerts(PDO $pdo) {
    $stmt = $pdo->query("
        SELECT id, nome, estoque_atual, estoque_minimo,
            CASE
                WHEN estoque_atual = 0                   THEN 'estoque_zerado'
                WHEN estoque_atual <= estoque_minimo      THEN 'estoque_minimo'
                ELSE NULL
            END as tipo_alerta
        FROM insumos
        WHERE ativo = 1 AND estoque_atual <= estoque_minimo
    ");
    $criticos = $stmt->fetchAll();

    $stmtCheck = $pdo->prepare("SELECT id FROM alertas_estoque WHERE insumo_id = ? AND tipo_alerta = ? AND resolvido = 0");
    $stmtInsert = $pdo->prepare("INSERT INTO alertas_estoque (id, insumo_id, tipo_alerta, mensagem, criado_em) VALUES (?, ?, ?, ?, NOW())");

    foreach ($criticos as $ins) {
        if (!$ins['tipo_alerta']) continue;
        $stmtCheck->execute([$ins['id'], $ins['tipo_alerta']]);
        if (!$stmtCheck->fetch()) {
            $msg = "{$ins['nome']}: " . number_format((float)$ins['estoque_atual'], 2, ',', '.') . " restantes (mínimo: {$ins['estoque_minimo']})";
            $stmtInsert->execute([guidv4(), $ins['id'], $ins['tipo_alerta'], $msg]);
        }
    }
}

function reduce_product_stock(PDO $pdo, string $produtoId, float $quantidade, string $pedidoId, ?string $usuarioId) {
    $stmtFT = $pdo->prepare("
        SELECT ft.insumo_id, ft.quantidade_bruta, i.custo_unitario
        FROM ficha_tecnica ft
        JOIN insumos i ON i.id = ft.insumo_id
        WHERE ft.produto_id = ?
    ");
    $stmtFT->execute([$produtoId]);
    $fichas = $stmtFT->fetchAll();

    $stmtUpd = $pdo->prepare("UPDATE insumos SET estoque_atual = GREATEST(0, estoque_atual - ?), atualizado_em = NOW() WHERE id = ?");
    $stmtMov = $pdo->prepare("
        INSERT INTO movimentacoes_estoque (id, insumo_id, tipo, quantidade, custo_unitario, referencia_id, referencia_tipo, usuario_id, criado_em)
        VALUES (?, ?, 'saida_venda', ?, ?, ?, 'pedido', ?, NOW())
    ");

    foreach ($fichas as $ft) {
        $baixa = (float)$ft['quantidade_bruta'] * $quantidade;
        $stmtUpd->execute([$baixa, $ft['insumo_id']]);
        $stmtMov->execute([guidv4(), $ft['insumo_id'], $baixa, $ft['custo_unitario'], $pedidoId, $usuarioId]);
    }
}

function process_order_stock_reduction(PDO $pdo, string $pedidoId, ?string $usuarioId) {
    $stmt = $pdo->prepare("
        SELECT ip.produto_id, ip.quantidade, ip.espetinho_escolhido_id, cp.nome as categoria
        FROM itens_pedido ip
        JOIN produtos p ON p.id = ip.produto_id
        JOIN categorias_produto cp ON cp.id = p.categoria_id
        WHERE ip.pedido_id = ? AND ip.status_producao != 'cancelado'
    ");
    $stmt->execute([$pedidoId]);
    $itens = $stmt->fetchAll();

    foreach ($itens as $item) {
        $qtd = (float)$item['quantidade'];
        reduce_product_stock($pdo, $item['produto_id'], $qtd, $pedidoId, $usuarioId);
        if ($item['categoria'] === 'Jantinha Completa' && !empty($item['espetinho_escolhido_id'])) {
            reduce_product_stock($pdo, $item['espetinho_escolhido_id'], $qtd, $pedidoId, $usuarioId);
        }
    }

    check_stock_alerts($pdo);
}
