// app/api/estoque/limpar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { exec } from '@/lib/db';
import { verificarToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado. Apenas administradores podem limpar o estoque.' }, { status: 403 });
  }

  try {
    await exec(`UPDATE insumos SET estoque_atual = 0, atualizado_em = NOW()`);
    await exec(`UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE resolvido = 0`);
    return NextResponse.json({ ok: true, mensagem: 'Estoque limpo com sucesso! Todas as quantidades foram zeradas.' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
