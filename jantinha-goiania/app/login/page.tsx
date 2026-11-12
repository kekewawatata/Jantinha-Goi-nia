'use client';
// app/login/page.tsx — Design Premium Gastronômico com Glassmorphism

import { useState } from 'react';
import { IconFlame } from '@/app/components/Icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        setErro(`Erro ${res.status}: ${text ? text.slice(0, 120) : 'resposta inválida do servidor'}`);
        return;
      }

      if (!res.ok) {
        setErro(data.error ?? `Erro ${res.status} ao fazer login`);
        return;
      }

      // Salva no localStorage como backup de autenticação
      if (typeof window !== 'undefined') {
        if (data.token) localStorage.setItem('auth_token', data.token);
        if (data.user)  localStorage.setItem('auth_user', JSON.stringify(data.user));
      }

      const perfil = data.user?.perfil;
      if (perfil === 'adm') {
        window.location.href = '/adm/dashboard/';
      } else {
        window.location.href = '/mesa/';
      }
    } catch (e: any) {
      setErro('Erro de rede: ' + (e?.message ?? 'verifique sua conexão'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center px-6 overflow-hidden bg-surface-base">
      {/* Luz ambiente de fundo (Glow Gastronômico) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cartão de Login com Glassmorphism */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl glass-panel border border-white/10 shadow-glass">
        {/* Logo / Marca */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-surface-elevated to-surface-card border border-orange-500/40 flex items-center justify-center mx-auto mb-4 shadow-ember animate-float">
            <IconFlame size={42} color="#f97316" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Jantinha Goiânia</h1>
          <p className="text-zinc-400 text-sm mt-1">Sistema de Gestão & Atendimento</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              E-mail de Acesso
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className="w-full bg-surface-elevated/90 border border-white/10 rounded-xl px-4 py-3.5
                         text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500
                         focus:ring-2 focus:ring-orange-500/20 transition-all text-base"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-surface-elevated/90 border border-white/10 rounded-xl px-4 py-3.5
                         text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500
                         focus:ring-2 focus:ring-orange-500/20 transition-all text-base"
            />
          </div>

          {erro && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-300 text-sm animate-fade-in flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-base tracking-wide font-bold shadow-ember disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Autenticando...
              </span>
            ) : 'Entrar no Sistema'}
          </button>
        </form>
      </div>

      <p className="relative z-10 text-xs text-zinc-600 mt-6 text-center">
        Jantinha Goiânia • Operação PDV & Mesas
      </p>
    </main>
  );
}
