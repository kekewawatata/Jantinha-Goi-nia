/**
 * lib/migrations.ts
 * Criação de todas as tabelas no MySQL.
 */

import { exec, query } from './db';

async function createIndexSafe(sql: string) {
  try { await exec(sql); } catch (e: any) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
  }
}

export async function runMigrations() {
  await exec(`
    CREATE TABLE IF NOT EXISTS unidades_medida (
      id    INT          NOT NULL AUTO_INCREMENT,
      sigla VARCHAR(10)  NOT NULL UNIQUE,
      nome  VARCHAR(100) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            VARCHAR(36)  NOT NULL,
      nome          VARCHAR(100) NOT NULL,
      email         VARCHAR(100) NOT NULL UNIQUE,
      senha_hash    VARCHAR(64)  NOT NULL,
      perfil        ENUM('adm','caixa','cozinha') NOT NULL,
      ativo         TINYINT(1)   NOT NULL DEFAULT 1,
      criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ultimo_acesso DATETIME     NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS insumos (
      id                VARCHAR(36)   NOT NULL,
      nome              VARCHAR(100)  NOT NULL,
      descricao         TEXT          NULL,
      unidade_medida_id INT           NOT NULL,
      custo_unitario    DECIMAL(15,4) NOT NULL DEFAULT 0,
      estoque_atual     DECIMAL(15,4) NOT NULL DEFAULT 0,
      estoque_minimo    DECIMAL(15,4) NOT NULL DEFAULT 0,
      estoque_maximo    DECIMAL(15,4) NULL,
      fator_rendimento  DECIMAL(10,4) NOT NULL DEFAULT 1.0,
      validade_dias     INT           NULL,
      perecivel         TINYINT(1)    NOT NULL DEFAULT 0,
      ativo             TINYINT(1)    NOT NULL DEFAULT 1,
      criado_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (unidade_medida_id) REFERENCES unidades_medida(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS lotes_estoque (
      id              VARCHAR(36)   NOT NULL,
      insumo_id       VARCHAR(36)   NOT NULL,
      quantidade      DECIMAL(15,4) NOT NULL,
      custo_total     DECIMAL(15,4) NOT NULL,
      custo_unitario  DECIMAL(15,4) NOT NULL,
      data_compra     DATE          NOT NULL,
      data_validade   DATE          NULL,
      fornecedor      VARCHAR(100)  NULL,
      nota_fiscal     VARCHAR(50)   NULL,
      usuario_id      VARCHAR(36)   NULL,
      criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (insumo_id)  REFERENCES insumos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id              VARCHAR(36)   NOT NULL,
      insumo_id       VARCHAR(36)   NOT NULL,
      tipo            ENUM('entrada','saida_venda','saida_desperdicio','saida_ajuste','entrada_ajuste') NOT NULL,
      quantidade      DECIMAL(15,4) NOT NULL,
      custo_unitario  DECIMAL(15,4) NULL,
      referencia_id   VARCHAR(36)   NULL,
      referencia_tipo VARCHAR(30)   NULL,
      observacao      TEXT          NULL,
      usuario_id      VARCHAR(36)   NULL,
      criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (insumo_id)  REFERENCES insumos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS categorias_produto (
      id    INT          NOT NULL AUTO_INCREMENT,
      nome  VARCHAR(100) NOT NULL UNIQUE,
      icone VARCHAR(20)  NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id                VARCHAR(36)   NOT NULL,
      categoria_id      INT           NOT NULL,
      nome              VARCHAR(100)  NOT NULL,
      descricao         TEXT          NULL,
      preco_venda       DECIMAL(15,4) NOT NULL,
      preco_custo       DECIMAL(15,4) NOT NULL DEFAULT 0,
      disponivel        TINYINT(1)    NOT NULL DEFAULT 1,
      destino_producao  ENUM('churrasqueira','cozinha','geral','balcao') NOT NULL DEFAULT 'geral',
      permite_adicional TINYINT(1)    NOT NULL DEFAULT 0,
      ativo             TINYINT(1)    NOT NULL DEFAULT 1,
      criado_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (categoria_id) REFERENCES categorias_produto(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS ficha_tecnica (
      id               VARCHAR(36)   NOT NULL,
      produto_id       VARCHAR(36)   NOT NULL,
      insumo_id        VARCHAR(36)   NOT NULL,
      quantidade_bruta DECIMAL(15,4) NOT NULL,
      ordem            INT           NOT NULL DEFAULT 1,
      observacao       TEXT          NULL,
      criado_em        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ft_prod_ins (produto_id, insumo_id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
      FOREIGN KEY (insumo_id)  REFERENCES insumos(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id                  VARCHAR(36)   NOT NULL,
      numero              INT           NOT NULL,
      tipo                ENUM('balcao','mesa') NOT NULL DEFAULT 'balcao',
      mesa_numero         VARCHAR(10)   NULL,
      status              ENUM('aberto','em_preparo','pronto','entregue','cancelado') NOT NULL DEFAULT 'aberto',
      forma_pagamento     ENUM('dinheiro','pix','cartao_credito','cartao_debito','fiado') NULL,
      valor_total         DECIMAL(15,4) NOT NULL DEFAULT 0,
      valor_pago          DECIMAL(15,4) NULL,
      observacao          TEXT          NULL,
      usuario_caixa_id    VARCHAR(36)   NULL,
      cancelado_por_id    VARCHAR(36)   NULL,
      motivo_cancelamento TEXT          NULL,
      criado_em           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      entregue_em         DATETIME      NULL,
      PRIMARY KEY (id),
      FOREIGN KEY (usuario_caixa_id) REFERENCES usuarios(id),
      FOREIGN KEY (cancelado_por_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS pedido_seq (
      id  INT NOT NULL,
      seq INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await exec(`INSERT IGNORE INTO pedido_seq (id, seq) VALUES (1, 0)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id                     VARCHAR(36)   NOT NULL,
      pedido_id              VARCHAR(36)   NOT NULL,
      produto_id             VARCHAR(36)   NOT NULL,
      quantidade             INT           NOT NULL DEFAULT 1,
      preco_unitario         DECIMAL(15,4) NOT NULL,
      espetinho_escolhido_id VARCHAR(36)   NULL,
      observacao_item        TEXT          NULL,
      status_producao        ENUM('aguardando','em_preparo','pronto','entregue','cancelado') NOT NULL DEFAULT 'aguardando',
      destino_producao       VARCHAR(30)   NOT NULL DEFAULT 'geral',
      criado_em              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (pedido_id)              REFERENCES pedidos(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id)             REFERENCES produtos(id),
      FOREIGN KEY (espetinho_escolhido_id) REFERENCES produtos(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS categorias_financeiro (
      id    INT         NOT NULL AUTO_INCREMENT,
      tipo  ENUM('entrada','saida') NOT NULL,
      nome  VARCHAR(100) NOT NULL,
      icone VARCHAR(20)  NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS fluxo_caixa (
      id                   VARCHAR(36)   NOT NULL,
      tipo                 ENUM('entrada','saida') NOT NULL,
      categoria_id         INT           NOT NULL,
      valor                DECIMAL(15,4) NOT NULL,
      descricao            VARCHAR(255)  NOT NULL,
      referencia_pedido_id VARCHAR(36)   NULL,
      referencia_lote_id   VARCHAR(36)   NULL,
      data_lancamento      DATE          NOT NULL,
      usuario_id           VARCHAR(36)   NULL,
      criado_em            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (categoria_id)         REFERENCES categorias_financeiro(id),
      FOREIGN KEY (referencia_pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (referencia_lote_id)   REFERENCES lotes_estoque(id),
      FOREIGN KEY (usuario_id)           REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS alertas_estoque (
      id           VARCHAR(36)  NOT NULL,
      insumo_id    VARCHAR(36)  NOT NULL,
      tipo_alerta  ENUM('estoque_minimo','validade_proxima','estoque_zerado') NOT NULL,
      mensagem     TEXT         NOT NULL,
      resolvido    TINYINT(1)   NOT NULL DEFAULT 0,
      criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolvido_em DATETIME     NULL,
      PRIMARY KEY (id),
      FOREIGN KEY (insumo_id) REFERENCES insumos(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Índices estratégicos de alta performance (ignoram erro se já existirem)
  await createIndexSafe(`CREATE INDEX idx_pedidos_status        ON pedidos(status)`);
  await createIndexSafe(`CREATE INDEX idx_pedidos_data          ON pedidos(criado_em)`);
  await createIndexSafe(`CREATE INDEX idx_pedidos_mesa_status   ON pedidos(tipo, status, mesa_numero)`);
  await createIndexSafe(`CREATE INDEX idx_pedidos_mesa_num      ON pedidos(mesa_numero)`);
  await createIndexSafe(`CREATE INDEX idx_itens_pedido          ON itens_pedido(pedido_id)`);
  await createIndexSafe(`CREATE INDEX idx_itens_produto         ON itens_pedido(produto_id)`);
  await createIndexSafe(`CREATE INDEX idx_itens_producao_status ON itens_pedido(status_producao, destino_producao)`);
  await createIndexSafe(`CREATE INDEX idx_produtos_cat_ativo    ON produtos(categoria_id, ativo, disponivel)`);
  await createIndexSafe(`CREATE INDEX idx_alertas_resolvido     ON alertas_estoque(resolvido, criado_em)`);
  await createIndexSafe(`CREATE INDEX idx_movest_insumo         ON movimentacoes_estoque(insumo_id, criado_em)`);
  await createIndexSafe(`CREATE INDEX idx_fluxo_data            ON fluxo_caixa(data_lancamento)`);
  await createIndexSafe(`CREATE INDEX idx_ficha_produto         ON ficha_tecnica(produto_id)`);
}
