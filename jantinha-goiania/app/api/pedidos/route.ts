// app/api/pedidos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { query } from '@/lib/db';
import { criarPedido } from '@/lib/business/pedidos';
import { verificarToken } from '@/lib/auth';

function getUser(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  return token ? verificarToken(token) : null;
}

// GET: listar pedidos ativos
export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'em_preparo,pronto';
  const destino = searchParams.get('destino');
  const data = searchParams.get('data') ?? new Date().toISOString().slice(0, 10);

  const statusValidos = ['aberto', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
  const statusList = status
    .split(',')
    .filter(s => statusValidos.includes(s.trim()))
    .map(s => `'${s.trim()}'`)
    .join(',');

  if (!statusList) {
    return NextResponse.json([]);
  }

  let sql = `
    SELECT
      p.id, p.numero, p.tipo, p.mesa_numero, p.status,
      p.valor_total, p.observacao, p.criado_em,
      JSON_ARRAYAGG(JSON_OBJECT(
        'id',                     ip.id,
        'produto_id',             ip.produto_id,
        'produto_nome',           pr.nome,
        'categoria',              cp.nome,
        'quantidade',             ip.quantidade,
        'preco_unitario',         ip.preco_unitario,
        'status_producao',        ip.status_producao,
        'destino_producao',       ip.destino_producao,
        'espetinho_escolhido_id', ip.espetinho_escolhido_id,
        'espetinho_nome',         esp.nome,
        'observacao_item',        ip.observacao_item
      )) as itens
    FROM pedidos p
    JOIN itens_pedido ip ON ip.pedido_id = p.id
    JOIN produtos pr      ON pr.id = ip.produto_id
    JOIN categorias_produto cp ON cp.id = pr.categoria_id
    LEFT JOIN produtos esp ON esp.id = ip.espetinho_escolhido_id
    WHERE p.status IN (${statusList})
      AND DATE(p.criado_em) = ?
  `;
  const args: unknown[] = [data];

  if (destino) {
    sql += ` AND ip.destino_producao = ?`;
    args.push(destino);
  }

  sql += ` GROUP BY p.id ORDER BY p.criado_em ASC`;

  const rows = await query<Record<string, unknown>>(sql, args);
  const pedidos = rows.map(r => {
    let itens = r.itens;
    if (typeof itens === 'string') {
      try { itens = JSON.parse(itens); } catch { itens = []; }
    }
    return {
      ...r,
      itens: itens ?? [],
    };
  });

  return NextResponse.json(pedidos);
}

// POST: criar novo pedido
export async function POST(req: NextRequest) {
  await initDb();
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const { tipo, itens, mesa_numero, observacao } = body;

  if (!itens?.length) return NextResponse.json({ error: 'Pedido sem itens' }, { status: 400 });

  for (const item of itens) {
    if (!item.produto_id) {
      return NextResponse.json({ error: `Item inválido: produto_id ausente. Item recebido: ${JSON.stringify(item)}` }, { status: 400 });
    }
    if (!item.quantidade || item.quantidade <= 0) {
      return NextResponse.json({ error: `Item inválido: quantidade inválida para produto ${item.produto_id}` }, { status: 400 });
    }
    if (!item.destino_producao) {
      item.destino_producao = 'balcao';
    }
  }

  try {
    const result = await criarPedido(tipo, itens, user.id, mesa_numero, observacao);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
