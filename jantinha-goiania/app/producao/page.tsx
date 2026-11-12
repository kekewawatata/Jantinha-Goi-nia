'use client';
// app/producao/page.tsx — Tela de Produção (Churrasqueira + Cozinha) com ícones modernos em preto e laranja

import { useState, useEffect, useCallback, useRef, Component, ReactNode } from 'react';
import {
  IconFlame,
  IconAlert,
  IconCheck,
  IconRefresh,
  IconReceipt,
  IconJantinhaSimples,
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
            <IconFlame size={36} color="#f97316" />
          </div>
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Produção</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar a tela de produção.</p>
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

interface ItemPedido {
  id: string;
  produto_id: string;
  produto_nome: string;
  categoria: string;
  quantidade: number;
  preco_unitario: number;
  status_producao: string;
  destino_producao: string;
  espetinho_escolhido_id: string | null;
  espetinho_nome: string | null;
  observacao_item: string | null;
}

interface Pedido {
  id: string;
  numero: number;
  tipo: string;
  mesa_numero: string | null;
  status: string;
  valor_total: number;
  criado_em: string;
  itens: ItemPedido[];
}

type Tela = 'churrasqueira' | 'cozinha';

const STATUS_LABEL: Record<string, { label: string; next: string; nextLabel: string; color: string }> = {
  aguardando: { label: 'NOVO',       next: 'em_preparo', nextLabel: 'INICIAR',   color: 'badge-novo'    },
  em_preparo: { label: 'PREPARO',    next: 'pronto',     nextLabel: 'PRONTO ✓',  color: 'badge-preparo' },
  pronto:     { label: 'PRONTO',     next: 'entregue',   nextLabel: 'ENTREGUE',  color: 'badge-pronto'  },
  entregue:   { label: 'ENTREGUE',   next: '',           nextLabel: '',          color: 'badge-entregue'},
};

function horaRelativa(iso: string) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    const diffStr = diff < 1 ? 'agora' : `${diff}min atrás`;
    return `${hh}:${mm} (${diffStr})`;
  } catch {
    return iso;
  }
}

