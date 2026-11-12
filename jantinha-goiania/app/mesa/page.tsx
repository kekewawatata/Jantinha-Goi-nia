'use client';
// app/mesa/page.tsx
// Fluxo moderno para garçom/atendimento:
// 1. Tela Inicial: Escolha da Mesa (ou Balcão)
//    - SLA Visual com timer de espera (verde ≤10min, amarelo ≤20min, vermelho >20min)
//    - Mesas Livres e Ocupadas em destaque visual moderno (preto e laranja)
//    - Ao clicar em Mesa Ocupada: Exibe comanda em aberto, histórico de itens consumidos, total atual
//    - Opção de "+ Adicionar Itens" (permite lançar mais pedidos para a mesma mesa)
//    - Opção de "Liberar Mesa / Fechar Conta" (recebe pagamento e libera a mesa no sistema)
// 2. Tela de Pedido: Adiciona novos itens à mesa selecionada
// 3. Ícones modernos SVG em laranja e preto (sem emojis)

import { useState, useEffect, useCallback, useRef, Component, ReactNode } from 'react';
import {
  IconMesa,
  IconBalcao,
  IconDashboard,
  IconEspetinho,
  IconJantinhaSimples,
  IconJantinhaCompleta,
  IconBebida,
  IconAdicional,
  IconTrash,
  IconCheck,
  IconPlus,
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
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Mesas & Pedidos</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar as mesas.</p>
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

function fmt(v: unknown): string {
  try {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',');
  } catch {
    return '0,00';
  }
}

// ─── Hook: relógio que atualiza a cada 30s para os timers de SLA ─────────────
function useNow() {
  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);
  return now;
}

