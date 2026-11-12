'use client';
// app/adm/estoque/page.tsx — Gestão de Estoque ADM + Sugestão Inteligente de Compras

import { useState, useEffect, Component, ReactNode } from 'react';
import { formatDateBR } from '@/lib/utils';
import AdmNav from '@/app/components/AdmNav';
import { IconBox, IconBroom, IconPlus, IconCheck, IconAlert, IconTrash } from '@/app/components/Icons';

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
            <IconBox size={36} color="#f97316" />
          </div>
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Estoque</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar os dados de estoque.</p>
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

interface Insumo {
  id: string;
  nome: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  fator_rendimento: number;
  perecivel: number;
  unidade: string;
  status_estoque: 'zerado' | 'critico' | 'baixo' | 'ok';
}

const STATUS_CONFIG = {
  zerado:  { label: 'ZERADO',   cor: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'    },
  critico: { label: 'CRÍTICO',  cor: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  baixo:   { label: 'BAIXO',    cor: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  ok:      { label: 'OK',       cor: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const FILTROS = ['todos', 'zerado', 'critico', 'baixo', 'ok'] as const;
const FILTRO_LABEL: Record<string, string> = {
  todos: 'Todos', zerado: 'Zerado', critico: 'Crítico', baixo: 'Baixo', ok: 'OK'
};

// ─── Tipos para Sugestão de Compras ────────────────────────────────────────
interface SugestaoItem {
  id: string;
  nome: string;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  consumo_medio_dia: number;
  dias_restantes: number | null;
  quantidade_sugerida: number;
  custo_estimado: number;
  urgencia: 'critico' | 'alto' | 'medio' | 'baixo';
}

interface SugestaoResp {
  periodo_dias: number;
  total_estimado: number;
  itens: SugestaoItem[];
}

const URGENCIA_CONFIG = {
  critico: { label: 'CRÍTICO',  badgeBg: 'bg-red-500/20 text-red-300',       border: 'border-red-500/40',      dot: 'bg-red-400 animate-pulse' },
  alto:    { label: 'URGENTE',   badgeBg: 'bg-orange-500/20 text-orange-300',  border: 'border-orange-500/40',   dot: 'bg-orange-400' },
  medio:   { label: 'ATÉ 7 DIAS', badgeBg: 'bg-yellow-400/20 text-yellow-300',  border: 'border-yellow-400/30',   dot: 'bg-yellow-400' },
  baixo:   { label: 'REABASTECER', badgeBg: 'bg-blue-500/20 text-blue-300',    border: 'border-blue-500/30',     dot: 'bg-blue-400' },
};

type Aba = 'estoque' | 'sugestao';

function EstoqueInner() {
  const [aba, setAba]                   = useState<Aba>('estoque');
  const [insumos, setInsumos]           = useState<Insumo[]>([]);
  const [filtro, setFiltro]             = useState<string>('todos');

  // Sugestão de Compras
  const [sugestao, setSugestao]         = useState<SugestaoResp | null>(null);
  const [loadingSug, setLoadingSug]     = useState(false);
  const [periodoSug, setPeriodoSug]     = useState<7 | 15>(7);
  const [erroSug, setErroSug]           = useState('');
  
  // Modais
  const [modalNovo, setModalNovo]       = useState(false);
  const [modalEntrada, setModalEntrada] = useState<Insumo | null>(null);
  const [modalLimpar, setModalLimpar]   = useState(false);
  const [insumoParaRemover, setInsumoParaRemover] = useState<Insumo | null>(null);

  // Formulário: Nova Entrada para produto existente
  const [formEntrada, setFormEntrada]   = useState({ quantidade: '', custo_total: '', fornecedor: '', nota_fiscal: '', data_validade: '' });

  // Formulário: Novo Produto no estoque
  const [formNovo, setFormNovo]         = useState({
    nome: '',
    quantidade: '',
    custo_total: '',
    estoque_minimo: '5',
    fornecedor: '',
  });

  const [loading, setLoading]           = useState(false);
  const [sucesso, setSucesso]           = useState('');
  const [erro, setErro]                 = useState('');

  const fetchEstoque = () => {
    fetch('/api/estoque')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setInsumos(data);
      })
      .catch(() => {});
  };

  const fetchSugestao = (dias: 7 | 15) => {
    setLoadingSug(true);
    setErroSug('');
    fetch(`/api/estoque/sugestao-compras?dias=${dias}`)
      .then(r => r.json())
      .then(data => setSugestao(data))
      .catch(() => setErroSug('Erro ao carregar sugestões.'))
      .finally(() => setLoadingSug(false));
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
    fetchEstoque();
    fetchSugestao(7);
  }, []);

  const filtrados = insumos.filter(i => filtro === 'todos' || i.status_estoque === filtro);
  const criticos  = insumos.filter(i => i.status_estoque === 'zerado' || i.status_estoque === 'critico').length;

  function showMsg(msg: string, isError = false) {
    if (isError) {
      setErro(msg);
      setTimeout(() => setErro(''), 3500);
    } else {
      setSucesso(msg);
      setTimeout(() => setSucesso(''), 3500);
    }
  }

  // ── Salvar entrada em produto existente ─────────────────────────
  async function salvarEntrada() {
    if (!modalEntrada || !formEntrada.quantidade || !formEntrada.custo_total) return;
    setLoading(true);
    try {
      const res = await fetch('/api/estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insumo_id:    modalEntrada.id,
          quantidade:   parseFloat(formEntrada.quantidade),
          custo_total:  parseFloat(formEntrada.custo_total),
          fornecedor:   formEntrada.fornecedor || undefined,
          nota_fiscal:  formEntrada.nota_fiscal || undefined,
          data_validade:formEntrada.data_validade || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao dar entrada');

      setModalEntrada(null);
      setFormEntrada({ quantidade: '', custo_total: '', fornecedor: '', nota_fiscal: '', data_validade: '' });
      showMsg(`Entrada de ${modalEntrada.nome} registrada! Despesa de R$ ${parseFloat(formEntrada.custo_total).toFixed(2)} lançada no financeiro.`);
      fetchEstoque();
    } catch (e: any) {
      showMsg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  // ── Cadastrar novo produto no estoque (despesa no financeiro) ────
  async function salvarNovoProduto() {
    if (!formNovo.nome || !formNovo.quantidade || formNovo.custo_total === '') {
      showMsg('Preencha nome, quantidade e custo total.', true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/estoque/novo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNovo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar produto');

      setModalNovo(false);
      setFormNovo({
        nome: '',
        quantidade: '',
        custo_total: '',
        estoque_minimo: '5',
        fornecedor: '',
      });
      showMsg(data.mensagem ?? 'Produto adicionado e despesa contabilizada no financeiro!');
      fetchEstoque();
    } catch (e: any) {
      showMsg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  // ── Limpar todo o estoque ───────────────────────────────────────
  async function confirmarLimparEstoque() {
    setLoading(true);
    try {
      const res = await fetch('/api/estoque/limpar', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao limpar estoque');

      setModalLimpar(false);
      showMsg('Estoque limpo com sucesso! Todas as quantidades foram zeradas.');
      fetchEstoque();
    } catch (e: any) {
      showMsg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  // ── Remover insumo do estoque ───────────────────────────────────
  async function confirmarRemoverInsumo() {
    if (!insumoParaRemover) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/estoque?id=${insumoParaRemover.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao remover insumo');

      showMsg(data.mensagem ?? 'Insumo removido com sucesso!');
      setInsumoParaRemover(null);
      fetchEstoque();
    } catch (e: any) {
      showMsg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h1 className="font-bold text-base flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Controle de Estoque
            </h1>
            <p className="text-xs text-zinc-400">Medido 100% em unidades (un)</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Limpar Estoque */}
            <button
              onClick={() => setModalLimpar(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-orange-500/40 text-xs px-2.5 py-2 rounded-xl font-medium active:scale-95 transition-all flex items-center gap-1.5"
              title="Zerar todas as quantidades de estoque"
            >
              <IconBroom size={14} color="#f97316" />
              <span>Limpar</span>
            </button>

            {/* Botão Novo Produto */}
            <button
              onClick={() => setModalNovo(true)}
              className="bg-orange-500 text-white text-xs px-3 py-2 rounded-xl font-bold active:bg-orange-600 active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
            >
              <IconPlus size={14} color="#ffffff" />
              <span>Adicionar Produto</span>
            </button>
          </div>
        </div>

        {/* Abas: Estoque | Sugestão de Compras */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setAba('estoque')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              aba === 'estoque' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200'
            }`}
          >
            📦 Estoque Atual
            {criticos > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{criticos}</span>
            )}
          </button>
          <button
            onClick={() => { setAba('sugestao'); if (!sugestao) fetchSugestao(periodoSug); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              aba === 'sugestao' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200'
            }`}
          >
            📊 Sugestão de Compras
          </button>
        </div>

        {/* Filtros da aba Estoque */}
        {aba === 'estoque' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTROS.map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === f ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {FILTRO_LABEL[f]}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Alertas e Toasts */}
      {sucesso && (
        <div className="mx-4 mt-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-400 text-xs font-medium text-center flex items-center justify-center gap-2 animate-fade-in">
          <IconCheck size={16} />
          <span>{sucesso}</span>
        </div>
      )}
      {erro && (
        <div className="mx-4 mt-3 bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3 text-red-400 text-xs font-medium text-center flex items-center justify-center gap-2 animate-fade-in">
          <IconAlert size={16} />
          <span>{erro}</span>
        </div>
      )}

      {/* ════ ABA: ESTOQUE ATUAL ════════════════════════════════════ */}
      {aba === 'estoque' && (
        <div className="px-4 pt-4 space-y-2.5">
          {filtrados.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-3 text-orange-400">
                <IconBox size={24} color="#f97316" />
              </div>
              <p className="text-sm font-medium">Nenhum item com este filtro</p>
              <button
                onClick={() => setModalNovo(true)}
                className="mt-4 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-2 rounded-xl font-semibold hover:bg-orange-500/20 transition-all inline-flex items-center gap-1.5"
              >
                <IconPlus size={13} color="#f97316" />
                <span>Cadastrar Produto no Estoque</span>
              </button>
            </div>
          ) : (
            filtrados.map(ins => {
              const cfg = STATUS_CONFIG[ins.status_estoque as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ok;
              const maxRef = Math.max((ins.estoque_minimo || 5) * 2, 10);
              const pct = Math.min(100, (ins.estoque_atual / maxRef) * 100);

              return (
                <div key={ins.id} className={`card border ${cfg.bg} transition-all`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.cor}`}>
                          {cfg.label}
                        </span>
                      </div>
                      
                      <p className="font-bold text-white text-sm leading-tight truncate">
                        {ins.nome}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-400">
                        <span className={`font-semibold ${cfg.cor}`}>
                          Atual: {Math.round(ins.estoque_atual)} un
                        </span>
                        <span>Mín: {Math.round(ins.estoque_minimo)} un</span>
                        <span>R$ {(Number(ins.custo_unitario) || 0).toFixed(2).replace('.', ',')} / un</span>
                      </div>

                      {/* Barra de progresso */}
                      <div className="mt-2.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            ins.status_estoque === 'zerado'  ? 'bg-red-500' :
                            ins.status_estoque === 'critico' ? 'bg-orange-500' :
                            ins.status_estoque === 'baixo'   ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Botões de Ação (+ Entrada e Remover) */}
                    <div className="flex items-center gap-1.5 shrink-0 mt-1">
                      <button
                        onClick={() => {
                          setModalEntrada(ins);
                          setFormEntrada({ quantidade: '', custo_total: '', fornecedor: '', nota_fiscal: '', data_validade: '' });
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs px-3 py-2 rounded-xl active:bg-zinc-600 font-semibold transition-all inline-flex items-center gap-1"
                      >
                        <IconPlus size={12} color="#f97316" />
                        <span>Entrada</span>
                      </button>
                      <button
                        onClick={() => setInsumoParaRemover(ins)}
                        className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700/60 flex items-center justify-center text-xs active:scale-95 transition-all"
                        title="Remover insumo do estoque"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════ ABA: SUGESTÃO DE COMPRAS ═════════════════════════════ */}
      {aba === 'sugestao' && (
        <div className="px-4 pt-4 space-y-3">

          {/* Seletor de período */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Período de análise</p>
            <div className="flex gap-2">
              {([7, 15] as const).map(d => (
                <button
                  key={d}
                  onClick={() => {
                    setPeriodoSug(d);
                    fetchSugestao(d);
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    periodoSug === d
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>

          {/* Total estimado */}
          {sugestao && !loadingSug && (
            <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Investimento estimado</p>
                <p className="text-xs text-zinc-500 mt-0.5">Baseado nos últimos {sugestao.periodo_dias} dias de consumo</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-orange-400">
                  R$ {sugestao.total_estimado.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[10px] text-zinc-500">{sugestao.itens.length} itens para comprar</p>
              </div>
            </div>
          )}

          {/* Estado de loading */}
          {loadingSug && (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-zinc-500">Calculando sugestões...</p>
            </div>
          )}

          {erroSug && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3 text-red-400 text-xs font-medium text-center">
              {erroSug}
            </div>
          )}

          {/* Lista de sugestões */}
          {!loadingSug && sugestao && sugestao.itens.length === 0 && (
            <div className="text-center py-16 text-zinc-500">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-bold text-emerald-400">Estoque bem abastecido!</p>
              <p className="text-xs text-zinc-500 mt-1">Nenhum item precisa de recompra nos próximos dias.</p>
            </div>
          )}

          {!loadingSug && sugestao && sugestao.itens.map(item => {
            const urg = URGENCIA_CONFIG[item.urgencia];
            return (
              <div key={item.id} className={`bg-[#18181b] border ${urg.border} rounded-2xl p-4 transition-all`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${urg.badgeBg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${urg.dot}`} />
                        {urg.label}
                      </span>
                    </div>
                    <p className="font-bold text-white text-sm leading-tight truncate">{item.nome}</p>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-zinc-400">
                      <span>Atual: <span className="text-white font-semibold">{item.estoque_atual} {item.unidade}</span></span>
                      <span>Mínimo: <span className="text-zinc-300 font-medium">{item.estoque_minimo} {item.unidade}</span></span>
                      {item.consumo_medio_dia > 0 && (
                        <span>Consumo: <span className="text-zinc-300 font-medium">{item.consumo_medio_dia} {item.unidade}/dia</span></span>
                      )}
                      {item.dias_restantes !== null ? (
                        <span className={`font-semibold ${
                          item.dias_restantes <= 1 ? 'text-red-400' :
                          item.dias_restantes <= 3 ? 'text-orange-400' :
                          item.dias_restantes <= 7 ? 'text-yellow-400' : 'text-zinc-300'
                        }`}>
                          {item.dias_restantes === 0 ? 'Esgota hoje' : `${item.dias_restantes} dias restantes`}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Sem consumo registrado</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-base font-black text-orange-400">{item.quantidade_sugerida} {item.unidade}</p>
                    <p className="text-[11px] text-zinc-500">R$ {item.custo_estimado.toFixed(2).replace('.', ',')}</p>
                    <button
                      onClick={() => {
                        const ins = insumos.find(i => i.id === item.id);
                        if (ins) {
                          setModalEntrada(ins);
                          setFormEntrada({
                            quantidade: String(item.quantidade_sugerida),
                            custo_total: '',
                            fornecedor: '',
                            nota_fiscal: '',
                            data_validade: '',
                          });
                          setAba('estoque');
                        }
                      }}
                      className="mt-2 bg-orange-500/15 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 inline-flex items-center gap-1"
                    >
                      <IconPlus size={11} color="#f97316" />
                      Dar Entrada
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dica */}
          {!loadingSug && sugestao && sugestao.itens.length > 0 && (
            <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-xs text-zinc-500 leading-relaxed">
              💡 <span className="font-medium text-zinc-400">Como funciona:</span> Calculamos o consumo médio diário dos últimos {sugestao.periodo_dias} dias e estimamos quantos dias de estoque restam. Itens abaixo do mínimo ou com menos de 7 dias de cobertura são exibidos aqui.
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL: NOVO PRODUTO NO ESTOQUE (Com despesa no financeiro) */}
      {/* ════════════════════════════════════════════════════════════ */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-t-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Adicionar ao Estoque</h2>
                <p className="text-xs text-zinc-400">A despesa será lançada automaticamente no financeiro</p>
              </div>
              <button onClick={() => setModalNovo(false)} className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-400 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* Nome */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1 font-medium">Nome do Produto / Insumo *</label>
                <input
                  type="text"
                  value={formNovo.nome}
                  onChange={e => setFormNovo(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Espetinho de Cupim, Carvão..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Quantidade e Custo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1 font-medium">Quantidade (un) *</label>
                  <input
                    type="number" step="1" min="1" inputMode="numeric"
                    value={formNovo.quantidade}
                    onChange={e => setFormNovo(p => ({ ...p, quantidade: e.target.value }))}
                    placeholder="Ex: 50"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 text-white text-sm focus:outline-none focus:border-orange-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1 font-medium">Custo Total (R$) *</label>
                  <input
                    type="number" step="0.01" inputMode="decimal"
                    value={formNovo.custo_total}
                    onChange={e => setFormNovo(p => ({ ...p, custo_total: e.target.value }))}
                    placeholder="Ex: 150.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 text-white text-sm focus:outline-none focus:border-orange-500 font-bold text-orange-400"
                  />
                </div>
              </div>

              {/* Custo unitário calculado */}
              {parseFloat(formNovo.quantidade) > 0 && parseFloat(formNovo.custo_total) >= 0 && (
                <div className="bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Custo por unidade:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    R$ {(parseFloat(formNovo.custo_total) / parseFloat(formNovo.quantidade)).toFixed(2).replace('.', ',')} / un
                  </span>
                </div>
              )}

              {/* Estoque Mínimo */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1 font-medium">Estoque Mínimo para Alerta (un)</label>
                <input
                  type="number" step="1"
                  value={formNovo.estoque_minimo}
                  onChange={e => setFormNovo(p => ({ ...p, estoque_minimo: e.target.value }))}
                  placeholder="Ex: 10"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none"
                />
              </div>

              {/* Fornecedor */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1 font-medium">Fornecedor (opcional)</label>
                <input
                  type="text"
                  value={formNovo.fornecedor}
                  onChange={e => setFormNovo(p => ({ ...p, fornecedor: e.target.value }))}
                  placeholder="Ex: Distribuidora Central"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setModalNovo(false)} className="btn-ghost flex-none px-4">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovoProduto}
                disabled={loading || !formNovo.nome || !formNovo.quantidade || formNovo.custo_total === ''}
                className="btn-success flex-1 disabled:opacity-50 font-bold"
              >
                {loading ? 'Salvando...' : 'Salvar e Contabilizar'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL: REGISTRAR ENTRADA (PRODUTO EXISTENTE)              */}
      {/* ════════════════════════════════════════════════════════════ */}
      {modalEntrada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />
            
            <div>
              <h2 className="text-base font-bold text-white">+ Entrada de Estoque (Compra)</h2>
              <p className="text-sm font-bold text-orange-400">{modalEntrada.nome}</p>
              <p className="text-xs text-zinc-400 mt-0.5">Essa despesa será lançada no Fluxo de Caixa</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Quantidade (unidades) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  value={formEntrada.quantidade}
                  onChange={e => setFormEntrada(p => ({ ...p, quantidade: e.target.value }))}
                  placeholder="Ex: 20"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Custo Total (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formEntrada.custo_total}
                  onChange={e => setFormEntrada(p => ({ ...p, custo_total: e.target.value }))}
                  placeholder="Ex: 100.00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500 font-bold text-orange-400"
                />
              </div>
            </div>

            {parseFloat(formEntrada.quantidade) > 0 && parseFloat(formEntrada.custo_total) >= 0 && (
              <p className="text-xs text-emerald-400 font-medium">
                Custo unitário: R$ {(parseFloat(formEntrada.custo_total) / parseFloat(formEntrada.quantidade)).toFixed(2).replace('.', ',')} / un
              </p>
            )}

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Fornecedor (opcional)</label>
              <input
                type="text"
                value={formEntrada.fornecedor}
                onChange={e => setFormEntrada(p => ({ ...p, fornecedor: e.target.value }))}
                placeholder="Ex: Distribuidor ABC"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalEntrada(null)} className="btn-ghost flex-none px-4">
                Cancelar
              </button>
              <button
                onClick={salvarEntrada}
                disabled={loading || !formEntrada.quantidade || !formEntrada.custo_total}
                className="btn-success flex-1 disabled:opacity-50 font-bold"
              >
                {loading ? 'Salvando...' : 'Confirmar Entrada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL: LIMPAR ESTOQUE                                      */}
      {/* ════════════════════════════════════════════════════════════ */}
      {modalLimpar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-orange-500/30 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
              <IconBroom size={24} color="#f97316" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-white">Limpar Estoque?</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Esta ação irá **zerar a quantidade atual** de todos os produtos do estoque.
                Os cadastros de produtos serão mantidos para você reabastecer quando quiser.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setModalLimpar(false)}
                className="btn-ghost flex-1 py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLimparEstoque}
                disabled={loading}
                className="btn-danger flex-1 py-2.5 text-sm font-bold"
              >
                {loading ? 'Zerando...' : 'Sim, Zerar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODAL: REMOVER INSUMO                                      */}
      {/* ════════════════════════════════════════════════════════════ */}
      {insumoParaRemover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <IconTrash size={24} color="#f87171" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-white">Remover Insumo?</h3>
              <p className="text-sm font-bold text-orange-400 mt-1">{insumoParaRemover.nome}</p>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Este insumo será removido do controle de estoque e suas fichas técnicas associadas.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setInsumoParaRemover(null)}
                className="btn-ghost flex-1 py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRemoverInsumo}
                disabled={loading}
                className="btn-danger flex-1 py-2.5 text-sm font-bold"
              >
                {loading ? 'Removendo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdmNav active="estoque" />
    </div>
  );
}

export default function EstoquePage() {
  return (
    <ErrorBoundary>
      <EstoqueInner />
    </ErrorBoundary>
  );
}