function ProducaoInner() {
  const [tela, setTela] = useState<Tela>('churrasqueira');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const destino = tela === 'churrasqueira' ? 'churrasqueira' : 'cozinha';

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedidos?status=em_preparo,pronto&destino=${destino}`);
      const data = await res.json();
      if (Array.isArray(data)) setPedidos(data);
      else setPedidos([]);
    } catch {
      setPedidos([]);
    }
  }, [destino]);

  useEffect(() => {
    fetchPedidos();
    intervalRef.current = setInterval(fetchPedidos, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPedidos]);

  async function avancarStatus(pedidoId: string, itemId: string, proximoStatus: string) {
    if (!proximoStatus) return;
    setLoading(true);
    try {
      await fetch(`/api/pedidos/${pedidoId}/item/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_producao: proximoStatus }),
      });
      await fetchPedidos();
    } catch (e) {
      alert('Erro ao atualizar status: ' + e);
    } finally {
      setLoading(false);
    }
  }

  function itensFiltrados(pedido: Pedido): ItemPedido[] {
    return (pedido.itens || []).filter(item => {
      if (tela === 'churrasqueira') {
        return item.destino_producao === 'churrasqueira';
      }
      return item.destino_producao === 'cozinha';
    });
  }

  function espetinhoEstaPronto(pedido: Pedido, itemJantinha: ItemPedido): boolean {
    if (!itemJantinha.espetinho_escolhido_id) return true;
    const espeto = (pedido.itens || []).find(
      i => i.produto_id === itemJantinha.espetinho_escolhido_id &&
           i.destino_producao === 'churrasqueira'
    );
    if (!espeto) return true;
    return espeto.status_producao === 'pronto' || espeto.status_producao === 'entregue';
  }

  const pedidosComItens = pedidos.filter(p => itensFiltrados(p).length > 0);

  return (
    <div className="min-h-screen pb-20 bg-[#09090b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#18181b]/95 backdrop-blur border-b border-[#27272a]">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-bold text-lg flex items-center gap-2">
            {tela === 'churrasqueira' ? (
              <>
                <IconFlame size={20} color="#f97316" />
                <span>Churrasqueira</span>
              </>
            ) : (
              <>
                <IconJantinhaSimples size={20} color="#f97316" />
                <span>Montagem / Cozinha</span>
              </>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 bg-[#27272a] px-2.5 py-1 rounded-lg font-semibold">
              {pedidosComItens.length} pedidos
            </span>
            <button
              onClick={fetchPedidos}
              className="w-9 h-9 flex items-center justify-center bg-[#27272a] rounded-lg text-zinc-400 hover:text-white active:bg-zinc-700 transition-colors"
              title="Atualizar"
            >
              <IconRefresh size={16} />
            </button>
          </div>
        </div>

        {/* Alternância de tela */}
        <div className="flex px-4 pb-3 gap-2">
          <button
            onClick={() => setTela('churrasqueira')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              tela === 'churrasqueira' ? 'bg-orange-500 text-white shadow-md' : 'bg-[#27272a] text-zinc-400 hover:text-white'
            }`}
          >
            <IconFlame size={16} color={tela === 'churrasqueira' ? '#ffffff' : '#f97316'} />
            <span>Churrasqueira</span>
          </button>
          <button
            onClick={() => setTela('cozinha')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              tela === 'cozinha' ? 'bg-orange-500 text-white shadow-md' : 'bg-[#27272a] text-zinc-400 hover:text-white'
            }`}
          >
            <IconJantinhaSimples size={16} color={tela === 'cozinha' ? '#ffffff' : '#f97316'} />
            <span>Cozinha</span>
          </button>
        </div>
      </header>

      {/* Lista de pedidos */}
      <div className="px-4 pt-4 space-y-4">
        {pedidosComItens.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto mb-3 text-orange-400">
              {tela === 'churrasqueira' ? <IconFlame size={24} color="#f97316" /> : <IconJantinhaSimples size={24} color="#f97316" />}
            </div>
            <p className="text-sm font-medium">Nenhum pedido em aberto na produção</p>
          </div>
        ) : (
          pedidosComItens.map(pedido => {
            const itens = itensFiltrados(pedido);
            const tempoStr = horaRelativa(pedido.criado_em);

            return (
              <div key={pedido.id} className="card space-y-3 bg-[#18181b] border border-[#27272a] rounded-2xl p-4">
                {/* Cabeçalho do pedido */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-white">#{pedido.numero}</span>
                    {pedido.mesa_numero && (
                      <span className="ml-2 text-xs text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 rounded font-semibold">
                        Mesa {pedido.mesa_numero}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">{tempoStr}</span>
                </div>

                <div className="border-t border-[#27272a]" />

                {/* Itens */}
                {itens.map(item => {
                  const st = STATUS_LABEL[item.status_producao] ?? STATUS_LABEL.aguardando;
                  const jantinhaCompleta = item.categoria === 'Jantinha Completa';
                  const espPronto = jantinhaCompleta ? espetinhoEstaPronto(pedido, item) : true;

                  return (
                    <div key={item.id} className="bg-[#27272a]/60 rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-white text-sm">
                            {item.quantidade}× {item.produto_nome}
                          </p>
                          {/* Para cozinha: mostra qual espetinho está aguardando */}
                          {jantinhaCompleta && item.espetinho_nome && (
                            <p className={`text-xs mt-0.5 ${espPronto ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {espPronto ? 'Espeto: PRONTO' : `Aguardando: ${item.espetinho_nome}`}
                            </p>
                          )}
                          {/* Para churrasqueira: identifica se é de jantinha */}
                          {item.categoria === 'Jantinha Completa' && tela === 'churrasqueira' && (
                            <p className="text-xs text-zinc-500 mt-0.5">da Jantinha Completa</p>
                          )}
                          {item.observacao_item && (
                            <p className="text-xs text-yellow-400 mt-0.5 flex items-center gap-1">
                              <IconAlert size={12} color="#facc15" />
                              <span>{item.observacao_item}</span>
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg border font-semibold ${st.color}`}>
                          {st.label}
                        </span>
                      </div>

                      {/* Botão de avanço de status */}
                      {st.nextLabel && (
                        <button
                          onClick={() => avancarStatus(pedido.id, item.id, st.next)}
                          disabled={loading || (jantinhaCompleta && tela === 'cozinha' && item.status_producao === 'em_preparo' && !espPronto)}
                          className={`w-full py-3 rounded-xl font-bold text-sm transition-all
                            ${loading || (jantinhaCompleta && tela === 'cozinha' && item.status_producao === 'em_preparo' && !espPronto)
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : item.status_producao === 'em_preparo'
                                ? 'bg-emerald-600 text-white active:bg-emerald-500 shadow-md'
                                : item.status_producao === 'aguardando'
                                  ? 'bg-orange-500 text-white active:bg-orange-600 shadow-md'
                                  : 'bg-zinc-700 text-zinc-300 active:bg-zinc-600'
                            }`}
                        >
                          {jantinhaCompleta && tela === 'cozinha' && item.status_producao === 'em_preparo' && !espPronto
                            ? 'Aguardando espetinho da brasa...'
                            : st.nextLabel
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom nav */}
      <nav className="nav-bottom">
        <button onClick={() => setTela('churrasqueira')} className={`nav-item ${tela === 'churrasqueira' ? 'active' : ''}`}>
          <IconFlame size={20} color={tela === 'churrasqueira' ? '#f97316' : '#71717a'} />
          <span>Brasa</span>
        </button>
        <button onClick={() => setTela('cozinha')} className={`nav-item ${tela === 'cozinha' ? 'active' : ''}`}>
          <IconJantinhaSimples size={20} color={tela === 'cozinha' ? '#f97316' : '#71717a'} />
          <span>Cozinha</span>
        </button>
        <a href="/pdv" className="nav-item">
          <IconReceipt size={20} color="#71717a" />
          <span>PDV</span>
        </a>
      </nav>
    </div>
  );
}

export default function ProducaoPage() {
  return (
    <ErrorBoundary>
      <ProducaoInner />
    </ErrorBoundary>
  );
}
