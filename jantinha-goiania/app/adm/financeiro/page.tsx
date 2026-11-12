'use client';
// app/adm/financeiro/page.tsx — Fluxo de Caixa ADM (design moderno preto/laranja e formatação segura)

import { useState, useEffect, Component, ReactNode } from 'react';
import { formatDateBR } from '@/lib/utils';
import AdmNav from '@/app/components/AdmNav';
import {
  IconDollar,
  IconBroom,
  IconPlus,
  IconCheck,
  IconAlert,
  IconReceipt,
  IconClose,
} from '@/app/components/Icons';

class ErrorBoundary extends Component<{ children: ReactNode }, { erro: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { erro: null };
  }
  static getDerivedStateFromError(e: Error) {
    return { erro: e?.message || 'Erro desconhecido' };
  }
  render() {
    if (this.state.erro) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: '#09090b' }}>
          <div style={{ color: '#f97316', marginBottom: 12 }}>
            <IconAlert size={36} color="#f97316" />
          </div>
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Financeiro</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar os dados financeiros.</p>
          <p style={{ color: '#52525b', fontSize: 11, marginBottom: 20, maxWidth: 300 }}>{this.state.erro}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Lancamento {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number | string;
  descricao: string;
  data_lancamento: string;
  categoria: string;
  icone: string;
}

interface ResumoItem {
  tipo: string;
  total: number | string;
}

interface CatItem {
  categoria: string;
  icone: string;
  tipo: string;
  total: number | string;
}

interface FinData {
  resumo: ResumoItem[];
  lancamentos: Lancamento[];
  porCategoria: CatItem[];
}

// ─── Formatação monetária 100% segura contra strings/undefined ───
function fmt(v: unknown): string {
  try {
    const n = Number(v) || 0;
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  } catch {
    return 'R$ 0,00';
  }
}

const CATEGORIAS_SAIDA = [
  { id: 4,  nome: 'Compra de Insumos'       },
  { id: 5,  nome: 'Carvão e Descartáveis'   },
  { id: 6,  nome: 'Gás de Cozinha'          },
  { id: 7,  nome: 'Mão de Obra'             },
  { id: 8,  nome: 'Aluguel / Ponto'         },
  { id: 9,  nome: 'Desperdício / Descarte'  },
  { id: 10, nome: 'Outros Custos'           },
];

