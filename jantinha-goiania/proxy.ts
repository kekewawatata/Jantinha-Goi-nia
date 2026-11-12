/**
 * proxy.ts
 * Edge-compatible: NÃO importa better-sqlite3.
 * Usa apenas crypto (disponível no Edge Runtime) para verificar o token HMAC.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET = process.env.AUTH_SECRET ?? 'jantinha-secret-dev-2026';

// Verificação de token HMAC pura (sem Node.js nativo, usando Web Crypto API)
async function verificarTokenEdge(token: string): Promise<{ perfil: string } | null> {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;

    const keyData = new TextEncoder().encode(SECRET);
    const key = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );

    const msgData = new TextEncoder().encode(b64);
    const sigData = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify('HMAC', key, sigData, msgData);
    if (!valid) return null;

    const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp < Date.now()) return null;

    return { perfil: payload.perfil };
  } catch {
    return null;
  }
}

const ROTAS_PUBLICAS = ['/login', '/api/auth/login', '/api/auth/logout'];

const PERMISSOES: Record<string, string[]> = {
  '/adm':      ['adm'],
  '/pdv':      ['caixa'],
  '/mesa':     ['caixa'],
  '/producao': ['adm', 'caixa'],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Libera rotas públicas e assets
  if (
    ROTAS_PUBLICAS.some(r => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  const user = token ? await verificarTokenEdge(token) : null;

  if (!user) {
    // Rota raiz sem auth → login
    if (pathname === '/') return NextResponse.redirect(new URL('/login', request.url));
    // APIs sem auth → 401
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    // Qualquer outra rota → login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verifica permissão por rota
  for (const [rota, perfisPermitidos] of Object.entries(PERMISSOES)) {
    if (pathname.startsWith(rota) && !perfisPermitidos.includes(user.perfil)) {
      const destino = user.perfil === 'adm' ? '/adm/dashboard' : '/pdv';
      return NextResponse.redirect(new URL(destino, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.png$).*)'],
};
