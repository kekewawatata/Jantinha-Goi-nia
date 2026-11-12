'use client';
// app/page.tsx
// Página raiz: se acessada na raiz '/', redireciona para /login/

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      // Só redireciona se realmente estiver na raiz! Não interfere caso seja servido como fallback
      if (p === '/' || p === '' || p === '/index.html') {
        window.location.href = '/login/';
      }
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#71717a',
      fontFamily: 'system-ui, sans-serif',
    }}>
      Carregando...
    </div>
  );
}
