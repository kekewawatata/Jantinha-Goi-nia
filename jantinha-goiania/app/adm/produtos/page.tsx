'use client';
// app/adm/produtos/page.tsx — Gestão do Cardápio (ADM) com ícones modernos em preto e laranja

import { useState, useEffect, Component, ReactNode } from 'react';
import AdmNav from '@/app/components/AdmNav';
import {
  IconCheck,
  IconAlert,
  IconPlus,
  IconTrash,
  IconCardapio,
  IconEspetinho,
  IconJantinhaSimples,
  IconJantinhaCompleta,
  IconBebida,
  IconAdicional,
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
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Cardápio</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar os dados do cardápio.</p>
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

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco_venda: number;
  disponivel: number;
  destino_producao: string;
  categoria: string;
  categoria_icone: string;
}

interface Insumo {
  id: string;
  nome: string;
  estoque_atual: number;
  unidade: string;
}

interface FichaTecnica {
  id: string;
  insumo_id: string;
  insumo_nome: string;
  quantidade_bruta: number;
}

const CATEGORIAS_FIXAS = [
  { id: 1, nome: 'Espetinho' },
  { id: 2, nome: 'Jantinha Simples' },
  { id: 3, nome: 'Jantinha Completa' },
  { id: 4, nome: 'Bebida' },
  { id: 5, nome: 'Adicional' },
];

function renderIconeCategoria(cat: string, size = 18, color = '#f97316') {
  const c = String(cat || '').toLowerCase();
  if (c.includes('espet')) return <IconEspetinho size={size} color={color} />;
  if (c.includes('completa')) return <IconJantinhaCompleta size={size} color={color} />;
  if (c.includes('simples')) return <IconJantinhaSimples size={size} color={color} />;
  if (c.includes('bebida') || c.includes('refri') || c.includes('suco') || c.includes('agua')) return <IconBebida size={size} color={color} />;
  return <IconAdicional size={size} color={color} />;
}

const DESTINOS = [
  { id: 'churrasqueira', label: 'Churrasqueira' },
  { id: 'balcao',        label: 'Balcão'        },
  { id: 'cozinha',       label: 'Cozinha'       },
];

