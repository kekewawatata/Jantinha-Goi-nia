const Database = require('better-sqlite3');
const db = new Database('data/jantinha.db');

// 1. Reativar todos os produtos originais (que foram desativados)
const reativados = db.prepare("UPDATE produtos SET ativo = 1, disponivel = 1 WHERE id IS NOT NULL").run();
console.log('Produtos reativados:', reativados.changes);

// 2. Remover produto com id null (foi criado com bug)
const removidos = db.prepare("DELETE FROM produtos WHERE id IS NULL").run();
console.log('Produtos com id NULL removidos:', removidos.changes);

// 3. Verificar estado final
const produtos = db.prepare('SELECT id, nome, categoria_id, ativo, disponivel FROM produtos ORDER BY categoria_id, nome').all();
console.log('\n=== Produtos finais ===');
produtos.forEach(p => console.log(p.id?.slice(0,8) + '...', p.nome, '| ativo:', p.ativo, '| disponivel:', p.disponivel));
console.log('\nTotal:', produtos.length, 'produtos');
