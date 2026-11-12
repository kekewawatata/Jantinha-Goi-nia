'use client';
// app/adm/dashboard/page.tsx — Dashboard ADM com ícones modernos e filtros de Faturamento (Semanal, Mensal, Anual) com colunas paralelas de faturamento e custo

import { useState, useEffect, useCallback, Component, ReactNode } from 'react';
import AdmNav from '@/app/components/AdmNav';
import {
  IconDashboard,
  IconFlame,
  IconAlert,
  IconCheck,
  IconBroom,
  IconEspetinho,
  IconJantinhaSimples,
  IconJantinhaCompleta,
  IconBebida,
  IconAdicional,
  IconTrash,
} from '@/app/components/Icons';

// ─── ErrorBoundary — captura qualquer erro de render e mostra mensagem amigável ───
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
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Jantinha Goiânia</p>
          <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Ocorreu um erro ao carregar o painel.</p>
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

// ─── Formatação segura de data ───
function fmtDataCurta(s: unknown, periodo: string): string {
  try {
    if (!s || typeof s !== 'string') return '';
    const parts = s.slice(0, 10).split('-');
    if (parts.length < 3) return String(s);
    if (periodo === 'anual') {
      // Exibe MM/AA
      return `${parts[1]}/${parts[0].slice(2)}`;
    }
    return `${parts[2]}/${parts[1]}`;
  } catch { return ''; }
}

// ─── Formatação monetária segura ───
function fmt(v: unknown): string {
  try {
    const n = Number(v) || 0;
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  } catch { return 'R$ 0,00'; }
}

// ─── Ícone por Categoria ───
function renderIconeCategoria(cat: string) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('espet')) return <IconEspetinho size={16} color="#f97316" />;
  if (c.includes('completa')) return <IconJantinhaCompleta size={16} color="#f97316" />;
  if (c.includes('simples')) return <IconJantinhaSimples size={16} color="#f97316" />;
  if (c.includes('bebida') || c.includes('refri') || c.includes('suco') || c.includes('agua')) return <IconBebida size={16} color="#f97316" />;
  return <IconAdicional size={16} color="#f97316" />;
}

// ─── Gráfico de barras horizontais – HTML/CSS puro ───
function BarrasHorizontais({ dados, cor }: { dados: Array<{ label: string; valor: number; categoria?: string }>; cor: string }) {
  try {
    if (!dados || dados.length === 0) {
      return <p style={{ color: '#52525b', textAlign: 'center', padding: '32px 0', fontSize: 12 }}>Sem vendas registradas</p>;
    }
    const max = Math.max(...dados.map(d => d.valor), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dados.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#a1a1aa', width: 85, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <div style={{ flex: 1, background: '#27272a', borderRadius: 99, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, (d.valor / max) * 100)}%`, background: cor, height: 10, borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 11, color: '#d4d4d8', width: 32, flexShrink: 0 }}>{d.valor}</span>
          </div>
        ))}
      </div>
    );
  } catch { return null; }
}

// ─── Gráfico de Colunas Paralelas (Faturamento e Custo lado a lado) ───
interface ItemGrafico {
  label: string;
  sublabel?: string;
  nomeCompleto?: string;
  data?: string;
  faturamento: number;
  custos: number;
  lucro_bruto?: number;
  hoje?: boolean;
  futuro?: boolean;
}

