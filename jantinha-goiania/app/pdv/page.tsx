'use client';
// app/pdv/page.tsx — PDV Fast (Caixa)

import { useState, useEffect, useCallback, Component, ReactNode } from 'react';

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
            <IconReceipt size={36} color="#f97316" />
          </div>
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>PDV / Caixa</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar o sistema de PDV.</p>
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
import {
  IconReceipt,
  IconTable,
  IconSkewer,
  IconBowl,
  IconPlate,
  IconCup,
  IconPlusCircle,
  IconTrash,
  IconCheck,
} from '@/app/components/Icons';

function fmt(v: unknown): string {
  try {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',');
  } catch {
    return '0,00';
  }
}

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

const CATEGORIAS = ['Espetinho', 'Jantinha Simples', 'Jantinha Completa', 'Bebida', 'Adicional'];
const CAT_LABEL: Record<string, string> = {
  'Espetinho': 'Espetos',
  'Jantinha Simples': 'Simples',
  'Jantinha Completa': 'Completa',
  'Bebida': 'Bebidas',
  'Adicional': 'Extras',
};

function renderCatIcon(cat: string, active: boolean) {
  const color = active ? '#ffffff' : '#f97316';
  switch (cat) {
    case 'Espetinho': return <IconSkewer size={16} color={color} />;
    case 'Jantinha Simples': return <IconBowl size={16} color={color} />;
    case 'Jantinha Completa': return <IconPlate size={16} color={color} />;
    case 'Bebida': return <IconCup size={16} color={color} />;
    case 'Adicional': return <IconPlusCircle size={16} color={color} />;
    default: return null;
  }
}

