// app/api/alertas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query, exec } from '@/lib/db';

export async function GET(_req: NextRequest) {
  await initDb();
  const rows = await query(`
    SELECT ae.id, ae.tipo_alerta, ae.mensagem, ae.criado_em,
           i.nome as insumo_nome, i.estoque_atual, i.estoque_minimo
    FROM alertas_estoque ae
    JOIN insumos i ON i.id = ae.insumo_id
    WHERE ae.resolvido = 0
    ORDER BY ae.criado_em DESC
  `);
  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  await exec(`UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
