// app/api/dashboard/limpar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/init';
import { exec } from '@/lib/db';
import { verificarToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  await initDb();
  const token = req.cookies.get('auth_token')?.value;
  const user = token ? verificarToken(token) : null;
  if (!user || user.perfil !== 'adm') {
    return NextResponse.json({ error: 'Não autorizado. Apenas administradores podem limpar o histórico do Dashboard.' }, { status: 403 });
  }

  try {
    await exec(`DELETE FROM movimentacoes_estoque WHERE referencia_tipo = 'pedido'`);
    await exec(`DELETE FROM alertas_estoque`);
    await exec(`
      DELETE FROM fluxo_caixa
      WHERE referencia_pedido_id IS NOT NULL
         OR categoria_id IN (SELECT id FROM categorias_financeiro WHERE nome IN ('Venda Balcão', 'Venda Mesa'))
    `);
    await exec(`UPDATE fluxo_caixa SET referencia_pedido_id = NULL WHERE referencia_pedido_id IS NOT NULL`);
    await exec(`DELETE FROM itens_pedido`);
    await exec(`DELETE FROM pedidos`);
    await exec(`UPDATE pedido_seq SET seq = 0 WHERE id = 1`);

    return NextResponse.json({
      ok: true,
      mensagem: 'Histórico de pedidos e vendas do Dashboard limpo com sucesso! A sequência de pedidos recomeçará do #1.',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
