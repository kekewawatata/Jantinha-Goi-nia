/**
 * lib/business/pedidos.ts
 * Regras de negócio para criação e fechamento de pedidos (MySQL).
 */

import { query, queryOne, exec, withTransaction } from '../db';
import crypto from 'crypto';
import { processarBaixaPedido } from './estoque';

function uuid() { return crypto.randomUUID(); }

export interface ItemCarrinho {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  espetinho_escolhido_id?: string;
  observacao_item?: string;
  destino_producao: string;
}

// ─── Criar novo pedido (Transação Atômica) ──────────────────────────────────
export async function criarPedido(
  tipo: 'balcao' | 'mesa',
  itens: ItemCarrinho[],
  usuarioId: string,
  mesa_numero?: string,
  observacao?: string
) {
  const pedidoId = uuid();
  const valorTotal = itens.reduce((acc, i) => acc + Number(i.preco_unitario) * Number(i.quantidade), 0);

  return await withTransaction(async (conn) => {
    // Incrementa e bloqueia a sequência de pedidos com segurança
    await conn.execute(`UPDATE pedido_seq SET seq = seq + 1 WHERE id = 1`);
    const [seqRows] = await conn.execute(`SELECT seq FROM pedido_seq WHERE id = 1`);
    const seq = Number((seqRows as any[])[0]?.seq ?? 1);

    await conn.execute(
      `INSERT INTO pedidos (id, numero, tipo, mesa_numero, status, valor_total, usuario_caixa_id, observacao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, 'em_preparo', ?, ?, ?, NOW(), NOW())`,
      [pedidoId, seq, tipo, mesa_numero ?? null, valorTotal, usuarioId, observacao ?? null]
    );

    for (const item of itens) {
      const statusInicial = item.destino_producao === 'balcao' ? 'pronto' : 'aguardando';
      await conn.execute(
        `INSERT INTO itens_pedido
           (id, pedido_id, produto_id, quantidade, preco_unitario, espetinho_escolhido_id,
            observacao_item, status_producao, destino_producao, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuid(), pedidoId, item.produto_id, item.quantidade, item.preco_unitario,
          item.espetinho_escolhido_id ?? null, item.observacao_item ?? null,
          statusInicial, item.destino_producao,
        ]
      );
    }

    return { pedidoId, numero: seq, valorTotal };
  });
}

// ─── Fechar pedido (pagamento) ───────────────────────────────────────────────
export async function fecharPedido(
  pedidoId: string,
  formaPagamento: string,
  valorPago: number,
  usuarioId: string
) {
  await exec(
    `UPDATE pedidos
     SET forma_pagamento = ?, valor_pago = ?, status = 'em_preparo', atualizado_em = NOW()
     WHERE id = ?`,
    [formaPagamento, valorPago, pedidoId]
  );

  // Baixa o estoque
  await processarBaixaPedido(pedidoId, usuarioId);

  // Lança entrada no fluxo de caixa
  const pedido = await queryOne<{ valor_total: number; tipo: string }>(
    `SELECT valor_total, tipo FROM pedidos WHERE id = ?`,
    [pedidoId]
  );
  const catNome = pedido?.tipo === 'mesa' ? 'Venda Mesa' : 'Venda Balcão';

  const cat = await queryOne<{ id: number }>(
    `SELECT id FROM categorias_financeiro WHERE nome = ?`,
    [catNome]
  );
  const catId = cat?.id ?? 1;

  await exec(
    `INSERT INTO fluxo_caixa (id, tipo, categoria_id, valor, descricao, referencia_pedido_id, data_lancamento, usuario_id, criado_em)
     VALUES (?, 'entrada', ?, ?, ?, ?, CURDATE(), ?, NOW())`,
    [uuid(), catId, pedido?.valor_total ?? 0, `Venda #${pedidoId.slice(0, 8)}`, pedidoId, usuarioId]
  );
}

// ─── Marcar pedido como entregue ─────────────────────────────────────────────
export async function marcarPedidoEntregue(pedidoId: string) {
  await exec(
    `UPDATE pedidos
     SET status = 'entregue', entregue_em = NOW(), atualizado_em = NOW()
     WHERE id = ?`,
    [pedidoId]
  );

  await exec(
    `UPDATE itens_pedido
     SET status_producao = 'entregue'
     WHERE pedido_id = ? AND status_producao != 'cancelado'`,
    [pedidoId]
  );
}

// ─── Atualizar status de item de produção ────────────────────────────────────
export async function atualizarStatusItem(
  itemId: string,
  novoStatus: 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
) {
  await exec(
    `UPDATE itens_pedido SET status_producao = ? WHERE id = ?`,
    [novoStatus, itemId]
  );

  if (novoStatus === 'pronto') {
    const item = await queryOne<{ pedido_id: string }>(
      `SELECT pedido_id FROM itens_pedido WHERE id = ?`,
      [itemId]
    );
    if (item) {
      const pendentes = await queryOne<{ c: number }>(
        `SELECT COUNT(*) as c FROM itens_pedido
         WHERE pedido_id = ? AND status_producao NOT IN ('pronto','entregue','cancelado')`,
        [item.pedido_id]
      );

      if (Number(pendentes?.c ?? 0) === 0) {
        await exec(
          `UPDATE pedidos SET status = 'pronto', atualizado_em = NOW() WHERE id = ?`,
          [item.pedido_id]
        );
      }
    }
  }
}

// ─── Cancelar pedido ─────────────────────────────────────────────────────────
export async function cancelarPedido(pedidoId: string, usuarioId: string, motivo: string) {
  await exec(
    `UPDATE pedidos
     SET status = 'cancelado', cancelado_por_id = ?, motivo_cancelamento = ?, atualizado_em = NOW()
     WHERE id = ?`,
    [usuarioId, motivo, pedidoId]
  );

  await exec(
    `UPDATE itens_pedido SET status_producao = 'cancelado' WHERE pedido_id = ?`,
    [pedidoId]
  );
}
