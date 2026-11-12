// app/api/estoque/sugestao-compras/route.ts
// Calcula sugestão de compras com base no consumo médio dos últimos N dias vs estoque atual.
// Retorna lista de insumos com: consumo médio, dias de estoque restante e quantidade sugerida.

import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query } from '@/lib/db';

interface Insumo {
  id: string;
  nome: string;
  estoque_atual: number;
  estoque_minimo: number;
  estoque_maximo: number | null;
  custo_unitario: number;
  unidade: string;
}

interface ConsumoRow {
  insumo_id: string;
  total_consumido: number;
}

export interface SugestaoItem {
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

export async function GET(req: NextRequest) {
  await initDb();

  const { searchParams } = new URL(req.url);
  const diasStr = searchParams.get('dias') ?? '7';
  const dias = Math.max(1, Math.min(30, parseInt(diasStr, 10) || 7));

  // 1. Buscar todos os insumos ativos com seus dados de estoque
  const insumos = await query<Insumo>(`
    SELECT
      i.id, i.nome,
      i.estoque_atual, i.estoque_minimo, i.estoque_maximo,
      i.custo_unitario,
      um.sigla AS unidade
    FROM insumos i
    JOIN unidades_medida um ON um.id = i.unidade_medida_id
    WHERE i.ativo = 1
    ORDER BY i.nome
  `);

  // 2. Buscar consumo real dos últimos N dias (somente saída por venda)
  //    Agrupa por insumo e soma a quantidade baixada no período
  const consumos = await query<ConsumoRow>(`
    SELECT
      insumo_id,
      SUM(quantidade) AS total_consumido
    FROM movimentacoes_estoque
    WHERE tipo = 'saida_venda'
      AND criado_em >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY insumo_id
  `, [dias]);

  // Mapa rápido de consumo por insumo_id
  const consumoMap = new Map<string, number>();
  for (const row of consumos) {
    consumoMap.set(row.insumo_id, Number(row.total_consumido) || 0);
  }

  // 3. Calcular sugestão para cada insumo
  const sugestoes: SugestaoItem[] = [];

  for (const ins of insumos) {
    const estoqueAtual     = Number(ins.estoque_atual)     || 0;
    const estoqueMinimo    = Number(ins.estoque_minimo)    || 0;
    const estoqueMaximo    = ins.estoque_maximo ? Number(ins.estoque_maximo) : null;
    const custoUnitario    = Number(ins.custo_unitario)    || 0;

    const totalConsumido   = consumoMap.get(ins.id) ?? 0;
    const consumoMedioDia  = totalConsumido / dias;

    // Dias de estoque restante (null se não houve consumo = infinito)
    const diasRestantes = consumoMedioDia > 0
      ? Math.floor(estoqueAtual / consumoMedioDia)
      : null;

    // Meta de reposição: estoque máximo se definido,
    // caso contrário: estoque mínimo × 3 (cobertura para ~3× o mínimo)
    const metaEstoque = estoqueMaximo ?? Math.max(estoqueMinimo * 3, estoqueMinimo + (consumoMedioDia * dias));

    // Quantidade sugerida = quanto falta para atingir a meta
    const quantidadeSugerida = Math.max(0, Math.ceil(metaEstoque - estoqueAtual));

    // Só inclui na lista se há sugestão de compra
    if (quantidadeSugerida <= 0 && estoqueAtual > estoqueMinimo) continue;

    // Define urgência
    let urgencia: SugestaoItem['urgencia'];
    if (estoqueAtual === 0 || (diasRestantes !== null && diasRestantes <= 1)) {
      urgencia = 'critico';
    } else if (estoqueAtual <= estoqueMinimo || (diasRestantes !== null && diasRestantes <= 3)) {
      urgencia = 'alto';
    } else if (diasRestantes !== null && diasRestantes <= 7) {
      urgencia = 'medio';
    } else {
      urgencia = 'baixo';
    }

    sugestoes.push({
      id:               ins.id,
      nome:             ins.nome,
      unidade:          ins.unidade,
      estoque_atual:    Math.round(estoqueAtual),
      estoque_minimo:   Math.round(estoqueMinimo),
      custo_unitario:   custoUnitario,
      consumo_medio_dia: Math.round(consumoMedioDia * 10) / 10,
      dias_restantes:   diasRestantes,
      quantidade_sugerida: quantidadeSugerida,
      custo_estimado:   Math.round(quantidadeSugerida * custoUnitario * 100) / 100,
      urgencia,
    });
  }

  // Ordenar: crítico → alto → médio → baixo; depois por dias restantes ASC
  const ordemUrgencia: Record<SugestaoItem['urgencia'], number> = {
    critico: 0, alto: 1, medio: 2, baixo: 3,
  };
  sugestoes.sort((a, b) => {
    const d = ordemUrgencia[a.urgencia] - ordemUrgencia[b.urgencia];
    if (d !== 0) return d;
    const da = a.dias_restantes ?? 9999;
    const db = b.dias_restantes ?? 9999;
    return da - db;
  });

  const totalEstimado = sugestoes.reduce((s, i) => s + i.custo_estimado, 0);

  return NextResponse.json({
    periodo_dias: dias,
    total_estimado: Math.round(totalEstimado * 100) / 100,
    itens: sugestoes,
  });
}
