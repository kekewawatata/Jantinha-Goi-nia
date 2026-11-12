// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { autenticar, gerarToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  await initDb();
  const { email, senha } = await req.json();
  const user = await autenticar(email, senha);

  if (!user) {
    return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 });
  }

  const token = gerarToken(user);
  const response = NextResponse.json({ user });
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
  return response;
}
