'use client';
// app/components/AdmNav.tsx — Barra de navegação administrativa moderna com glassmorphism e glow ativo

import React from 'react';
import {
  IconDashboard,
  IconMesa,
  IconEstoque,
  IconFinanceiro,
  IconCardapio,
} from '@/app/components/Icons';

interface AdmNavProps {
  active: 'dashboard' | 'pedidos' | 'estoque' | 'financeiro' | 'produtos';
}

export default function AdmNav({ active }: AdmNavProps) {
  const itens = [
    { href: '/adm/dashboard/',  id: 'dashboard',  label: 'Dashboard',   icon: (color: string) => <IconDashboard size={20} color={color} /> },
    { href: '/mesa/',           id: 'pedidos',    label: 'Mesas / Ped.', icon: (color: string) => <IconMesa size={20} color={color} /> },
    { href: '/adm/estoque/',    id: 'estoque',    label: 'Estoque',     icon: (color: string) => <IconEstoque size={20} color={color} /> },
    { href: '/adm/financeiro/', id: 'financeiro', label: 'Financeiro',  icon: (color: string) => <IconFinanceiro size={20} color={color} /> },
    { href: '/adm/produtos/',   id: 'produtos',   label: 'Cardápio',    icon: (color: string) => <IconCardapio size={20} color={color} /> },
  ];

  const navegar = (href: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/90 backdrop-blur-xl border-t border-white/[0.08] flex justify-around items-center px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-2xl">
      {itens.map((item) => {
        const isActive = active === item.id;
        const iconColor = isActive ? '#f97316' : '#9ca3af';
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navegar(item.href)}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-200 select-none cursor-pointer outline-none min-w-[62px] ${
              isActive
                ? 'bg-orange-500/10 text-orange-400 font-bold shadow-[0_0_15px_rgba(249,115,22,0.15)] scale-[1.04]'
                : 'text-zinc-400 font-medium hover:text-zinc-200 active:scale-95'
            }`}
          >
            <div className={`flex items-center justify-center transition-transform duration-200 ${isActive ? 'scale-110 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]' : ''}`}>
              {item.icon(iconColor)}
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap leading-none mt-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
