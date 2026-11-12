// app/api/financeiro/limpar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { exec } from '@/lib/db';
import { verificarToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado. Apenas administradores podem limpar o financeiro.' }, { status: 403 });
  }

  try {
    await exec(`DELETE FROM fluxo_caixa`);
    return NextResponse.json({
      ok: true,
      mensagem: 'Histórico financeiro limpo com sucesso! Todas as entradas e saídas foram zeradas.',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
