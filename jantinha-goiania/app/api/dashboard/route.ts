// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  await initDb();

  const resumoDia = await queryOne(`
    SELECT
      COUNT(*)                                                      AS total_pedidos,
      ROUND(COALESCE(SUM(valor_total), 0), 2)                      AS faturamento_hoje,
      ROUND(COALESCE(AVG(valor_total), 0), 2)                      AS ticket_medio,
      COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END), 0) AS cancelamentos
    FROM pedidos
    WHERE DATE(criado_em) = CURDATE()
  `);

  const insumosCriticosRow = await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c FROM insumos
    WHERE ativo = 1 AND estoque_atual <= estoque_minimo
  `);

  const { searchParams } = new URL(req.url);
  const periodoParam = (searchParams.get('periodo') || 'semanal').toLowerCase();
  const periodo = ['semanal', 'mensal', 'anual'].includes(periodoParam) ? periodoParam : 'semanal';

  // Obter data atual no fuso de Brasília (UTC-3)
  const hojeStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [ano, mes, dia] = hojeStr.split('-').map(Number);
  const hojeDate = new Date(ano, mes - 1, dia);

  let faturamentoCusto: Array<{
    label: string;
    sublabel: string;
    nomeCompleto: string;
    data: string;
    faturamento: number;
    custos: number;
    lucro_bruto: number;
    hoje: boolean;
    futuro: boolean;
  }> = [];

  if (periodo === 'semanal') {
    // ─── SEMANAL: 7 dias da semana atual (Segunda a Domingo) ───
    // No JS: getDay() -> 0 = Dom, 1 = Seg ... 6 = Sáb
    // Ajustar para Segunda = 0 ... Domingo = 6
    const diaSemana = (hojeDate.getDay() + 6) % 7;
    const segundaDate = new Date(ano, mes - 1, dia - diaSemana);
    const domingoDate = new Date(ano, mes - 1, dia - diaSemana + 6);

    const fmtData = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const segStr = fmtData(segundaDate);
    const domStr = fmtData(domingoDate);

    const rows = await query<any>(`
      SELECT
        data_lancamento                                                AS data,
        ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 2) AS faturamento,
        ROUND(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2) AS custos,
        ROUND(
          SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) -
          SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2
        ) AS lucro_bruto
      FROM fluxo_caixa
      WHERE data_lancamento >= ? AND data_lancamento <= ?
      GROUP BY data_lancamento
      ORDER BY data_lancamento ASC
    `, [segStr, domStr]);

    const mapDados = new Map<string, any>();
    for (const r of rows) {
      const k = typeof r.data === 'string'
        ? r.data.slice(0, 10)
        : (r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data).slice(0, 10));
      mapDados.set(k, r);
    }

    const nomesDias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const nomesCompletos = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    for (let i = 0; i < 7; i++) {
      const curD = new Date(segundaDate.getFullYear(), segundaDate.getMonth(), segundaDate.getDate() + i);
      const curStr = fmtData(curD);
      const sub = `${String(curD.getDate()).padStart(2, '0')}/${String(curD.getMonth() + 1).padStart(2, '0')}`;
      const r = mapDados.get(curStr);

      faturamentoCusto.push({
        label: nomesDias[i],
        sublabel: sub,
        nomeCompleto: `${nomesCompletos[i]}-feira (${sub})`,
        data: curStr,
        faturamento: Number(r?.faturamento || 0),
        custos: Number(r?.custos || 0),
        lucro_bruto: Number(r?.lucro_bruto || 0),
        hoje: curStr === hojeStr,
        futuro: curStr > hojeStr,
      });
    }
  } else if (periodo === 'anual') {
    // ─── ANUAL: 12 meses do ano atual (Janeiro a Dezembro) ───
    const inicioAnoStr = `${ano}-01-01`;
    const fimAnoStr = `${ano}-12-31`;

    const rows = await query<any>(`
      SELECT
        MONTH(data_lancamento)                                         AS mes,
        ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 2) AS faturamento,
        ROUND(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2) AS custos,
        ROUND(
          SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) -
          SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2
        ) AS lucro_bruto
      FROM fluxo_caixa
      WHERE data_lancamento >= ? AND data_lancamento <= ?
      GROUP BY MONTH(data_lancamento)
      ORDER BY mes ASC
    `, [inicioAnoStr, fimAnoStr]);

    const mapMeses = new Map<number, any>();
    for (const r of rows) {
      mapMeses.set(Number(r.mes), r);
    }

    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const nomesMesesCompletos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    for (let m = 1; m <= 12; m++) {
      const r = mapMeses.get(m);
      const isHoje = m === mes;
      const isFuturo = m > mes;

      faturamentoCusto.push({
        label: nomesMeses[m - 1],
        sublabel: String(ano),
        nomeCompleto: `${nomesMesesCompletos[m - 1]} / ${ano}`,
        data: `${ano}-${String(m).padStart(2, '0')}-01`,
        faturamento: Number(r?.faturamento || 0),
        custos: Number(r?.custos || 0),
        lucro_bruto: Number(r?.lucro_bruto || 0),
        hoje: isHoje,
        futuro: isFuturo,
      });
    }
  } else {
    // ─── MENSAL: semanas do mês atual (Sem 1 a Sem 4/5) ───
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const rows = await query<any>(`
      SELECT
        data_lancamento                                                AS data,
        DAY(data_lancamento)                                           AS dia,
        ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 2) AS faturamento,
        ROUND(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2) AS custos,
        ROUND(
          SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) -
          SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2
        ) AS lucro_bruto
      FROM fluxo_caixa
      WHERE data_lancamento >= ? AND data_lancamento <= ?
      GROUP BY data_lancamento
      ORDER BY data_lancamento ASC
    `, [inicioMesStr, fimMesStr]);

    const semanas = [
      { num: 1, inicio: 1, fim: 7 },
      { num: 2, inicio: 8, fim: 14 },
      { num: 3, inicio: 15, fim: 21 },
      { num: 4, inicio: 22, fim: 28 },
    ];
    if (ultimoDia >= 29) {
      semanas.push({ num: 5, inicio: 29, fim: ultimoDia });
    }

    faturamentoCusto = semanas.map(sem => {
      let fat = 0;
      let cus = 0;

      for (const r of rows) {
        const diaNum = Number(r.dia);
        if (diaNum >= sem.inicio && diaNum <= sem.fim) {
          fat += Number(r.faturamento || 0);
          cus += Number(r.custos || 0);
        }
      }

      const isAtual = dia >= sem.inicio && dia <= sem.fim;
      const isFuturo = dia < sem.inicio;
      const sub = `${String(sem.inicio).padStart(2, '0')} a ${String(sem.fim).padStart(2, '0')}`;

      return {
        label: `Sem ${sem.num}`,
        sublabel: sub,
        nomeCompleto: `Semana ${sem.num} (${sub}/${String(mes).padStart(2, '0')})`,
        data: `${ano}-${String(mes).padStart(2, '0')}-${String(sem.inicio).padStart(2, '0')}`,
        faturamento: Math.round(fat * 100) / 100,
        custos: Math.round(cus * 100) / 100,
        lucro_bruto: Math.round((fat - cus) * 100) / 100,
        hoje: isAtual,
        futuro: isFuturo,
      };
    });
  }

  const top5 = await query(`
    SELECT
      pr.nome                                          AS produto,
      cp.icone                                         AS icone,
      cp.nome                                          AS categoria,
      SUM(ip.quantidade)                               AS total_vendido,
      ROUND(SUM(ip.quantidade * ip.preco_unitario), 2) AS receita_total
    FROM itens_pedido ip
    JOIN produtos pr           ON pr.id = ip.produto_id
    JOIN categorias_produto cp ON cp.id = pr.categoria_id
    JOIN pedidos pe             ON pe.id = ip.pedido_id
    WHERE pe.status NOT IN ('cancelado')
      AND DATE(pe.criado_em) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY pr.id, pr.nome, cp.icone, cp.nome
    ORDER BY total_vendido DESC
    LIMIT 5
  `);

  const desperdicio = await queryOne(`
    SELECT
      ROUND(COALESCE(SUM(me.quantidade * i.custo_unitario), 0), 2) AS valor_desperdicado,
      GROUP_CONCAT(i.nome SEPARATOR ', ')                         AS insumos_afetados
    FROM movimentacoes_estoque me
    JOIN insumos i ON i.id = me.insumo_id
    WHERE me.tipo = 'saida_desperdicio'
      AND DATE(me.criado_em) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
  `);

  const comparativo = await queryOne(`
    SELECT
      SUM(CASE WHEN cp.nome = 'Espetinho' THEN ip.quantidade ELSE 0 END) AS espetinhos_avulsos,
      SUM(CASE WHEN cp.nome = 'Jantinha Completa' AND ip.espetinho_escolhido_id IS NOT NULL
               THEN ip.quantidade ELSE 0 END) AS espetinhos_em_jantinha
    FROM itens_pedido ip
    JOIN produtos pr           ON pr.id = ip.produto_id
    JOIN categorias_produto cp ON cp.id = pr.categoria_id
    JOIN pedidos pe             ON pe.id = ip.pedido_id
    WHERE pe.status != 'cancelado'
      AND DATE(pe.criado_em) = CURDATE()
  `);

  const topMargem = await query(`
    SELECT
      p.nome,
      p.preco_venda,
      ROUND(COALESCE(SUM(ft.quantidade_bruta * i.custo_unitario), 0), 2) AS custo_insumos,
      ROUND(p.preco_venda - COALESCE(SUM(ft.quantidade_bruta * i.custo_unitario), 0), 2) AS margem_bruta
    FROM produtos p
    LEFT JOIN ficha_tecnica ft ON ft.produto_id = p.id
    LEFT JOIN insumos i ON i.id = ft.insumo_id
    WHERE p.ativo = 1
    GROUP BY p.id, p.nome, p.preco_venda
    HAVING custo_insumos > 0
    ORDER BY margem_bruta DESC
    LIMIT 3
  `);

  return NextResponse.json({
    resumoDia,
    insumosCriticos: Number(insumosCriticosRow?.c ?? 0),
    faturamentoCusto,
    top5,
    desperdicio,
    comparativo,
    topMargem,
  });
}