function ProdutosInner() {
  const [produtos, setProdutos]   = useState<Produto[]>([]);
  const [insumos, setInsumos]     = useState<Insumo[]>([]);
  const [filtroCateg, setFiltroCateg] = useState('todos');
  const [modalNovo, setModalNovo] = useState(false);
  const [modalConfirm, setModalConfirm] = useState<Produto | null>(null);
  const [modalFicha, setModalFicha]     = useState<Produto | null>(null);
  const [fichas, setFichas]             = useState<FichaTecnica[]>([]);
  const [loading, setLoading]     = useState(false);
  const [sucesso, setSucesso]     = useState('');
  const [erro, setErro]           = useState('');

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    preco_venda: '',
    categoria_id: '1',
    destino_producao: 'churrasqueira',
  });

  const [formFicha, setFormFicha] = useState({ insumo_id: '', quantidade_bruta: '1' });

  function msg(texto: string, isError = false) {
    if (isError) { setErro(texto);   setTimeout(() => setErro(''), 3500); }
    else         { setSucesso(texto); setTimeout(() => setSucesso(''), 3000); }
  }

  const fetchProdutos = () => {
    fetch('/api/produtos?disponivel=false')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProdutos(d); });
  };

  const fetchInsumos = () => {
    fetch('/api/estoque')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setInsumos(d); });
  };

  const fetchFichas = (produtoId: string) => {
    fetch(`/api/ficha-tecnica?produto_id=${produtoId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setFichas(d); });
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
    fetchProdutos();
    fetchInsumos();
  }, []);

  async function salvarNovoProduto() {
    if (!form.nome || !form.preco_venda) return;
    setLoading(true);
    try {
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:             form.nome,
          descricao:        form.descricao,
          preco_venda:      parseFloat(form.preco_venda),
          categoria_id:     parseInt(form.categoria_id),
          destino_producao: form.destino_producao,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar produto');
      msg('Produto adicionado ao cardápio!');
      setModalNovo(false);
      setForm({ nome: '', descricao: '', preco_venda: '', categoria_id: '1', destino_producao: 'churrasqueira' });
      fetchProdutos();
    } catch (e: any) {
      msg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleDisponivel(produto: Produto) {
    try {
      await fetch('/api/produtos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: produto.id, disponivel: !produto.disponivel }),
      });
      fetchProdutos();
    } catch {
      msg('Erro ao atualizar produto', true);
    }
  }

  async function removerProduto(produto: Produto) {
    setLoading(true);
    try {
      const res = await fetch(`/api/produtos?id=${produto.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao remover');
      msg(`"${produto.nome}" removido do cardápio`);
      setModalConfirm(null);
      fetchProdutos();
    } catch (e: any) {
      msg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  function abrirModalFicha(produto: Produto) {
    setModalFicha(produto);
    setFormFicha({ insumo_id: '', quantidade_bruta: '1' });
    fetchFichas(produto.id);
  }

  async function salvarFicha() {
    if (!modalFicha || !formFicha.insumo_id || !formFicha.quantidade_bruta) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ficha-tecnica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id:      modalFicha.id,
          insumo_id:       formFicha.insumo_id,
          quantidade_bruta: parseFloat(formFicha.quantidade_bruta),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFormFicha({ insumo_id: '', quantidade_bruta: '1' });
      fetchFichas(modalFicha.id);
    } catch (e: any) {
      msg(e.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function removerFicha(fichaId: string) {
    if (!modalFicha) return;
    await fetch(`/api/ficha-tecnica?id=${fichaId}`, { method: 'DELETE' });
    fetchFichas(modalFicha.id);
  }

  const categorias = ['todos', ...CATEGORIAS_FIXAS.map(c => c.nome)];
  const filtrados  = filtroCateg === 'todos'
    ? produtos
    : produtos.filter(p => p.categoria === filtroCateg);

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
              <IconCardapio size={18} color="#f97316" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white">Cardápio PDV</h1>
              <p className="text-xs text-zinc-400">Gerencie os produtos do cardápio</p>
            </div>
          </div>
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
          >
            <IconPlus size={16} color="#ffffff" />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {/* Toasts */}
      {sucesso && (
        <div className="mx-4 mt-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-fade-in">
          <IconCheck size={16} />
          <span>{sucesso}</span>
        </div>
      )}
      {erro && (
        <div className="mx-4 mt-3 bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3 text-red-400 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-fade-in">
          <IconAlert size={16} />
          <span>{erro}</span>
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1 scrollbar-none">
        {categorias.map(cat => {
          const ativo = filtroCateg === cat;
          return (
            <button key={cat} onClick={() => setFiltroCateg(cat)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                ativo ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {cat !== 'todos' && renderIconeCategoria(cat, 14, ativo ? '#ffffff' : '#f97316')}
              <span>{cat === 'todos' ? 'Todos' : cat}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500 px-4 mt-3">
        {filtrados.length} produto{filtrados.length !== 1 ? 's' : ''}
      </p>

      {/* Lista */}
      <div className="px-4 mt-2 space-y-2">
        {filtrados.length === 0 && (
          <div className="text-center text-zinc-500 py-10 text-sm">Nenhum produto nesta categoria</div>
        )}
        {filtrados.map(produto => (
          <div key={produto.id} className={`card ${!produto.disponivel ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                {renderIconeCategoria(produto.categoria, 20, '#f97316')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white truncate">{produto.nome}</p>
                <p className="text-xs text-zinc-500">{produto.categoria} · {produto.destino_producao}</p>
                <p className="text-orange-400 font-bold text-sm mt-0.5">
                  R$ {(Number(produto.preco_venda) || 0).toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button onClick={() => toggleDisponivel(produto)}
                  className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                    produto.disponivel
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-700/50 text-zinc-500 border border-zinc-700'
                  }`}
                >
                  {produto.disponivel ? 'Ativo' : 'Inativo'}
                </button>
                <button onClick={() => abrirModalFicha(produto)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                >
                  Estoque
                </button>
                <button onClick={() => setModalConfirm(produto)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal: Novo Produto ── */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />
            <h2 className="text-lg font-bold text-white">Novo Produto</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Espetinho de Frango"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Descrição</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição opcional"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Preço de Venda (R$) *</label>
                <input type="number" step="0.01" min="0" inputMode="decimal"
                  value={form.preco_venda} onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Categoria *</label>
                <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                >
                  {CATEGORIAS_FIXAS.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Destino de Produção</label>
                <div className="grid grid-cols-3 gap-2">
                  {DESTINOS.map(d => (
                    <button key={d.id} type="button"
                      onClick={() => setForm(f => ({ ...f, destino_producao: d.id }))}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        form.destino_producao === d.id ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >{d.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalNovo(false)} className="btn-ghost flex-none">Cancelar</button>
              <button onClick={salvarNovoProduto} disabled={!form.nome || !form.preco_venda || loading}
                className="btn-success flex-1 disabled:opacity-50 font-bold"
              >
                {loading ? 'Salvando...' : 'Adicionar ao Cardápio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ficha Técnica (vínculo com estoque) ── */}
      {modalFicha && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />
            <div>
              <h2 className="text-lg font-bold text-white">Vínculo de Estoque</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{modalFicha.nome}</p>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Defina quais insumos do estoque são consumidos ao vender este produto. 
              A baixa é feita automaticamente ao fechar o pedido.
            </p>

            {/* Fichas existentes */}
            {fichas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Insumos vinculados</p>
                {fichas.map(f => (
                  <div key={f.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-sm text-white font-medium">{f.insumo_nome}</p>
                      <p className="text-xs text-zinc-500">{f.quantidade_bruta} un por venda</p>
                    </div>
                    <button onClick={() => removerFicha(f.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar novo vínculo */}
            <div className="border-t border-zinc-800 pt-3 space-y-3">
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Adicionar insumo</p>
              {insumos.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum insumo cadastrado no estoque.</p>
              ) : (
                <>
                  <select value={formFicha.insumo_id}
                    onChange={e => setFormFicha(f => ({ ...f, insumo_id: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Selecione o insumo...</option>
                    {insumos.map(ins => (
                      <option key={ins.id} value={ins.id}>{ins.nome} ({ins.estoque_atual} un)</option>
                    ))}
                  </select>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-400 block mb-1">Qtd por venda (un)</label>
                      <input type="number" step="1" min="1" inputMode="numeric"
                        value={formFicha.quantidade_bruta}
                        onChange={e => setFormFicha(f => ({ ...f, quantidade_bruta: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <button onClick={salvarFicha}
                      disabled={!formFicha.insumo_id || !formFicha.quantidade_bruta || loading}
                      className="mt-5 btn-success px-4 py-3 text-sm disabled:opacity-50"
                    >
                      Vincular
                    </button>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setModalFicha(null)} className="btn-ghost w-full">Fechar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar Remoção ── */}
      {modalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <IconTrash size={24} color="#f87171" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Remover do Cardápio?</h3>
              <p className="text-sm text-zinc-400 mt-1">
                &quot;{modalConfirm.nome}&quot; será removido permanentemente do cardápio.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setModalConfirm(null)} className="btn-ghost flex-1 py-2.5 text-sm">Cancelar</button>
              <button onClick={() => removerProduto(modalConfirm)} disabled={loading}
                className="btn-danger flex-1 py-2.5 text-sm font-bold"
              >
                {loading ? 'Removendo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdmNav active="produtos" />
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <ErrorBoundary>
      <ProdutosInner />
    </ErrorBoundary>
  );
}
