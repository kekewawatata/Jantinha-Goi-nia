// app/api/produtos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query, exec, cachedQuery, invalidateCache } from '@/lib/db';

export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const categoria = searchParams.get('categoria') ?? '';
  const disponivelOnly = searchParams.get('disponivel') !== 'false';

  const cacheKey = `produtos:${categoria}:${disponivelOnly}`;

  const produtos = await cachedQuery(cacheKey, 15000, async () => {
    let sql = `
      SELECT p.id, p.nome, p.descricao, p.preco_venda, p.preco_custo,
             p.disponivel, p.destino_producao, p.permite_adicional,
             cp.nome as categoria, cp.icone as categoria_icone
      FROM produtos p
      JOIN categorias_produto cp ON cp.id = p.categoria_id
      WHERE p.ativo = 1
    `;
    const args: unknown[] = [];

    if (disponivelOnly) { sql += ` AND p.disponivel = 1`; }
    if (categoria) { sql += ` AND cp.nome = ?`; args.push(categoria); }
    sql += ` ORDER BY cp.id, p.nome`;

    return await query(sql, args);
  });

  return NextResponse.json(produtos);
}

export async function POST(req: NextRequest) {
  await initDb();
  try {
    const { nome, preco_venda, categoria_id, destino_producao, descricao } = await req.json();
    if (!nome || !preco_venda || !categoria_id) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome, preco_venda, categoria_id' }, { status: 400 });
    }
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    await exec(
      `INSERT INTO produtos (id, nome, descricao, preco_venda, categoria_id, destino_producao, ativo, disponivel, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      [id, nome, descricao ?? '', preco_venda, categoria_id, destino_producao ?? 'balcao']
    );
    invalidateCache('produtos:');
    return NextResponse.json({ id, mensagem: 'Produto criado com sucesso' }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await initDb();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await exec(`UPDATE produtos SET ativo = 0, disponivel = 0, atualizado_em = NOW() WHERE id = ?`, [id]);
    invalidateCache('produtos:');
    return NextResponse.json({ mensagem: 'Produto removido do cardápio' });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await initDb();
  try {
    const { id, disponivel } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await exec(`UPDATE produtos SET disponivel = ?, atualizado_em = NOW() WHERE id = ?`, [disponivel ? 1 : 0, id]);
    invalidateCache('produtos:');
    return NextResponse.json({ mensagem: 'Produto atualizado' });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
