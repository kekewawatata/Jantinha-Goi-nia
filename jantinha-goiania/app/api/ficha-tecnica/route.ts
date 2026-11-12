// app/api/ficha-tecnica/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query, exec } from '@/lib/db';
import crypto from 'crypto';

function uuid() { return crypto.randomUUID(); }

// GET /api/ficha-tecnica?produto_id=xxx → lista fichas do produto
export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const produtoId = searchParams.get('produto_id');
  if (!produtoId) {
    return NextResponse.json({ error: 'produto_id obrigatório' }, { status: 400 });
  }
  const fichas = await query(
    `SELECT ft.id, ft.insumo_id, i.nome as insumo_nome, ft.quantidade_bruta, ft.observacao
     FROM ficha_tecnica ft
     JOIN insumos i ON i.id = ft.insumo_id
     WHERE ft.produto_id = ?
     ORDER BY ft.ordem`,
    [produtoId]
  );
  return NextResponse.json(fichas);
}

// POST /api/ficha-tecnica → cria vínculo
export async function POST(req: NextRequest) {
  await initDb();
  try {
    const { produto_id, insumo_id, quantidade_bruta } = await req.json();
    if (!produto_id || !insumo_id || !quantidade_bruta) {
      return NextResponse.json({ error: 'produto_id, insumo_id e quantidade_bruta são obrigatórios' }, { status: 400 });
    }
    await exec(
      `INSERT INTO ficha_tecnica (id, produto_id, insumo_id, quantidade_bruta, ordem, criado_em)
       VALUES (?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE quantidade_bruta = VALUES(quantidade_bruta)`,
      [uuid(), produto_id, insumo_id, quantidade_bruta]
    );
    return NextResponse.json({ mensagem: 'Vínculo criado com sucesso' }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/ficha-tecnica?id=xxx → remove vínculo
export async function DELETE(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  await exec(`DELETE FROM ficha_tecnica WHERE id = ?`, [id]);
  return NextResponse.json({ mensagem: 'Vínculo removido' });
}
