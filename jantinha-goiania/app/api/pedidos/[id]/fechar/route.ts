// app/api/pedidos/[id]/fechar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { fecharPedido } from '@/lib/business/pedidos';
import { verificarToken } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { forma_pagamento, valor_pago } = await req.json();
  if (!forma_pagamento || valor_pago === undefined) {
    return NextResponse.json({ error: 'Dados de pagamento incompletos' }, { status: 400 });
  }

  const { id } = await params;

  try {
    await fecharPedido(id, forma_pagamento, valor_pago, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
