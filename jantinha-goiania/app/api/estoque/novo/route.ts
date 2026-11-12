// app/api/estoque/novo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { queryOne, exec } from '@/lib/db';
import { verificarToken } from '@/lib/auth';
import crypto from 'crypto';

function uuid() { return crypto.randomUUID(); }

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado. Apenas administradores podem cadastrar produtos no estoque.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    nome,
    quantidade,
    custo_total,
    estoque_minimo = 5,
    perecivel = false,
    validade_dias,
    data_validade,
    fornecedor,
    nota_fiscal,
  } = body;

  if (!nome || !quantidade || custo_total === undefined || custo_total === null) {
    return NextResponse.json({ error: 'Nome, quantidade em unidades e custo total são obrigatórios.' }, { status: 400 });
  }

  const qtdNum = parseFloat(quantidade);
  const custoTotalNum = parseFloat(custo_total);

  if (isNaN(qtdNum) || qtdNum <= 0) {
    return NextResponse.json({ error: 'Quantidade deve ser maior que zero.' }, { status: 400 });
  }

  const custoUnitario = custoTotalNum > 0 ? custoTotalNum / qtdNum : 0;
  const insumoId = uuid();
  const loteId = uuid();

  try {
    // 1. Obter id da unidade 'un' (unidade)
    let unRow = await queryOne<{ id: number }>(`SELECT id FROM unidades_medida WHERE sigla = 'un'`);
    if (!unRow) {
      await exec(`INSERT IGNORE INTO unidades_medida (sigla, nome) VALUES ('un', 'Unidade')`);
      unRow = await queryOne<{ id: number }>(`SELECT id FROM unidades_medida WHERE sigla = 'un'`);
    }
    const unidadeId = unRow?.id ?? 1;

    // 2. Inserir insumo
    await exec(
      `INSERT INTO insumos (id, nome, unidade_medida_id, custo_unitario, estoque_atual,
              estoque_minimo, fator_rendimento, perecivel, validade_dias, ativo,
              criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, 1.0, ?, ?, 1, NOW(), NOW())`,
      [insumoId, nome.trim(), unidadeId, custoUnitario, qtdNum,
       parseFloat(estoque_minimo) || 0, perecivel ? 1 : 0,
       validade_dias ? parseInt(validade_dias) : null]
    );

    // 3. Registrar lote de entrada
    await exec(
      `INSERT INTO lotes_estoque (id, insumo_id, quantidade, custo_total, custo_unitario,
              data_compra, data_validade, fornecedor, nota_fiscal, usuario_id, criado_em)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, NOW())`,
      [loteId, insumoId, qtdNum, custoTotalNum, custoUnitario,
       data_validade || null, fornecedor || null, nota_fiscal || null, user.id]
    );

    // 4. Registrar movimentação de estoque
    await exec(
      `INSERT INTO movimentacoes_estoque (id, insumo_id, tipo, quantidade, custo_unitario,
              referencia_id, referencia_tipo, observacao, usuario_id, criado_em)
       VALUES (?, ?, 'entrada', ?, ?, ?, 'lote', 'Cadastro inicial de estoque', ?, NOW())`,
      [uuid(), insumoId, qtdNum, custoUnitario, loteId, user.id]
    );

    // 5. Lançar despesa no financeiro
    if (custoTotalNum > 0) {
      let cat = await queryOne<{ id: number }>(`SELECT id FROM categorias_financeiro WHERE nome = 'Compra de Insumos'`);
      if (!cat) {
        cat = await queryOne<{ id: number }>(`SELECT id FROM categorias_financeiro WHERE tipo = 'saida' LIMIT 1`);
      }
      const categoriaId = cat?.id ?? 4;

      await exec(
        `INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_lote_id, data_lancamento, usuario_id, criado_em)
         VALUES (?, 'saida', ?, ?, ?, ?, CURDATE(), ?, NOW())`,
        [uuid(), categoriaId, custoTotalNum, `Compra de Produto: ${nome.trim()} (${qtdNum} un)`, loteId, user.id]
      );
    }

    return NextResponse.json({
      ok: true,
      mensagem: `Produto "${nome}" adicionado com sucesso! Despesa de R$ ${custoTotalNum.toFixed(2)} contabilizada no financeiro.`,
      insumoId,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
