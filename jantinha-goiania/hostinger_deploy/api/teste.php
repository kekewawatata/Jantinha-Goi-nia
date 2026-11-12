<?php
// hostinger_deploy/api/teste.php
// Script de diagnóstico rápido da conexão com o banco de dados MySQL na Hostinger
require_once __DIR__ . '/db.php';

try {
    $pdo = get_db();
    
    // Lista tabelas existentes
    $tablesStmt = $pdo->query("SHOW TABLES");
    $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);

    // Checa usuários se a tabela existir
    $users = [];
    if (in_array('usuarios', $tables)) {
        $userStmt = $pdo->query("SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios");
        $users = $userStmt->fetchAll();
    }

    json_response([
        'status'    => 'sucesso',
        'mensagem'  => 'Conexão com o MySQL realizada com 100% de sucesso!',
        'banco'     => 'u423151460_database',
        'tabelas'   => $tables,
        'qtd_tabelas' => count($tables),
        'usuarios'  => $users,
    ]);
} catch (Exception $e) {
    json_response([
        'status' => 'erro',
        'mensagem' => $e->getMessage(),
    ], 500);
}
