// app/api/estoque/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query, queryOne, exec } from '@/lib/db';
import { verificarToken } from '@/lib/auth';
import { resolverAlertasInsumo } from '@/lib/business/estoque';
import crypto from 'crypto';

function uuid() { return crypto.randomUUID(); }

// GET: listar estoque com status
export async function GET(_req: NextRequest) {
  await initDb();
  const insumos = await query(`
    SELECT
      i.id, i.nome, i.descricao,
      i.estoque_atual, i.estoque_minimo, i.estoque_maximo,
      i.custo_unitario, i.fator_rendimento, i.perecivel, i.validade_dias,
      um.sigla AS unidade, um.nome AS unidade_nome,
      CASE
        WHEN i.estoque_atual = 0                         THEN 'zerado'
        WHEN i.estoque_atual <= i.estoque_minimo         THEN 'critico'
        WHEN i.estoque_atual <= i.estoque_minimo * 1.5   THEN 'baixo'
        ELSE 'ok'
      END AS status_estoque
    FROM insumos i
    JOIN unidades_medida um ON um.id = i.unidade_medida_id
    WHERE i.ativo = 1
    ORDER BY
      CASE
        WHEN i.estoque_atual = 0                       THEN 1
        WHEN i.estoque_atual <= i.estoque_minimo       THEN 2
        WHEN i.estoque_atual <= i.estoque_minimo * 1.5 THEN 3
        ELSE 4
      END, i.nome
  `);
  return NextResponse.json(insumos);
}

// POST: registrar entrada de estoque (compra)
export async function POST(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const { insumo_id, quantidade, custo_total, fornecedor, nota_fiscal, data_validade } = await req.json();

  if (!insumo_id || !quantidade || !custo_total) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  const custo_unitario = Number(custo_total) / Number(quantidade);
  const loteId = uuid();

  try {
    await exec(
      `INSERT INTO lotes_estoque (id, insumo_id, quantidade, custo_total, custo_unitario,
              data_compra, data_validade, fornecedor, nota_fiscal, usuario_id, criado_em)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, NOW())`,
      [loteId, insumo_id, quantidade, custo_total, custo_unitario,
       data_validade || null, fornecedor || null, nota_fiscal || null, user.id]
    );

    await exec(
      `UPDATE insumos SET estoque_atual = estoque_atual + ?, custo_unitario = ?, atualizado_em = NOW() WHERE id = ?`,
      [quantidade, custo_unitario, insumo_id]
    );

    await exec(
      `INSERT INTO movimentacoes_estoque (id, insumo_id, tipo, quantidade, custo_unitario, referencia_id, referencia_tipo, usuario_id, criado_em)
       VALUES (?, ?, 'entrada', ?, ?, ?, 'lote', ?, NOW())`,
      [uuid(), insumo_id, quantidade, custo_unitario, loteId, user.id]
    );

    const cat = await queryOne<{ id: number }>(`SELECT id FROM categorias_financeiro WHERE nome='Compra de Insumos'`);
    const catId = cat?.id ?? 4;
    const insumo = await queryOne<{ nome: string }>(`SELECT nome FROM insumos WHERE id=?`, [insumo_id]);
    const insumoNome = insumo?.nome ?? 'Insumo';

    await exec(
      `INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_lote_id, data_lancamento, usuario_id, criado_em)
       VALUES (?, 'saida', ?, ?, ?, ?, CURDATE(), ?, NOW())`,
      [uuid(), catId, custo_total, `Compra: ${insumoNome} (${quantidade} un)`, loteId, user.id]
    );

    await resolverAlertasInsumo(insumo_id);

    return NextResponse.json({ ok: true, loteId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: remover insumo do estoque
export async function DELETE(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado. Apenas administradores podem remover insumos.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do insumo é obrigatório' }, { status: 400 });
  }

  try {
    const insumo = await queryOne<{ nome: string }>(`SELECT nome FROM insumos WHERE id = ?`, [id]);
    if (!insumo) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 });
    }

    await exec(`UPDATE insumos SET ativo = 0, atualizado_em = NOW() WHERE id = ?`, [id]);
    await exec(`DELETE FROM ficha_tecnica WHERE insumo_id = ?`, [id]);
    await exec(`UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW() WHERE id = ?`, [id]);

    return NextResponse.json({ ok: true, mensagem: `Insumo "${insumo.nome}" removido do estoque com sucesso!` });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
