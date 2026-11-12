/**
 * lib/business/estoque.ts
 * Regras de negócio: baixa de estoque, alertas críticos, cálculo de custo (MySQL).
 */

import { query, queryOne, exec } from '../db';
import crypto from 'crypto';

function uuid() { return crypto.randomUUID(); }

// ─── Baixa de estoque para um produto (por ficha técnica) ────────────────────
export async function baixarEstoqueProduto(
  produtoId: string,
  quantidade: number,
  pedidoId: string,
  usuarioId?: string
) {
  const fichas = await query<{
    insumo_id: string;
    quantidade_bruta: number;
    custo_unitario: number;
    estoque_atual: number;
    nome: string;
  }>(
    `SELECT ft.insumo_id, ft.quantidade_bruta, i.custo_unitario, i.estoque_atual, i.nome
     FROM ficha_tecnica ft
     JOIN insumos i ON i.id = ft.insumo_id
     WHERE ft.produto_id = ?`,
    [produtoId]
  );

  for (const ft of fichas) {
    const baixa = Number(ft.quantidade_bruta) * quantidade;
    await exec(
      `UPDATE insumos SET estoque_atual = GREATEST(0, estoque_atual - ?), atualizado_em = NOW() WHERE id = ?`,
      [baixa, ft.insumo_id]
    );
    await exec(
      `INSERT INTO movimentacoes_estoque
         (id, insumo_id, tipo, quantidade, custo_unitario, referencia_id, referencia_tipo, usuario_id, criado_em)
       VALUES (?, ?, 'saida_venda', ?, ?, ?, 'pedido', ?, NOW())`,
      [uuid(), ft.insumo_id, baixa, ft.custo_unitario, pedidoId, usuarioId ?? null]
    );
  }
}

// ─── Baixa completa de Jantinha Completa (acompanhamentos + espetinho) ───────
export async function baixarJantinhaCompleta(
  itemPedido: { produto_id: string; espetinho_escolhido_id: string; quantidade: number },
  pedidoId: string,
  usuarioId?: string
) {
  await baixarEstoqueProduto(itemPedido.produto_id, itemPedido.quantidade, pedidoId, usuarioId);
  if (itemPedido.espetinho_escolhido_id) {
    await baixarEstoqueProduto(itemPedido.espetinho_escolhido_id, itemPedido.quantidade, pedidoId, usuarioId);
  }
}

// ─── Processar baixa de todos os itens de um pedido ─────────────────────────
export async function processarBaixaPedido(pedidoId: string, usuarioId?: string) {
  const itens = await query<{
    produto_id: string;
    quantidade: number;
    espetinho_escolhido_id: string | null;
    categoria: string;
  }>(
    `SELECT ip.produto_id, ip.quantidade, ip.espetinho_escolhido_id,
            cp.nome as categoria
     FROM itens_pedido ip
     JOIN produtos p ON p.id = ip.produto_id
     JOIN categorias_produto cp ON cp.id = p.categoria_id
     WHERE ip.pedido_id = ?
       AND ip.status_producao != 'cancelado'`,
    [pedidoId]
  );

  for (const item of itens) {
    if (item.categoria === 'Jantinha Completa' && item.espetinho_escolhido_id) {
      await baixarJantinhaCompleta(
        {
          produto_id: item.produto_id,
          espetinho_escolhido_id: item.espetinho_escolhido_id,
          quantidade: Number(item.quantidade),
        },
        pedidoId,
        usuarioId
      );
    } else {
      await baixarEstoqueProduto(item.produto_id, Number(item.quantidade), pedidoId, usuarioId);
    }
  }

  await verificarAlertasEstoque();
}

// ─── Verificar e criar alertas de estoque crítico ────────────────────────────
export async function verificarAlertasEstoque() {
  const insumos = await query<{
    id: string;
    nome: string;
    estoque_atual: number;
    estoque_minimo: number;
    tipo_alerta: string;
  }>(`
    SELECT id, nome, estoque_atual, estoque_minimo,
      CASE
        WHEN estoque_atual = 0                   THEN 'estoque_zerado'
        WHEN estoque_atual <= estoque_minimo      THEN 'estoque_minimo'
        ELSE NULL
      END as tipo_alerta
    FROM insumos
    WHERE ativo = 1
      AND estoque_atual <= estoque_minimo
  `);

  for (const ins of insumos) {
    if (!ins.tipo_alerta) continue;
    const existe = await queryOne<{ id: string }>(
      `SELECT id FROM alertas_estoque WHERE insumo_id = ? AND tipo_alerta = ? AND resolvido = 0`,
      [ins.id, ins.tipo_alerta]
    );
    if (!existe) {
      await exec(
        `INSERT INTO alertas_estoque (id, insumo_id, tipo_alerta, mensagem, criado_em) VALUES (?, ?, ?, ?, NOW())`,
        [
          uuid(),
          ins.id,
          ins.tipo_alerta,
          `${ins.nome}: ${Number(ins.estoque_atual).toFixed(2)} restantes (mínimo: ${ins.estoque_minimo})`,
        ]
      );
    }
  }
}

// ─── Resolver alertas quando estoque for reposto ─────────────────────────────
export async function resolverAlertasInsumo(insumoId: string) {
  await exec(
    `UPDATE alertas_estoque SET resolvido = 1, resolvido_em = NOW()
     WHERE insumo_id = ? AND resolvido = 0`,
    [insumoId]
  );
}

// ─── Calcular custo de um produto via ficha técnica ─────────────────────────
export async function calcularCustoProduto(produtoId: string): Promise<number> {
  const row = await queryOne<{ custo: number }>(
    `SELECT COALESCE(SUM(ft.quantidade_bruta * i.custo_unitario), 0) as custo
     FROM ficha_tecnica ft
     JOIN insumos i ON i.id = ft.insumo_id
     WHERE ft.produto_id = ?`,
    [produtoId]
  );
  return Number(row?.custo ?? 0);
}

// ─── Lançar desperdício manualmente ─────────────────────────────────────────
export async function lancarDesperdicio(
  insumoId: string,
  quantidade: number,
  observacao: string,
  usuarioId?: string
) {
  const insumo = await queryOne<{ custo_unitario: number }>(
    `SELECT custo_unitario FROM insumos WHERE id = ?`,
    [insumoId]
  );
  const custo_unitario = Number(insumo?.custo_unitario ?? 0);

  await exec(
    `UPDATE insumos SET estoque_atual = GREATEST(0, estoque_atual - ?), atualizado_em = NOW() WHERE id = ?`,
    [quantidade, insumoId]
  );

  await exec(
    `INSERT INTO movimentacoes_estoque
       (id, insumo_id, tipo, quantidade, custo_unitario, referencia_tipo, observacao, usuario_id, criado_em)
     VALUES (?, ?, 'saida_desperdicio', ?, ?, 'ajuste_manual', ?, ?, NOW())`,
    [uuid(), insumoId, quantidade, custo_unitario, observacao, usuarioId ?? null]
  );

  const cat = await queryOne<{ id: number }>(
    `SELECT id FROM categorias_financeiro WHERE nome='Desperdício/Descarte'`
  );
  const catId = cat?.id ?? 1;

  await exec(
    `INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, data_lancamento, usuario_id, criado_em)
     VALUES (?, 'saida', ?, ?, ?, CURDATE(), ?, NOW())`,
    [uuid(), catId, quantidade * custo_unitario, `Desperdício: ${observacao}`, usuarioId ?? null]
  );
}
