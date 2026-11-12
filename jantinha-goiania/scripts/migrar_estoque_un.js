const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'jantinha.db'));
const unId = db.prepare("SELECT id FROM unidades_medida WHERE sigla = 'un'").get().id;

db.transaction(() => {
  // 1. Atualizar todas as unidades para 'un'
  db.prepare("UPDATE insumos SET unidade_medida_id = ?").run(unId);

  // 2. Limpar todo o estoque atual (zerar)
  db.prepare("UPDATE insumos SET estoque_atual = 0, atualizado_em = datetime('now')").run();

  // 3. Atualizar fichas técnicas para unidades inteiras (1 un por item)
  db.prepare("UPDATE ficha_tecnica SET quantidade_bruta = 1.0").run();

  // 4. Limpar alertas antigos
  db.prepare("UPDATE alertas_estoque SET resolvido = 1, resolvido_em = datetime('now') WHERE resolvido = 0").run();
})();

console.log('✅ Migração concluída: Estoque limpo (zerado) e tudo convertido para unidade (un)!');
console.log(db.prepare("SELECT nome, estoque_atual, custo_unitario, (SELECT sigla FROM unidades_medida WHERE id = insumos.unidade_medida_id) as un FROM insumos").all());