function FinanceiroInner() {
  const hoje = new Date().toISOString().slice(0, 10);
  const [inicio, setInicio]     = useState(hoje);
  const [fim, setFim]           = useState(hoje);
  const [data, setData]         = useState<FinData | null>(null);
  const [modalSaida, setModalSaida]   = useState(false);
  const [modalLimpar, setModalLimpar] = useState(false);
  const [form, setForm]               = useState({ categoria_id: '', valor: '', descricao: '' });
  const [loading, setLoading]         = useState(false);
  const [sucesso, setSucesso]         = useState('');

  const fetchData = () => {
    fetch(`/api/financeiro?inicio=${inicio}&fim=${fim}`)
      .then(r => r.json())
      .then(d => {
        if (d && typeof d === 'object') {
          setData(d);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('auth_user') || '{}');
        if (u.perfil === 'caixa') {
          window.location.href = '/mesa/';
          return;
        }
      } catch {}
    }
    fetchData();
  }, [inicio, fim]);

  const resumoArray = Array.isArray(data?.resumo) ? data.resumo : [];
  const entradas = Number(resumoArray.find(r => r.tipo === 'entrada')?.total) || 0;
  const saidas   = Number(resumoArray.find(r => r.tipo === 'saida')?.total) || 0;
  const resultado = entradas - saidas;

  async function salvarSaida() {
    if (!form.categoria_id || !form.valor || !form.descricao) return;
    setLoading(true);
    try {
      await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria_id: parseInt(form.categoria_id),
          valor: parseFloat(form.valor),
          descricao: form.descricao,
        }),
      });
      setModalSaida(false);
      setForm({ categoria_id: '', valor: '', descricao: '' });
      setSucesso('Lançamento registrado com sucesso!');
      setTimeout(() => setSucesso(''), 2500);
      fetchData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmarLimparFinanceiro() {
    setLoading(true);
    try {
      const res = await fetch('/api/financeiro/limpar', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao limpar financeiro');
      setModalLimpar(false);
      setSucesso(json.mensagem ?? 'Histórico financeiro limpo com sucesso!');
      setTimeout(() => setSucesso(''), 3500);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 bg-[#09090b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#18181b]/95 backdrop-blur border-b border-[#27272a] px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="font-bold text-base flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
              <IconDollar size={18} color="#f97316" />
            </div>
            <span>Fluxo de Caixa</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalLimpar(true)}
              className="bg-[#27272a] hover:bg-zinc-700 text-zinc-300 border border-[#3f3f46] hover:border-orange-500/40 text-xs px-2.5 py-2 rounded-xl font-medium active:scale-95 transition-all flex items-center gap-1.5"
              title="Limpar todos os lançamentos financeiros"
            >
              <IconBroom size={14} color="#f97316" />
              <span>Limpar</span>
            </button>
            <button
              onClick={() => setModalSaida(true)}
              className="bg-orange-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:bg-orange-600 flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              <IconPlus size={14} color="#ffffff" />
              <span>Lançar Saída</span>
            </button>
          </div>
        </div>

        {/* Seletor de período */}
        <div className="flex gap-2 items-center">
          <input
            type="date" value={inicio}
            onChange={e => setInicio(e.target.value)}
            className="flex-1 bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
          />
          <span className="text-zinc-500 text-xs">até</span>
          <input
            type="date" value={fim}
            onChange={e => setFim(e.target.value)}
            className="flex-1 bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500"
          />
        </div>
      </header>

      {/* Toast */}
      {sucesso && (
        <div className="mx-4 mt-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-xs text-center flex items-center justify-center gap-2 animate-fade-in font-bold">
          <IconCheck size={16} color="#34d399" />
          <span>{sucesso}</span>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">

        {/* ── Resumo do período ── */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-400">Entradas</span>
            <span className="text-lg font-bold text-emerald-400">{fmt(entradas)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-400">Saídas</span>
            <span className="text-lg font-bold text-red-400">- {fmt(saidas)}</span>
          </div>
          <div className="border-t border-[#27272a] pt-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-zinc-300">Resultado</span>
            <span className={`text-xl font-bold ${resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {resultado >= 0 ? '+' : ''}{fmt(resultado)}
            </span>
          </div>
        </div>

        {/* ── Por categoria ── */}
        {(Array.isArray(data?.porCategoria) && data.porCategoria.length > 0) && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4">
            <p className="text-sm font-semibold text-zinc-300 mb-3">Por categoria</p>
            <div className="space-y-2">
              {data.porCategoria.map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span>{cat.categoria}</span>
                  </span>
                  <span className={cat.tipo === 'entrada' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {cat.tipo === 'saida' ? '- ' : '+ '}{fmt(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Lançamentos ── */}
        <div>
          <p className="text-sm font-semibold text-zinc-300 mb-3">Lançamentos</p>
          {(!data?.lancamentos || data.lancamentos.length === 0) ? (
            <p className="text-xs text-zinc-600 text-center py-6">Nenhum lançamento no período</p>
          ) : (
            <div className="space-y-2">
              {data.lancamentos.map(l => (
                <div key={l.id} className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#27272a] flex items-center justify-center shrink-0 mt-0.5">
                      <IconReceipt size={16} color={l.tipo === 'entrada' ? '#34d399' : '#f87171'} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white leading-tight truncate font-medium">{l.descricao}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{l.categoria} · {formatDateBR(l.data_lancamento)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${l.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {l.tipo === 'entrada' ? '+' : '-'} {fmt(l.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Lançar Saída ── */}
      {modalSaida && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-[#27272a] rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-4">
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <IconDollar size={18} color="#f97316" />
              <span>Lançar Saída / Despesa</span>
            </h2>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Categoria</label>
              <select
                value={form.categoria_id}
                onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Selecione...</option>
                {CATEGORIAS_SAIDA.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Valor (R$)</label>
              <input
                type="number" step="0.01" inputMode="decimal"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Descrição</label>
              <input
                type="text"
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Compra de carvão 10kg"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalSaida(false)} className="px-4 py-3 bg-[#27272a] text-zinc-400 hover:text-white rounded-xl text-sm font-semibold">
                Cancelar
              </button>
              <button
                onClick={salvarSaida}
                disabled={loading || !form.categoria_id || !form.valor || !form.descricao}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvando...' : 'Confirmar Saída'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Limpar Histórico Financeiro */}
      {modalLimpar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-orange-500/30 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
              <IconBroom size={24} color="#f97316" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Limpar Histórico Financeiro?</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Esta ação irá excluir todos os lançamentos de entradas e saídas do Fluxo de Caixa.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setModalLimpar(false)}
                className="flex-1 py-2.5 bg-[#27272a] text-zinc-400 hover:text-white rounded-xl text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLimparFinanceiro}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold"
              >
                {loading ? 'Zerando...' : 'Sim, Limpar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdmNav active="financeiro" />
    </div>
  );
}

export default function FinanceiroPage() {
  return (
    <ErrorBoundary>
      <FinanceiroInner />
    </ErrorBoundary>
  );
}
