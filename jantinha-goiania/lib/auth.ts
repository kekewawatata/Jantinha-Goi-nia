/**
 * lib/auth.ts
 * Autenticação com HMAC via MySQL.
 */

import crypto from 'crypto';
import { queryOne, exec } from './db';

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  perfil: 'adm' | 'caixa';
}

function hashSenha(senha: string) {
  return crypto.createHash('sha256').update(senha).digest('hex');
}

export async function autenticar(email: string, senha: string): Promise<UserSession | null> {
  const user = await queryOne<UserSession>(
    `SELECT id, nome, email, perfil FROM usuarios WHERE email = ? AND senha_hash = ? AND ativo = 1`,
    [email, hashSenha(senha)]
  );

  if (user) {
    await exec(`UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?`, [user.id]);
  }

  return user ?? null;
}

// Token simples assinado com HMAC (sem JWT lib)
const SECRET = process.env.AUTH_SECRET ?? 'jantinha-secret-dev-2026';

export function gerarToken(user: UserSession): string {
  const payload = JSON.stringify({ ...user, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verificarToken(token: string): UserSession | null {
  try {
    const [b64, sig] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return { id: payload.id, nome: payload.nome, email: payload.email, perfil: payload.perfil };
  } catch {
    return null;
  }
}