function fmtCurto(v: number): string {
  try {
    const n = Number(v) || 0;
    if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace('.0', '')}k`;
    return `R$ ${Math.round(n)}`;
  } catch {
    return 'R$ 0';
  }
}

function GraficoColunasParalelas({
  dados,
  periodo,
}: {
  dados: ItemGrafico[];
  periodo: 'semanal' | 'mensal' | 'anual';
}) {
  const [ativoIdx, setAtivoIdx] = useState<number | null>(null);

  try {
    if (!dados || dados.length === 0) {
      return (
        <p style={{ color: '#52525b', textAlign: 'center', padding: '36px 0', fontSize: 12 }}>
          Sem movimentações registradas neste período
        </p>
      );
    }

    // Totais do período
    const totalFat = dados.reduce((acc, d) => acc + (Number(d.faturamento) || 0), 0);
    const totalCus = dados.reduce((acc, d) => acc + (Number(d.custos) || 0), 0);
    const totalLucro = totalFat - totalCus;

    // Item em foco (hovered, ou hoje, ou total)
    const idxHoje = dados.findIndex(d => d.hoje);
    const itemAtivo = ativoIdx !== null ? dados[ativoIdx] : (idxHoje !== -1 ? dados[idxHoje] : null);

    // Dimensões do SVG
    const W = 500;
    const H = 200;
    const padL = 38;
    const padR = 12;
    const padT = 14;
    const padB = 38;
    const iW = W - padL - padR;
    const iH = H - padT - padB;

    const maxVal = Math.max(...dados.map(d => Math.max(Number(d.faturamento) || 0, Number(d.custos) || 0)), 1);
    const maxCeil = maxVal > 0 ? maxVal * 1.15 : 100;

    const n = dados.length;
    const slotW = iW / n;

    // Largura das colunas paralelas
    let barW = 12;
    let barGap = 3;
    if (n <= 5) {
      barW = 16;
      barGap = 4;
    } else if (n > 8) {
      barW = 8;
      barGap = 2;
    }
    const pairW = barW * 2 + barGap;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Painel de inspeção de detalhes / resumo */}
        <div
          style={{
            background: 'rgba(24,24,27,0.85)',
            border: '1px solid #27272a',
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f4f4f5' }}>
              {itemAtivo ? (itemAtivo.nomeCompleto || itemAtivo.label) : (
                periodo === 'semanal' ? 'Total da Semana Atual' : periodo === 'mensal' ? 'Total do Mês Atual' : 'Total do Ano'
              )}
            </span>
            {itemAtivo ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: itemAtivo.hoje ? 'rgba(249,115,22,0.15)' : itemAtivo.futuro ? 'rgba(113,113,122,0.15)' : 'rgba(16,185,129,0.15)',
                  color: itemAtivo.hoje ? '#f97316' : itemAtivo.futuro ? '#a1a1aa' : '#34d399',
                  border: `1px solid ${itemAtivo.hoje ? 'rgba(249,115,22,0.3)' : itemAtivo.futuro ? 'rgba(113,113,122,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}
              >
                {itemAtivo.hoje ? 'Hoje (em curso)' : itemAtivo.futuro ? 'Aguardando data' : 'Consolidado'}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#71717a' }}>Toque em uma coluna para inspecionar</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
            <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '4px 6px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p style={{ fontSize: 9, color: '#34d399', margin: 0, fontWeight: 600 }}>Faturamento</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#10b981', margin: '2px 0 0' }}>
                {fmt(itemAtivo ? itemAtivo.faturamento : totalFat)}
              </p>
            </div>
            <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: '4px 6px', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p style={{ fontSize: 9, color: '#fb923c', margin: 0, fontWeight: 600 }}>Custo</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#f97316', margin: '2px 0 0' }}>
                {fmt(itemAtivo ? itemAtivo.custos : totalCus)}
              </p>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: '4px 6px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p style={{ fontSize: 9, color: '#60a5fa', margin: 0, fontWeight: 600 }}>Lucro Líquido</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: (itemAtivo ? (itemAtivo.faturamento - itemAtivo.custos) : totalLucro) >= 0 ? '#38bdf8' : '#f87171', margin: '2px 0 0' }}>
                {fmt(itemAtivo ? (itemAtivo.faturamento - itemAtivo.custos) : totalLucro)}
              </p>
            </div>
          </div>
        </div>

        {/* SVG com linhas verticais / colunas paralelas */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="gradCus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>

          {/* Linhas horizontais de referência (Y-Grid) */}
          {[1, 0.5, 0].map((ratio, idx) => {
            const y = padT + iH - ratio * iH;
            const val = ratio * maxCeil;
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={y}
                  x2={padL + iW}
                  y2={y}
                  stroke={ratio === 0 ? '#3f3f46' : '#27272a'}
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={8}
                  fill="#71717a"
                  fontFamily="sans-serif"
                >
                  {fmtCurto(val)}
                </text>
              </g>
            );
          })}

          {/* Colunas Paralelas (Faturamento e Custo lado a lado) */}
          {dados.map((d, i) => {
            const slotCenterX = padL + i * slotW + slotW / 2;
            const xFat = slotCenterX - pairW / 2;
            const xCus = xFat + barW + barGap;

            const fatVal = Math.max(0, Number(d.faturamento) || 0);
            const cusVal = Math.max(0, Number(d.custos) || 0);

            const hFat = Math.max(0, (fatVal / maxCeil) * iH);
            const hCus = Math.max(0, (cusVal / maxCeil) * iH);

            const actualHFat = fatVal > 0 ? Math.max(hFat, 4) : 0;
            const actualHCus = cusVal > 0 ? Math.max(hCus, 4) : 0;

            const yFat = padT + iH - actualHFat;
            const yCus = padT + iH - actualHCus;

            const isSelected = ativoIdx === i;
            const isDimmed = ativoIdx !== null && ativoIdx !== i;
            const op = d.futuro ? 0.35 : (isDimmed ? 0.45 : 1);
            const rx = barW >= 10 ? 3 : 2;

            return (
              <g key={i}>
                {/* Destaque do slot selecionado / hovered */}
                {isSelected && (
                  <rect
                    x={padL + i * slotW + 1}
                    y={padT - 4}
                    width={slotW - 2}
                    height={iH + 42}
                    rx={6}
                    fill="rgba(255,255,255,0.05)"
                  />
                )}

                {/* Linha vertical / Barra de Faturamento (Verde) */}
                {actualHFat > 0 ? (
                  <rect
                    x={xFat}
                    y={yFat}
                    width={barW}
                    height={actualHFat}
                    rx={rx}
                    fill="url(#gradFat)"
                    opacity={op}
                  />
                ) : (
                  <rect
                    x={xFat}
                    y={padT + iH - 2}
                    width={barW}
                    height={2}
                    rx={1}
                    fill={d.futuro ? '#27272a' : 'rgba(16,185,129,0.3)'}
                  />
                )}

                {/* Linha vertical / Barra de Custo (Laranja) */}
                {actualHCus > 0 ? (
                  <rect
                    x={xCus}
                    y={yCus}
                    width={barW}
                    height={actualHCus}
                    rx={rx}
                    fill="url(#gradCus)"
                    opacity={op}
                  />
                ) : (
                  <rect
                    x={xCus}
                    y={padT + iH - 2}
                    width={barW}
                    height={2}
                    rx={1}
                    fill={d.futuro ? '#27272a' : 'rgba(249,115,22,0.3)'}
                  />
                )}

                {/* Rótulo Primário (Seg, Ter, Sem 1, Jan...) */}
                <text
                  x={slotCenterX}
                  y={H - 18}
                  textAnchor="middle"
                  fontSize={n > 8 ? 8.5 : 10}
                  fontWeight={d.hoje || isSelected ? 700 : 500}
                  fill={isSelected ? '#ffffff' : (d.hoje ? '#f97316' : (d.futuro ? '#52525b' : '#d4d4d8'))}
                  fontFamily="sans-serif"
                >
                  {d.label}
                </text>

                {/* Rótulo Secundário (19/10, 01-07, 2026...) */}
                <text
                  x={slotCenterX}
                  y={H - 7}
                  textAnchor="middle"
                  fontSize={n > 8 ? 7 : 8}
                  fill={d.hoje ? '#ea580c' : '#71717a'}
                  fontFamily="sans-serif"
                >
                  {d.sublabel}
                </text>

                {/* Ponto indicador de Hoje / Período Atual */}
                {d.hoje && (
                  <circle
                    cx={slotCenterX}
                    cy={H - 1}
                    r={2}
                    fill="#f97316"
                  />
                )}

                {/* Área de clique/hover interativa invisível */}
                <rect
                  x={padL + i * slotW}
                  y={padT - 6}
                  width={slotW}
                  height={iH + 46}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setAtivoIdx(i)}
                  onMouseLeave={() => setAtivoIdx(null)}
                  onClick={() => setAtivoIdx(ativoIdx === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>

        {/* Legenda explicativa inferior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, padding: '0 4px' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#a1a1aa' }}>
              <span style={{ width: 10, height: 10, background: '#10b981', display: 'inline-block', borderRadius: 2 }} />
              <span>Faturamento</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#a1a1aa' }}>
              <span style={{ width: 10, height: 10, background: '#f97316', display: 'inline-block', borderRadius: 2 }} />
              <span>Custo</span>
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#71717a' }}>
            {periodo === 'semanal' && '📅 7 dias (Seg a Dom)'}
            {periodo === 'mensal' && '📅 Semanas 1 a 5 do mês'}
            {periodo === 'anual' && '📅 12 meses (Jan a Dez)'}
          </span>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

// ─── Componente principal ───
function DashboardInner() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPeriodo, setLoadingPeriodo] = useState(false);
  const [erroBusca, setErroBusca] = useState('');
  const [modalLimpar, setModalLimpar] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [limpando, setLimpando] = useState(false);
  const [periodoFaturamento, setPeriodoFaturamento] = useState<'semanal' | 'mensal' | 'anual'>('semanal');

  const carregarDashboard = useCallback(async (p: string = 'semanal', isInitial = false) => {
    if (isInitial) setLoading(true);
    else setLoadingPeriodo(true);

    try {
      const res = await fetch(`/api/dashboard?periodo=${p}`);
      const json = await res.json();
      setData(json);
      setErroBusca('');
    } catch (e: any) {
      setErroBusca(String(e?.message || e));
    } finally {
      setLoading(false);
      setLoadingPeriodo(false);
    }
  }, []);

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

    carregarDashboard(periodoFaturamento, true);
  }, [carregarDashboard, periodoFaturamento]);

  function alterarPeriodo(p: 'semanal' | 'mensal' | 'anual') {
    setPeriodoFaturamento(p);
    carregarDashboard(p, false);
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    window.location.href = '/login/';
  }

  async function confirmarLimpar() {
    setLimpando(true);
    try {
      const res = await fetch('/api/dashboard/limpar', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao limpar');
      setModalLimpar(false);
      setSucesso(json.mensagem ?? 'Histórico limpo com sucesso!');
      setTimeout(() => setSucesso(''), 3500);
      carregarDashboard(periodoFaturamento, false);
    } catch (e: any) { alert(e.message); }
    finally { setLimpando(false); }
  }

  // ── Tela de carregamento ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
        <div style={{ color: '#f97316', marginBottom: 12 }}>
          <IconFlame size={32} color="#f97316" />
        </div>
        <p style={{ color: '#a1a1aa', fontSize: 13 }}>Carregando painel...</p>
      </div>
    );
  }

  // ── Erro de busca ──
  if (erroBusca || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#09090b', textAlign: 'center' }}>
        <div style={{ color: '#f97316', marginBottom: 12 }}>
          <IconAlert size={36} color="#f97316" />
        </div>
        <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8 }}>Não foi possível carregar os dados.</p>
        {erroBusca && <p style={{ color: '#52525b', fontSize: 11, marginBottom: 16 }}>{erroBusca}</p>}
        <button onClick={() => window.location.reload()} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Dados normalizados ──
  const resumo = data.resumoDia || {};
  const criticos = Number(data.insumosCriticos) || 0;
  const fatCusto = Array.isArray(data.faturamentoCusto) ? data.faturamentoCusto : [];
  const top5 = Array.isArray(data.top5) ? data.top5 : [];
  const desperdicio = data.desperdicio || {};
  const comp = data.comparativo || {};

  const top5Barras = top5.map((item: any) => ({
    label: String(item.produto || '').slice(0, 14) || '—',
    valor: Number(item.total_vendido) || 0,
    categoria: item.categoria,
  }));

  const card: React.CSSProperties = { background: '#18181b', border: '1px solid #27272a', borderRadius: 16, padding: 16, marginBottom: 0 };

  const periodosInfo: Record<string, string> = {
    semanal: 'Esta semana (dia a dia até domingo)',
    mensal: 'Este mês (semana a semana)',
    anual: 'Este ano (mês a mês)',
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 96, background: '#09090b', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(24,24,27,0.97)', borderBottom: '1px solid #27272a', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#f97316', display: 'flex', alignItems: 'center' }}><IconFlame size={18} color="#f97316" /></span>
            <span>Jantinha Goiânia</span>
          </h1>
          <p style={{ fontSize: 11, color: '#71717a', margin: 0 }}>Dashboard ADM · {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setModalLimpar(true)}
            style={{ fontSize: 12, color: '#d4d4d8', background: '#27272a', border: '1px solid #3f3f46', padding: '7px 12px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <IconBroom size={14} color="#a1a1aa" />
            <span>Limpar Histórico</span>
          </button>
          <button onClick={logout} style={{ fontSize: 12, color: '#a1a1aa', background: 'rgba(39,39,42,0.8)', border: 'none', padding: '7px 12px', borderRadius: 12, cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </header>

      {/* Toast sucesso */}
      {sucesso && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '12px 16px', color: '#34d399', fontSize: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <IconCheck size={16} color="#34d399" />
          <span>{sucesso}</span>
        </div>
      )}

      {/* Alerta estoque crítico */}
      {criticos > 0 && (
        <a href="/adm/estoque/" style={{ margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', textDecoration: 'none' }}>
          <IconAlert size={20} color="#f87171" />
          <div>
            <p style={{ color: '#f87171', fontWeight: 600, fontSize: 14, margin: 0 }}>{criticos} insumo(s) em nível crítico!</p>
            <p style={{ color: 'rgba(248,113,113,0.6)', fontSize: 11, margin: 0 }}>Toque para ver estoque</p>
          </div>
          <span style={{ marginLeft: 'auto', color: '#52525b' }}>›</span>
        </a>
      )}

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Cards KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Faturamento Hoje', valor: fmt(resumo.faturamento_hoje), cor: '#34d399' },
            { label: 'Pedidos Hoje',     valor: String(Number(resumo.total_pedidos) || 0), cor: '#ffffff' },
            { label: 'Ticket Médio',     valor: fmt(resumo.ticket_medio), cor: '#fb923c' },
            { label: 'Desperdício Ontem',valor: fmt(desperdicio.valor_desperdicado), cor: '#f87171' },
          ].map((kpi, i) => (
            <div key={i} style={card}>
              <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 4px' }}>{kpi.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: kpi.cor, margin: 0 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Espetinhos */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <IconEspetinho size={16} color="#f97316" />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', margin: 0 }}>Espetinhos hoje</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#fb923c', margin: 0 }}>{Number(comp.espetinhos_avulsos) || 0}</p>
              <p style={{ fontSize: 11, color: '#71717a', margin: '4px 0 0' }}>Avulsos</p>
            </div>
            <div style={{ width: 1, background: '#3f3f46' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa', margin: 0 }}>{Number(comp.espetinhos_em_jantinha) || 0}</p>
              <p style={{ fontSize: 11, color: '#71717a', margin: '4px 0 0' }}>Em Jantinha</p>
            </div>
          </div>
        </div>

        {/* Gráfico Faturamento com Seletor de Período */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconDashboard size={16} color="#f97316" />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#d4d4d8', margin: 0 }}>Faturamento vs Custo</p>
            </div>
            <span style={{ fontSize: 10, color: '#71717a' }}>{periodosInfo[periodoFaturamento]}</span>
          </div>

          {/* Abas / Botões de Período (Semanal, Mensal, Anual) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {(['semanal', 'mensal', 'anual'] as const).map(p => {
              const ativo = periodoFaturamento === p;
              const nomes: Record<string, string> = { semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' };
              const subtitulos: Record<string, string> = {
                semanal: 'Dias da semana',
                mensal: 'Semanas do mês',
                anual: 'Meses do ano',
              };
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => alterarPeriodo(p)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 12,
                    border: ativo ? '1px solid #f97316' : '1px solid #27272a',
                    background: ativo ? 'rgba(249,115,22,0.15)' : '#27272a',
                    color: ativo ? '#f97316' : '#a1a1aa',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: ativo ? 700 : 600 }}>{nomes[p]}</span>
                  <span style={{ fontSize: 9, color: ativo ? '#fb923c' : '#71717a' }}>{subtitulos[p]}</span>
                </button>
              );
            })}
          </div>

          <div style={{ opacity: loadingPeriodo ? 0.4 : 1, transition: 'opacity 0.2s' }}>
            <GraficoColunasParalelas dados={fatCusto} periodo={periodoFaturamento} />
          </div>
        </div>

        {/* Top 5 Mais Vendidos */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <IconFlame size={16} color="#f97316" />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#d4d4d8', margin: 0 }}>Top 5 Mais Vendidos (7 dias)</p>
          </div>
          <BarrasHorizontais dados={top5Barras} cor="#f97316" />
          {top5.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid #27272a', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top5.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {renderIconeCategoria(item.categoria)}
                    <span>{item.produto}</span>
                  </span>
                  <span style={{ color: '#fb923c', fontWeight: 600 }}>{Number(item.total_vendido) || 0} un</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desperdício */}
        {desperdicio.insumos_afetados && (
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#f87171', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconTrash size={16} color="#f87171" />
              <span>Desperdício (ontem)</span>
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#f87171', margin: 0 }}>{fmt(desperdicio.valor_desperdicado)}</p>
            <p style={{ fontSize: 11, color: '#71717a', margin: '4px 0 0' }}>{desperdicio.insumos_afetados}</p>
          </div>
        )}

      </div>

      {/* Modal Limpar */}
      {modalLimpar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.85)' }}>
          <div style={{ background: '#18181b', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 20, width: '100%', maxWidth: 360, padding: 20, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconBroom size={36} color="#f97316" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Limpar Histórico do Dashboard?</h3>
            <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 20px', lineHeight: 1.6 }}>
              Zera todos os pedidos, vendas e gráficos. A numeração recomeçará do #1.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModalLimpar(false)} style={{ flex: 1, padding: '10px 0', background: '#27272a', color: '#a1a1aa', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarLimpar} disabled={limpando} style={{ flex: 1, padding: '10px 0', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: limpando ? 0.6 : 1 }}>
                {limpando ? 'Zerando...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav inferior */}
      <AdmNav active="dashboard" />
    </div>
  );
}

// ─── Export com ErrorBoundary ───
export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardInner />
    </ErrorBoundary>
  );
}