function PDVInner() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Espetinho');
  const [tipoPedido, setTipoPedido] = useState<'balcao' | 'mesa'>('balcao');
  const [mesaNumero, setMesaNumero] = useState('');
  const [modalEspetinho, setModalEspetinho] = useState<Produto | null>(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [formaPag, setFormaPag] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [loading, setLoading] = useState(false);
  const [pedidoSucesso, setPedidoSucesso] = useState<number | null>(null);

  const [perfilUsuario, setPerfilUsuario] = useState<'adm' | 'caixa' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('auth_user') || '{}');
        setPerfilUsuario(u.perfil || null);
        if (u.perfil === 'caixa') {
          // Funcionário do caixa obrigatoriamente passa pela tela de mesas primeiro!
          window.location.href = '/mesa/';
          return;
        }
      } catch {}
    }

    fetch('/api/produtos')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setProdutos(d);
        else setProdutos([]);
      })
      .catch(() => setProdutos([]));
  }, []);

  const produtosArray = Array.isArray(produtos) ? produtos : [];
  const produtosFiltrados = produtosArray.filter(p => p && p.categoria === categoriaAtiva);
  const espetinhos = produtosArray.filter(p => p && p.categoria === 'Espetinho');
  const totalCarrinho = (Array.isArray(carrinho) ? carrinho : []).reduce(
    (acc, i) => acc + (Number(i?.preco_unitario) || 0) * (Number(i?.quantidade) || 0),
    0
  );

  function adicionarAoCarrinho(produto: Produto, espetinhoEscolhido?: Produto) {
    // Jantinha Completa precisa de espetinho escolhido
    if (produto.categoria === 'Jantinha Completa' && !espetinhoEscolhido) {
      setModalEspetinho(produto);
      return;
    }

    setCarrinho(prev => {
      const idx = prev.findIndex(i =>
        i.produto_id === produto.id &&
        (i.espetinho_escolhido_id ?? '') === (espetinhoEscolhido?.id ?? '')
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 };
        return next;
      }
      return [...prev, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: 1,
        preco_unitario: produto.preco_venda,
        espetinho_escolhido_id: espetinhoEscolhido?.id,
        espetinho_nome: espetinhoEscolhido?.nome,
        destino_producao: produto.destino_producao,
      }];
    });
  }

  function removerDoCarrinho(idx: number) {
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

  function selecionarEspetinhoJantinha(espetinho: Produto) {
    if (!modalEspetinho) return;
    adicionarAoCarrinho(modalEspetinho, espetinho);
    setModalEspetinho(null);
  }

  async function confirmarPagamento() {
    if (!formaPag) return;
    setLoading(true);
    try {
      // 1. Criar pedido
      const resPedido = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoPedido,
          mesa_numero: mesaNumero || undefined,
          itens: carrinho.map(i => ({
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
            espetinho_escolhido_id: i.espetinho_escolhido_id,
            destino_producao: i.destino_producao,
          })),
        }),
      });
      const { pedidoId, numero } = await resPedido.json();

      // 2. Fechar/pagar pedido
      await fetch(`/api/pedidos/${pedidoId}/fechar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forma_pagamento: formaPag,
          valor_pago: parseFloat(valorPago) || totalCarrinho,
        }),
      });

      setPedidoSucesso(numero);
      setCarrinho([]);
      setModalPagamento(false);
      setFormaPag('');
      setValorPago('');
      setTimeout(() => setPedidoSucesso(null), 3000);
    } catch (e) {
      alert('Erro ao fechar pedido: ' + e);
    } finally {
      setLoading(false);
    }
  }

  const troco = parseFloat(valorPago) - totalCarrinho;

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <IconReceipt size={18} color="#f97316" />
            </div>
            <h1 className="font-bold text-lg text-white">PDV Fast</h1>
          </div>
          <div className="flex items-center gap-2">
            {perfilUsuario === 'adm' && (
              <a
                href="/adm/dashboard/"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-orange-400 hover:text-white border border-zinc-700 flex items-center gap-1 active:bg-zinc-700 transition-colors"
              >
                <span>Painel ADM</span>
              </a>
            )}
            <a
              href="/mesa"
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 flex items-center gap-1.5 active:bg-zinc-700 transition-colors"
            >
              <IconTable size={16} color="#f97316" />
              <span>Mesa</span>
            </a>
            <button
              onClick={() => setTipoPedido('balcao')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipoPedido === 'balcao' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
            >
              Balcão
            </button>
          </div>
        </div>
        {tipoPedido === 'mesa' && (
          <input
            type="text"
            value={mesaNumero}
            onChange={e => setMesaNumero(e.target.value)}
            placeholder="Número da mesa..."
            className="mt-2 w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
        )}
      </header>

      {/* Toast de sucesso */}
      {pedidoSucesso && (
        <div className="mx-4 mt-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-400 text-sm font-medium text-center flex items-center justify-center gap-2 animate-fade-in">
          <IconCheck size={16} />
          <span>Pedido #{pedidoSucesso} enviado para produção!</span>
        </div>
      )}

      {/* Carrinho atual */}
      {carrinho.length > 0 && (
        <section className="mx-4 mt-3 card">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">CARRINHO</h2>
          <div className="space-y-2">
            {carrinho.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white leading-tight">{item.quantidade}× {item.produto_nome}</p>
                  {item.espetinho_nome && (
                    <p className="text-xs text-orange-400 ml-3 flex items-center gap-1 mt-0.5">
                      <IconSkewer size={12} color="#f97316" />
                      <span>{item.espetinho_nome}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">
                    R$ {fmt(item.preco_unitario * item.quantidade)}
                  </span>
                  <button
                    onClick={() => removerDoCarrinho(idx)}
                    className="w-7 h-7 rounded-full bg-zinc-700 text-zinc-400 text-lg leading-none flex items-center justify-center active:bg-zinc-600"
                  >
                    −
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-between items-center">
            <span className="text-sm text-zinc-400">TOTAL</span>
            <span className="text-xl font-bold text-orange-400">
              R$ {fmt(totalCarrinho)}
            </span>
          </div>
        </section>
      )}

      {/* Abas de categoria */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIAS.map(cat => {
          const ativo = categoriaAtiva === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                ativo
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60'
              }`}
            >
              {renderCatIcon(cat, ativo)}
              <span>{CAT_LABEL[cat]}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de produtos */}
      <section className="grid grid-cols-2 gap-3 px-4 mt-3">
        {produtosFiltrados.map(produto => (
          <button
            key={produto.id}
            onClick={() => adicionarAoCarrinho(produto)}
            className="card text-left active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-2.5">
              {renderCatIcon(produto.categoria, false)}
            </div>
            <p className="text-sm font-semibold text-white leading-tight">{produto.nome}</p>
            <p className="text-orange-400 font-bold mt-1">
              R$ {fmt(produto.preco_venda)}
            </p>
          </button>
        ))}
      </section>

      {/* Barra de ação inferior */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 flex gap-3 z-40">
          <button
            onClick={() => setCarrinho([])}
            className="btn-ghost flex-none px-4 flex items-center justify-center text-zinc-400 hover:text-red-400"
            title="Limpar carrinho"
          >
            <IconTrash size={18} />
          </button>
          <button
            onClick={() => setModalPagamento(true)}
            className="btn-success flex-1 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <IconCheck size={18} />
            <span>Fechar — R$ {fmt(totalCarrinho)}</span>
          </button>
        </div>
      )}

      {/* ── Modal: Escolha de Espetinho para Jantinha Completa ── */}
      {modalEspetinho && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setModalEspetinho(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-center text-white flex items-center justify-center gap-2">
              <IconPlate size={20} color="#f97316" />
              <span>Jantinha Completa</span>
            </h2>
            <p className="text-sm text-zinc-400 text-center mb-4">Escolha o espetinho:</p>
            <div className="space-y-2">
              {espetinhos.map(esp => (
                <button
                  key={esp.id}
                  onClick={() => selecionarEspetinhoJantinha(esp)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4
                             text-left text-white font-semibold text-base active:bg-zinc-700
                             transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <IconSkewer size={16} color="#f97316" />
                    <span>{esp.nome}</span>
                  </span>
                  <span className="text-orange-400 text-sm">incluído</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setModalEspetinho(null)}
              className="btn-ghost w-full mt-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Pagamento ── */}
      {modalPagamento && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-3xl w-full max-w-md p-5 pb-8">
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-center mb-1">Pagamento</h2>
            <p className="text-3xl font-bold text-orange-400 text-center mb-5">
              R$ {fmt(totalCarrinho)}
            </p>

            {/* Forma de pagamento */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { id: 'dinheiro',       label: 'Dinheiro'   },
                { id: 'pix',            label: 'PIX'         },
                { id: 'cartao_credito', label: 'Crédito'    },
                { id: 'cartao_debito',  label: 'Débito'     },
                { id: 'fiado',          label: 'Fiado'       },
              ].map(fp => (
                <button
                  key={fp.id}
                  onClick={() => setFormaPag(fp.id)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                    formaPag === fp.id
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60'
                  }`}
                >
                  {fp.label}
                </button>
              ))}
            </div>

            {/* Valor recebido (somente dinheiro) */}
            {formaPag === 'dinheiro' && (
              <div className="mb-4">
                <label className="text-sm text-zinc-400 block mb-1.5">Valor recebido</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={valorPago}
                  onChange={e => setValorPago(e.target.value)}
                  placeholder={fmt(totalCarrinho)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                             text-white text-base focus:outline-none focus:border-orange-500 font-bold"
                />
                {(parseFloat(valorPago) || 0) >= totalCarrinho && (
                  <p className="text-emerald-400 text-sm mt-1.5 font-semibold">
                    Troco: R$ {fmt(troco)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setModalPagamento(false)}
                className="btn-ghost flex-none px-5"
              >
                Voltar
              </button>
              <button
                onClick={confirmarPagamento}
                disabled={!formaPag || loading}
                className="btn-success flex-1 disabled:opacity-50 font-bold flex items-center justify-center gap-1.5"
              >
                {loading ? 'Processando...' : (
                  <>
                    <IconCheck size={18} />
                    <span>Confirmar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PDVPage() {
  return (
    <ErrorBoundary>
      <PDVInner />
    </ErrorBoundary>
  );
}