// ─── Calcula SLA: cor, label de tempo e minutos decorridos ───────────────────
type SLATier = 'ok' | 'warning' | 'danger';
function getSLA(criadoEm: string, now: Date): { mins: number; tier: SLATier; label: string } {
  try {
    const created = new Date(criadoEm);
    const mins = Math.floor((now.getTime() - created.getTime()) / 60_000);
    if (mins < 0) return { mins: 0, tier: 'ok', label: '0 min' };
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${mins} min`;
    const tier: SLATier = mins >= 20 ? 'danger' : mins >= 10 ? 'warning' : 'ok';
    return { mins, tier, label };
  } catch {
    return { mins: 0, tier: 'ok', label: '-' };
  }
}

// Tailwind classes mapeadas por tier
const SLA_RING: Record<SLATier, string> = {
  ok:      'border-emerald-500   shadow-emerald-500/20',
  warning: 'border-yellow-400    shadow-yellow-400/20',
  danger:  'border-red-500       shadow-red-500/20',
};
const SLA_BADGE_BG: Record<SLATier, string> = {
  ok:      'bg-emerald-500/20 text-emerald-300',
  warning: 'bg-yellow-400/20  text-yellow-300',
  danger:  'bg-red-500/20     text-red-300',
};
const SLA_DOT: Record<SLATier, string> = {
  ok:      'bg-emerald-400',
  warning: 'bg-yellow-400',
  danger:  'bg-red-400 animate-pulse',
};
const SLA_TEXT: Record<SLATier, string> = {
  ok:      'text-emerald-400',
  warning: 'text-yellow-400',
  danger:  'text-red-400',
};

// ─── Tipos ───────────────────────────────────────────────────
interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string;
  categoria_icone: string;
  destino_producao: string;
}

interface ItemCarrinho {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  espetinho_escolhido_id?: string;
  espetinho_nome?: string;
  destino_producao: string;
}

interface ItemPedidoExistente {
  id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  espetinho_nome?: string;
  status_producao?: string;
}

interface PedidoAtivo {
  id: string;
  numero: number;
  tipo: string;
  mesa_numero: string | null;
  status: string;
  valor_total: number;
  forma_pagamento?: string;
  criado_em: string;
  itens: ItemPedidoExistente[];
}

// ─── Constantes ───────────────────────────────────────────────
const TOTAL_MESAS = 20;
const CATEGORIAS  = ['Espetinho', 'Jantinha Simples', 'Jantinha Completa', 'Bebida', 'Adicional'];
const CAT_LABEL: Record<string, string> = {
  'Espetinho':        'Espetos',
  'Jantinha Simples': 'Simples',
  'Jantinha Completa':'Completa',
  'Bebida':           'Bebidas',
  'Adicional':        'Extras',
};

function renderCatIcon(cat: string, active: boolean) {
  const color = active ? '#ffffff' : '#f97316';
  switch (cat) {
    case 'Espetinho': return <IconEspetinho size={16} color={color} />;
    case 'Jantinha Simples': return <IconJantinhaSimples size={16} color={color} />;
    case 'Jantinha Completa': return <IconJantinhaCompleta size={16} color={color} />;
    case 'Bebida': return <IconBebida size={16} color={color} />;
    case 'Adicional': return <IconAdicional size={16} color={color} />;
    default: return <IconAdicional size={16} color={color} />;
  }
}

const FORMAS_PAGAMENTO = [
  { id: 'dinheiro',        label: 'Dinheiro' },
  { id: 'pix',             label: 'PIX'      },
  { id: 'cartao_credito',  label: 'Crédito'  },
  { id: 'cartao_debito',   label: 'Débito'   },
  { id: 'fiado',           label: 'Fiado'    },
];

type Etapa = 'mesa' | 'pedido' | 'sucesso';

function MesaInner() {
  const now = useNow();
  const [etapa, setEtapa]               = useState<Etapa>('mesa');
  const [mesaSelecionada, setMesa]      = useState<string>('');

  // Produtos
  const [produtos, setProdutos]         = useState<Produto[]>([]);
  const [categoriaAtiva, setCat]        = useState('Espetinho');

  // Carrinho de novos itens
  const [carrinho, setCarrinho]         = useState<ItemCarrinho[]>([]);
  const [modalEspetinho, setModalEsp]   = useState<Produto | null>(null);

  // Pedidos ativos em aberto (mesas ocupadas)
  const [pedidosAtivos, setPedidosAtivos] = useState<PedidoAtivo[]>([]);

  // Modal comanda de mesa ocupada
  const [modalComandaMesa, setModalComandaMesa] = useState<string | null>(null);

  // Modal Fechamento/Pagamento para Liberar Mesa
  const [modalLiberar, setModalLiberar] = useState<PedidoAtivo | null>(null);
  const [formaPag, setFormaPag]         = useState('dinheiro');
  const [valorPago, setValorPago]       = useState('');
  const [loading, setLoading]           = useState(false);
  const [feedbackMsg, setFeedbackMsg]   = useState<string>('');

  // Perfil do usuário logado
  const [perfilUsuario, setPerfilUsuario] = useState<'adm' | 'caixa' | null>(null);

  const fetchPedidosAtivos = useCallback(() => {
    fetch('/api/pedidos?status=aberto,em_preparo,pronto')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPedidosAtivos(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('auth_user') || '{}');
        setPerfilUsuario(u.perfil || null);
      } catch {}
    }
    fetch('/api/produtos')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProdutos(d); })
      .catch(() => setProdutos([]));

    fetchPedidosAtivos();
    const interval = setInterval(fetchPedidosAtivos, 6000);
    return () => clearInterval(interval);
  }, [fetchPedidosAtivos]);

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_token');
      window.location.href = '/login/';
    }
  }

  // Mapa de pedidos ativos por mesa
  const pedidoPorMesa = new Map<string, PedidoAtivo>();
  pedidosAtivos.forEach(p => {
    if (p.mesa_numero) {
      pedidoPorMesa.set(String(p.mesa_numero), p);
    }
  });

  const espetinhos        = produtos.filter(p => p.categoria === 'Espetinho');
  const produtosFiltrados = produtos.filter(p => p.categoria === categoriaAtiva);
  const totalCarrinho     = carrinho.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);

  // ── Carrinho ─────────────────────────────────────────────────
  function adicionar(produto: Produto, espetinho?: Produto) {
    if (produto.categoria === 'Jantinha Completa' && !espetinho) {
      setModalEsp(produto);
      return;
    }
    setCarrinho(prev => {
      const idx = prev.findIndex(i =>
        i.produto_id === produto.id &&
        (i.espetinho_escolhido_id ?? '') === (espetinho?.id ?? '')
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 };
        return next;
      }
      return [...prev, {
        produto_id:            produto.id,
        produto_nome:          produto.nome,
        quantidade:            1,
        preco_unitario:        produto.preco_venda,
        espetinho_escolhido_id:espetinho?.id,
        espetinho_nome:        espetinho?.nome,
        destino_producao:      produto.destino_producao,
      }];
    });
  }

  function remover(idx: number) {
    setCarrinho(prev => {
      const next = [...prev];
      if (next[idx].quantidade > 1) {
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade - 1 };
      } else {
        next.splice(idx, 1);
      }
      return next;
    });
  }

  // ── Lançar pedido / Acrescentar itens na mesa ────────────────
  async function enviarPedido() {
    if (!mesaSelecionada || carrinho.length === 0) return;
    setLoading(true);
    try {
      const resPedido = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: mesaSelecionada === 'Balcão' ? 'balcao' : 'mesa',
          mesa_numero: mesaSelecionada === 'Balcão' ? '' : mesaSelecionada,
          itens: carrinho.map(i => ({
            produto_id:             i.produto_id,
            quantidade:             i.quantidade,
            preco_unitario:         i.preco_unitario,
            espetinho_escolhido_id: i.espetinho_escolhido_id,
            destino_producao:       i.destino_producao,
          })),
        }),
      });

      const pedidoData = await resPedido.json();
      if (!resPedido.ok) throw new Error(pedidoData.error ?? 'Erro ao lançar pedido');

      setCarrinho([]);
      setModalComandaMesa(null);
      setFeedbackMsg(`Pedido da Mesa ${mesaSelecionada} lançado para a produção!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
      setEtapa('mesa');
      setMesa('');
      fetchPedidosAtivos();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Liberar Mesa / Fechar Conta ──────────────────────────────
  async function confirmarLiberarMesa() {
    if (!modalLiberar) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pedidos/${modalLiberar.id}/liberar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalLiberar.id,
          mesa_numero: modalLiberar.mesa_numero,
          forma_pagamento: formaPag,
          valor_pago: parseFloat(valorPago) || modalLiberar.valor_total,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao liberar mesa');

      const mesaNum = modalLiberar.mesa_numero;
      setModalLiberar(null);
      setModalComandaMesa(null);
      setFeedbackMsg(`Mesa ${mesaNum} liberada e conta fechada com sucesso!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
      fetchPedidosAtivos();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════════
  // ETAPA 1 — GRADE DE MESAS & GESTÃO DE COMANDAS ABERTAS
  // ════════════════════════════════════════════════════════════
  if (etapa === 'mesa') {
    const pedidoSelecionado = modalComandaMesa ? pedidoPorMesa.get(modalComandaMesa) : null;

    return (
      <div className="min-h-screen pb-16 bg-[#09090b] text-white">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#18181b]/95 backdrop-blur border-b border-[#27272a] px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                <IconMesa size={20} color="#f97316" />
              </div>
              <div>
                <h1 className="font-bold text-base text-white">Atendimento de Mesas</h1>
                <p className="text-xs text-zinc-400">Selecione uma mesa para abrir ou gerenciar comanda</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {perfilUsuario === 'adm' && (
                <a
                  href="/adm/dashboard/"
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#27272a] text-orange-400 hover:text-white border border-[#3f3f46] flex items-center gap-1.5 active:bg-zinc-700 transition-colors"
                >
                  <IconDashboard size={14} color="#f97316" />
                  <span>Painel ADM</span>
                </a>
              )}
              <button
                onClick={logout}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#27272a] text-zinc-400 hover:text-red-400 border border-[#3f3f46] active:bg-zinc-700 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Feedback toast */}
        {feedbackMsg && (
          <div className="mx-4 mt-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2 animate-fade-in">
            <IconCheck size={16} color="#34d399" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="px-4 pt-4 space-y-5">
          {/* Opção Balcão / Para Viagem */}
          <button
            onClick={() => {
              setMesa('Balcão');
              setCarrinho([]);
              setEtapa('pedido');
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-orange-500/50 text-white font-bold text-sm flex items-center justify-between transition-all active:scale-98 shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                <IconBalcao size={20} color="#f97316" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Atendimento no Balcão</p>
                <p className="text-[11px] text-zinc-400">Cliente para viagem ou sem mesa fixa</p>
              </div>
            </div>
            <span className="text-xs text-orange-400 font-bold flex items-center gap-1">
              Novo Pedido →
            </span>
          </button>

          {/* Legenda de status */}
          <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-zinc-800 border border-zinc-700 inline-block" />
                Livre
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-orange-500/30 border border-orange-500 inline-block" />
                Ocupada
              </span>
            </div>
            <span className="text-[11px] text-zinc-500">Toque na mesa ocupada para ver itens</span>
          </div>

          {/* Legenda SLA */}
          <div className="flex items-center gap-3 px-1 text-[10px] text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> até 10 min
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> até 20 min
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" /> acima 20 min
            </span>
          </div>

          {/* Grade de Mesas */}
          <div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: TOTAL_MESAS }, (_, i) => i + 1).map(n => {
                const mesaStr = String(n);
                const pedidoAtivo = pedidoPorMesa.get(mesaStr);
                const ocupada = Boolean(pedidoAtivo);
                const sla = pedidoAtivo ? getSLA(pedidoAtivo.criado_em, now) : null;

                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      if (ocupada) {
                        setModalComandaMesa(mesaStr);
                      } else {
                        setMesa(mesaStr);
                        setCarrinho([]);
                        setEtapa('pedido');
                      }
                    }}
                    className={`aspect-square flex flex-col items-center justify-center rounded-2xl border-2 transition-all active:scale-95 shadow-md ${
                      ocupada && sla
                        ? `bg-[#18181b] ${SLA_RING[sla.tier]}`
                        : 'bg-[#18181b] border-[#27272a] hover:border-orange-500/50 text-white'
                    }`}
                  >
                    <span className={`text-xl font-black ${
                      ocupada && sla ? SLA_TEXT[sla.tier] : 'text-white'
                    }`}>
                      {n}
                    </span>
                    {ocupada && sla ? (
                      <>
                        <span className={`text-[9px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full flex items-center gap-1 ${SLA_BADGE_BG[sla.tier]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SLA_DOT[sla.tier]}`} />
                          {sla.label}
                        </span>
                        <span className="text-[8px] text-zinc-500 mt-0.5">
                          R$ {fmt(pedidoAtivo?.valor_total)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-500 mt-1">Livre</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Modal da Mesa Ocupada (Histórico, Adicionar Itens, Liberar) ── */}
        {modalComandaMesa && pedidoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-[#27272a] rounded-t-3xl w-full max-w-lg p-5 pb-8 space-y-4 max-h-[88vh] overflow-y-auto">
              <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />

              <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <IconMesa size={20} color="#f97316" />
                    <span>Mesa {modalComandaMesa}</span>
                  </h2>
                  <p className="text-xs text-orange-400 font-semibold mt-0.5">
                    Mesa Ocupada · Pedido #{pedidoSelecionado.numero}
                  </p>
                  {/* SLA no modal */}
                  {(() => {
                    const sla = getSLA(pedidoSelecionado.criado_em, now);
                    return (
                      <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${SLA_BADGE_BG[sla.tier]}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${SLA_DOT[sla.tier]}`} />
                        <span>Aguardando há {sla.label}</span>
                        {sla.tier === 'danger' && <span className="text-[10px] opacity-80">⚠ Atenção!</span>}
                      </div>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setModalComandaMesa(null)}
                  className="w-8 h-8 rounded-full bg-[#27272a] text-zinc-400 hover:text-white flex items-center justify-center"
                >
                  <IconClose size={16} />
                </button>
              </div>

              {/* Histórico dos itens consumidos na mesa */}
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Histórico de Pedidos desta Mesa:
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {pedidoSelecionado.itens && pedidoSelecionado.itens.length > 0 ? (
                    pedidoSelecionado.itens.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#27272a]/70 rounded-xl px-3.5 py-2.5 text-sm">
                        <div>
                          <p className="text-white font-medium">
                            {item.quantidade}× {item.produto_nome}
                          </p>
                          {item.espetinho_nome && (
                            <p className="text-xs text-orange-400 flex items-center gap-1">
                              <IconEspetinho size={12} color="#f97316" />
                              <span>{item.espetinho_nome}</span>
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-zinc-200">
                          R$ {fmt(item.preco_unitario * item.quantidade)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-3 text-center">Nenhum item listado</p>
                  )}
                </div>
              </div>

              {/* Total acumulado da comanda */}
              <div className="bg-[#27272a] rounded-2xl p-4 flex items-center justify-between border border-[#3f3f46]">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total da Conta</p>
                  <p className="text-xs text-zinc-500">Mesa {modalComandaMesa}</p>
                </div>
                <p className="text-2xl font-black text-orange-400">
                  R$ {fmt(pedidoSelecionado.valor_total)}
                </p>
              </div>

              {/* Ações da comanda */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMesa(modalComandaMesa);
                    setCarrinho([]);
                    setModalComandaMesa(null);
                    setEtapa('pedido');
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all"
                >
                  <IconPlus size={18} color="#ffffff" />
                  <span>+ Adicionar Mais Itens à Mesa {modalComandaMesa}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalLiberar(pedidoSelecionado);
                    setValorPago(String(pedidoSelecionado.valor_total));
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
                >
                  <IconReceipt size={18} color="#ffffff" />
                  <span>Fechar Conta e Liberar Mesa</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal de Fechamento / Pagamento para Liberar Mesa ── */}
        {modalLiberar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-orange-500/30 rounded-2xl w-full max-w-sm p-5 space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <IconReceipt size={24} color="#34d399" />
                </div>
                <h3 className="text-lg font-bold text-white">Fechar Conta — Mesa {modalLiberar.mesa_numero}</h3>
                <p className="text-2xl font-black text-orange-400 mt-1">
                  R$ {fmt(modalLiberar.valor_total)}
                </p>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-2 font-bold uppercase">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS_PAGAMENTO.map(fp => (
                    <button
                      key={fp.id}
                      type="button"
                      onClick={() => setFormaPag(fp.id)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                        formaPag === fp.id
                          ? 'bg-orange-500 text-white border border-orange-400 shadow-md'
                          : 'bg-[#27272a] text-zinc-300 border border-transparent'
                      }`}
                    >
                      {fp.label}
                    </button>
                  ))}
                </div>
              </div>

              {formaPag === 'dinheiro' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1 font-bold uppercase">Valor Recebido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorPago}
                    onChange={e => setValorPago(e.target.value)}
                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-2.5 text-white text-base font-bold focus:outline-none focus:border-orange-500"
                  />
                  {(parseFloat(valorPago) || 0) > modalLiberar.valor_total && (
                    <p className="text-xs text-emerald-400 font-bold mt-1">
                      Troco: R$ {fmt((parseFloat(valorPago) || 0) - modalLiberar.valor_total)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalLiberar(null)}
                  className="flex-1 py-3 bg-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarLiberarMesa}
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {loading ? 'Liberando...' : 'Confirmar e Liberar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ETAPA 2 — ADICIONAR / MONTAR PEDIDO PARA A MESA
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen pb-32 bg-[#09090b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#18181b]/95 backdrop-blur border-b border-[#27272a] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCarrinho([]);
                setEtapa('mesa');
              }}
              className="text-zinc-400 hover:text-white text-sm font-semibold flex items-center gap-1"
            >
              ← Mesas
            </button>
            <div>
              <h1 className="font-bold text-base text-white">
                {mesaSelecionada === 'Balcão' ? 'Balcão' : `Mesa ${mesaSelecionada}`}
              </h1>
              <p className="text-xs text-zinc-400">Adicione os itens ao pedido</p>
            </div>
          </div>
          <span className="text-base font-bold text-orange-400">
            R$ {fmt(totalCarrinho)}
          </span>
        </div>

        {/* Abas de categoria */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {CATEGORIAS.map(cat => {
            const ativo = categoriaAtiva === cat;
            return (
              <button
                key={cat}
                onClick={() => setCat(cat)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  ativo
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'bg-[#27272a] text-zinc-400 hover:text-zinc-200 border border-[#3f3f46]'
                }`}
              >
                {renderCatIcon(cat, ativo)}
                <span>{CAT_LABEL[cat]}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Carrinho de novos itens selecionados */}
      {carrinho.length > 0 && (
        <div className="mx-4 mt-3 bg-[#18181b] border border-[#27272a] rounded-2xl p-3.5 space-y-2 shadow-lg">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Itens a Lançar na {mesaSelecionada === 'Balcão' ? 'Comanda Balcão' : `Mesa ${mesaSelecionada}`}:
          </p>
          {carrinho.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white flex-1 leading-tight font-medium">
                {item.quantidade}× {item.produto_nome}
                {item.espetinho_nome && (
                  <span className="text-orange-400 text-xs flex items-center gap-1 mt-0.5">
                    <IconEspetinho size={12} color="#f97316" />
                    <span>{item.espetinho_nome}</span>
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-zinc-200 font-semibold">
                  R$ {fmt(item.preco_unitario * item.quantidade)}
                </span>
                <button
                  onClick={() => remover(idx)}
                  className="w-6 h-6 rounded-full bg-[#27272a] text-white flex items-center justify-center text-sm leading-none active:bg-red-500 transition-colors"
                >
                  −
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid de produtos do cardápio */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-3">
        {produtosFiltrados.map(p => (
          <button
            key={p.id}
            onClick={() => adicionar(p)}
            className="bg-[#18181b] border border-[#27272a] hover:border-orange-500/50 rounded-2xl p-4 text-left active:scale-95 transition-all shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-2.5">
              {renderCatIcon(p.categoria, false)}
            </div>
            <p className="text-sm font-bold text-white leading-tight">{p.nome}</p>
            <p className="text-orange-400 font-bold mt-1 text-sm">
              R$ {fmt(p.preco_venda)}
            </p>
          </button>
        ))}
      </div>

      {/* Barra inferior para confirmar e lançar para produção */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#18181b]/95 backdrop-blur border-t border-[#27272a] p-4 flex gap-3 z-40">
          <button
            onClick={() => setCarrinho([])}
            className="px-3 bg-[#27272a] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-xl flex items-center justify-center transition-colors"
            title="Limpar itens"
          >
            <IconTrash size={18} />
          </button>
          <button
            onClick={enviarPedido}
            disabled={loading}
            className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white text-base font-bold rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <IconCheck size={18} color="#ffffff" />
            <span>{loading ? 'Lançando...' : `Lançar para a Cozinha — R$ ${fmt(totalCarrinho)}`}</span>
          </button>
        </div>
      )}

      {/* Modal espetinho para jantinha completa */}
      {modalEspetinho && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setModalEsp(null)}
        >
          <div
            className="bg-[#18181b] border border-[#27272a] rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-3" />
            <h2 className="text-lg font-bold text-center text-white flex items-center justify-center gap-2">
              <IconJantinhaCompleta size={20} color="#f97316" />
              <span>Jantinha Completa</span>
            </h2>
            <p className="text-xs text-zinc-400 text-center mb-3">Escolha o espetinho acompanhante:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {espetinhos.map(esp => (
                <button
                  key={esp.id}
                  onClick={() => { adicionar(modalEspetinho, esp); setModalEsp(null); }}
                  className="w-full bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] rounded-xl px-4 py-3.5 text-white font-bold text-sm active:scale-98 flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <IconEspetinho size={16} color="#f97316" />
                    <span>{esp.nome}</span>
                  </span>
                  <span className="text-orange-400 text-xs font-semibold">incluso</span>
                </button>
              ))}
            </div>
            <button onClick={() => setModalEsp(null)} className="w-full py-3 bg-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-bold mt-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MesaPage() {
  return (
    <ErrorBoundary>
      <MesaInner />
    </ErrorBoundary>
  );
}
