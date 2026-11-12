// app/api/financeiro/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query, queryOne, exec } from '@/lib/db';
import { verificarToken } from '@/lib/auth';
import crypto from 'crypto';

function uuid() { return crypto.randomUUID(); }

export async function GET(_req: NextRequest) {
  await initDb();
  const [lancamentos, categorias, resumo] = await Promise.all([
    query(`
      SELECT fc.id, fc.tipo, fc.valor, fc.descricao, fc.data_lancamento, fc.criado_em,
             cf.nome as categoria_nome, cf.icone as categoria_icone,
             u.nome as usuario_nome
      FROM fluxo_caixa fc
      JOIN categorias_financeiro cf ON cf.id = fc.categoria_id
      LEFT JOIN usuarios u ON u.id = fc.usuario_id
      ORDER BY fc.criado_em DESC
      LIMIT 200
    `),
    query(`SELECT id, tipo, nome, icone FROM categorias_financeiro ORDER BY tipo, nome`),
    queryOne(`
      SELECT
        ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 2) AS total_entradas,
        ROUND(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2) AS total_saidas,
        ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE -valor END), 2) AS saldo
      FROM fluxo_caixa
      WHERE data_lancamento >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `),
  ]);

  return NextResponse.json({
    lancamentos,
    categorias,
    resumo,
  });
}

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const { categoria_id, valor, descricao } = await req.json();
  if (!categoria_id || !valor || !descricao) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  const cat = await queryOne<{ tipo: string }>(`SELECT tipo FROM categorias_financeiro WHERE id=?`, [categoria_id]);
  const tipo = cat?.tipo ?? 'saida';

  await exec(
    `INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, data_lancamento, usuario_id, criado_em)
     VALUES (?, ?, ?, ?, ?, CURDATE(), ?, NOW())`,
    [uuid(), tipo, categoria_id, valor, descricao, user.id]
  );

  return NextResponse.json({ ok: true });
}
