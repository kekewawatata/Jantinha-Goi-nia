// app/api/pedidos/[id]/item/[itemId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { atualizarStatusItem } from '@/lib/business/pedidos';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  await initDb();
  const { status } = await req.json();
  const statusValidos = ['em_preparo', 'pronto', 'entregue', 'cancelado'];
  if (!statusValidos.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }

  const { itemId } = await params;
  await atualizarStatusItem(itemId, status);
  return NextResponse.json({ ok: true });
}
