/**
 * lib/seed.ts
 * Dados iniciais: usuários, insumos, produtos e fichas técnicas.
 */

import { exec, query, queryOne } from './db';
import crypto from 'crypto';

function uuid() { return crypto.randomUUID(); }
function hashSenha(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }

export async function runSeed() {
  const row = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM usuarios`);
  if (Number(row?.c ?? 0) > 0) return;

  // ── Unidades de Medida ─────────────────────────────────────
  for (const [sigla, nome] of [['kg','Quilograma'],['g','Grama'],['un','Unidade'],['L','Litro'],['ml','Mililitro']]) {
    await exec(`INSERT IGNORE INTO unidades_medida (sigla, nome) VALUES (?, ?)`, [sigla, nome]);
  }

  // ── Usuários ───────────────────────────────────────────────
  const admId = uuid(), caixaId = uuid();
  await exec(`INSERT INTO usuarios (id,nome,email,senha_hash,perfil) VALUES (?,?,?,?,?)`,
    [admId,   'Administrador', 'adm@jantinha.com',   hashSenha('adm123'),   'adm']);
  await exec(`INSERT INTO usuarios (id,nome,email,senha_hash,perfil) VALUES (?,?,?,?,?)`,
    [caixaId, 'Atendente',     'caixa@jantinha.com', hashSenha('caixa123'), 'caixa']);

  // ── Categorias Financeiro ──────────────────────────────────
  for (const [tipo, nome, icone] of [
    ['entrada','Venda Balcão','💰'], ['entrada','Venda Mesa','🍽️'], ['entrada','Ajuste/Estorno','↩️'],
    ['saida','Compra de Insumos','🛒'], ['saida','Carvão e Descartáveis','🔥'],
    ['saida','Gás de Cozinha','💨'], ['saida','Mão de Obra','👷'],
    ['saida','Aluguel/Ponto','🏠'], ['saida','Desperdício/Descarte','🗑️'], ['saida','Outros Custos','📋'],
  ]) {
    await exec(`INSERT IGNORE INTO categorias_financeiro (tipo,nome,icone) VALUES (?,?,?)`, [tipo, nome, icone]);
  }

  // ── Categorias de Produto ──────────────────────────────────
  for (const [nome, icone] of [
    ['Espetinho','🍢'], ['Jantinha Simples','🍱'], ['Jantinha Completa','🍽️'],
    ['Bebida','🥤'], ['Adicional','➕'],
  ]) {
    await exec(`INSERT IGNORE INTO categorias_produto (nome,icone) VALUES (?,?)`, [nome, icone]);
  }

  const getCatProd = async (n: string) => {
    const r = await queryOne<{ id: number }>(`SELECT id FROM categorias_produto WHERE nome=?`, [n]);
    return r!.id;
  };
  const getUm = async (s: string) => {
    const r = await queryOne<{ id: number }>(`SELECT id FROM unidades_medida WHERE sigla=?`, [s]);
    return r!.id;
  };

  // ── Insumos ────────────────────────────────────────────────
  const insumosData = [
    { nome:'Contrafilé (Medalhão)',   um:'un', custo:5.00,  min:10, perecivel:1, val:3   },
    { nome:'Frango (Peito/Coxa)',     um:'un', custo:3.50,  min:10, perecivel:1, val:3   },
    { nome:'Coração de Frango',       um:'un', custo:3.00,  min:10, perecivel:1, val:3   },
    { nome:'Bacon (Tiras)',           um:'un', custo:2.50,  min:5,  perecivel:1, val:5   },
    { nome:'Arroz Cru (Tipo 1)',      um:'un', custo:1.50,  min:10, perecivel:0, val:180 },
    { nome:'Feijão Carioca Cru',      um:'un', custo:1.50,  min:10, perecivel:0, val:180 },
    { nome:'Farinha de Mandioca',     um:'un', custo:1.00,  min:5,  perecivel:0, val:90  },
    { nome:'Mandioca In Natura',      um:'un', custo:1.50,  min:10, perecivel:1, val:7   },
    { nome:'Carvão Vegetal',          um:'un', custo:3.50,  min:10, perecivel:0, val:365 },
    { nome:'Espeto de Madeira',       um:'un', custo:0.10,  min:50, perecivel:0, val:365 },
    { nome:'Alho',                    um:'un', custo:1.00,  min:5,  perecivel:1, val:30  },
    { nome:'Sal Refinado',            um:'un', custo:0.50,  min:5,  perecivel:0, val:365 },
    { nome:'Vinagrete',               um:'un', custo:1.50,  min:10, perecivel:1, val:2   },
    { nome:'Óleo de Soja',            um:'un', custo:2.00,  min:5,  perecivel:0, val:180 },
    { nome:'Tempero Verde',           um:'un', custo:1.00,  min:5,  perecivel:1, val:5   },
    { nome:'Queijo Coalho',           um:'un', custo:4.00,  min:5,  perecivel:1, val:7   },
  ];
  const insumoIds: Record<string, string> = {};
  const unId = await getUm('un');
  for (const ins of insumosData) {
    const id = uuid();
    insumoIds[ins.nome] = id;
    await exec(
      `INSERT INTO insumos (id,nome,unidade_medida_id,custo_unitario,estoque_atual,estoque_minimo,fator_rendimento,perecivel,validade_dias)
       VALUES (?,?,?,?,?,?,1.0,?,?)`,
      [id, ins.nome, unId, ins.custo, ins.min * 2, ins.min, ins.perecivel, ins.val]
    );
  }

  // ── Produtos ───────────────────────────────────────────────
  const produtosData = [
    { cat:'Espetinho', nome:'Espetinho de Medalhão',        preco:7.00,  dest:'churrasqueira' },
    { cat:'Espetinho', nome:'Espetinho de Frango c/ Bacon', preco:6.50,  dest:'churrasqueira' },
    { cat:'Espetinho', nome:'Espetinho de Coração',         preco:5.50,  dest:'churrasqueira' },
    { cat:'Espetinho', nome:'Espetinho de Queijo Coalho',   preco:6.00,  dest:'churrasqueira' },
    { cat:'Jantinha Simples',  nome:'Jantinha Simples',   preco:15.00, dest:'cozinha' },
    { cat:'Jantinha Completa', nome:'Jantinha Completa',  preco:22.00, dest:'cozinha' },
    { cat:'Bebida', nome:'Refrigerante Lata 350ml', preco:5.00, dest:'balcao' },
    { cat:'Bebida', nome:'Água Mineral 500ml',      preco:3.00, dest:'balcao' },
    { cat:'Bebida', nome:'Suco de Laranja 300ml',   preco:6.00, dest:'balcao' },
    { cat:'Adicional', nome:'Porção Extra de Arroz',    preco:3.00, dest:'cozinha' },
    { cat:'Adicional', nome:'Porção Extra de Tropeiro', preco:4.00, dest:'cozinha' },
    { cat:'Adicional', nome:'Porção Extra de Mandioca', preco:4.00, dest:'cozinha' },
  ];
  const produtoIds: Record<string, string> = {};
  for (const p of produtosData) {
    const id = uuid();
    produtoIds[p.nome] = id;
    const catId = await getCatProd(p.cat);
    await exec(`INSERT INTO produtos (id,categoria_id,nome,preco_venda,destino_producao) VALUES (?,?,?,?,?)`,
      [id, catId, p.nome, p.preco, p.dest]);
  }

  // ── Ficha Técnica ──────────────────────────────────────────
  const ft = async (prod: string, insumo: string, qtd: number, ordem: number) => {
    await exec(
      `INSERT IGNORE INTO ficha_tecnica (id,produto_id,insumo_id,quantidade_bruta,ordem) VALUES (?,?,?,?,?)`,
      [uuid(), produtoIds[prod], insumoIds[insumo], qtd, ordem]
    );
  };

  await ft('Espetinho de Medalhão','Contrafilé (Medalhão)',0.120,1);
  await ft('Espetinho de Medalhão','Espeto de Madeira',1,2);
  await ft('Espetinho de Medalhão','Sal Refinado',0.003,3);
  await ft('Espetinho de Frango c/ Bacon','Frango (Peito/Coxa)',0.090,1);
  await ft('Espetinho de Frango c/ Bacon','Bacon (Tiras)',0.020,2);
  await ft('Espetinho de Frango c/ Bacon','Espeto de Madeira',1,3);
  await ft('Espetinho de Frango c/ Bacon','Sal Refinado',0.003,4);
  await ft('Espetinho de Coração','Coração de Frango',0.100,1);
  await ft('Espetinho de Coração','Espeto de Madeira',1,2);
  await ft('Espetinho de Coração','Sal Refinado',0.003,3);
  await ft('Espetinho de Queijo Coalho','Queijo Coalho',0.080,1);
  await ft('Espetinho de Queijo Coalho','Espeto de Madeira',1,2);
  await ft('Jantinha Simples','Arroz Cru (Tipo 1)',0.060,1);
  await ft('Jantinha Simples','Feijão Carioca Cru',0.060,2);
  await ft('Jantinha Simples','Bacon (Tiras)',0.020,3);
  await ft('Jantinha Simples','Farinha de Mandioca',0.015,4);
  await ft('Jantinha Simples','Mandioca In Natura',0.118,5);
  await ft('Jantinha Simples','Vinagrete',0.050,6);
  await ft('Jantinha Simples','Alho',0.005,7);
  await ft('Jantinha Simples','Sal Refinado',0.003,8);
  await ft('Jantinha Simples','Óleo de Soja',0.005,9);

  // Jantinha Completa = mesma ficha da Jantinha Simples
  const acomps = await query<{ insumo_id: string; quantidade_bruta: number; ordem: number }>(
    `SELECT insumo_id, quantidade_bruta, ordem FROM ficha_tecnica WHERE produto_id = ?`,
    [produtoIds['Jantinha Simples']]
  );
  for (const a of acomps) {
    await exec(
      `INSERT IGNORE INTO ficha_tecnica (id,produto_id,insumo_id,quantidade_bruta,ordem) VALUES (?,?,?,?,?)`,
      [uuid(), produtoIds['Jantinha Completa'], a.insumo_id, a.quantidade_bruta, a.ordem]
    );
  }

  console.log('✅ Seed MySQL executado com sucesso.');
}
