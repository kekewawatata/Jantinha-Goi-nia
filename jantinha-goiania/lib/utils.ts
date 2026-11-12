/**
 * lib/utils.ts
 * Funções utilitárias compartilhadas no front-end e back-end.
 */

// Formata data ISO ou YYYY-MM-DD para DD/MM/AAAA
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  // Pega só os primeiros 10 chars (YYYY-MM-DD)
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

// Formata data ISO ou YYYY-MM-DD para DD/MM (para gráficos e eixos)
export function formatDateShortBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  if (!d || !m) return dateStr;
  return `${d}/${m}`;
}

// Formata timestamp ISO para DD/MM/AAAA HH:MM
export function formatDateTimeBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const d  = String(date.getDate()).padStart(2, '0');
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const y  = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

// Retorna hoje no formato YYYY-MM-DD (para inputs type="date")
export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Formata valor monetário
export function fmtMoeda(v: number | null | undefined): string {
  return `R$ ${(v ?? 0).toFixed(2).replace('.', ',')}`;
}
