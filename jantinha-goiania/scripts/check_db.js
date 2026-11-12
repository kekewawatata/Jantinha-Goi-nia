const Database = require('better-sqlite3');
const db = new Database('data/jantinha.db');

console.log('=== SCHEMA produtos ===');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='produtos'").get();
console.log(schema.sql);

console.log('\n=== TODOS PRODUTOS (com id null?) ===');
const produtos = db.prepare('SELECT id, nome, categoria_id, ativo FROM produtos').all();
console.log(produtos);

console.log('\n=== SCHEMA itens_pedido ===');
const schemaItens = db.prepare("SELECT sql FROM sqlite_master WHERE name='itens_pedido'").get();
console.log(schemaItens.sql);
