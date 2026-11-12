// app/api/pedidos/[id]/entregar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { marcarPedidoEntregue } from '@/lib/business/pedidos';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID do pedido é obrigatório' }, { status: 400 });
  }

  try {
    await marcarPedidoEntregue(id);
    return NextResponse.json({ ok: true, mensagem: 'Pedido marcado como entregue com sucesso!' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
