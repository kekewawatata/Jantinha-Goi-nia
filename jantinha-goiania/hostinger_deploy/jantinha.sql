-- ============================================================
-- BANCO DE DADOS: Jantinha Goiania (MySQL / Hostinger)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Tabela: unidades_medida
-- --------------------------------------------------------
DROP TABLE IF EXISTS `unidades_medida`;
CREATE TABLE `unidades_medida` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sigla` varchar(10) NOT NULL,
  `nome` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sigla` (`sigla`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `unidades_medida` (`id`, `sigla`, `nome`) VALUES
(1, 'kg', 'Quilograma'),
(2, 'g', 'Grama'),
(3, 'un', 'Unidade'),
(4, 'L', 'Litro'),
(5, 'ml', 'Mililitro');

-- --------------------------------------------------------
-- Tabela: usuarios
-- --------------------------------------------------------
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` varchar(36) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `senha_hash` varchar(64) NOT NULL,
  `perfil` enum('adm','caixa','cozinha') NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultimo_acesso` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Senha adm123: fcef631eab0be0f69d940e737b136e0cbcf4f6f1de81f50822862002655af92e
-- Senha caixa123: 59c7c57e6516f4a4ae85214acbd322b724cb755806c4183587a5007c9ca3af23
INSERT INTO `usuarios` (`id`, `nome`, `email`, `senha_hash`, `perfil`, `ativo`) VALUES
('usr-adm-001', 'Administrador', 'adm@jantinha.com', 'fcef631eab0be0f69d940e737b136e0cbcf4f6f1de81f50822862002655af92e', 'adm', 1),
('usr-caixa-002', 'Atendente', 'caixa@jantinha.com', '59c7c57e6516f4a4ae85214acbd322b724cb755806c4183587a5007c9ca3af23', 'caixa', 1);

-- --------------------------------------------------------
-- Tabela: insumos
-- --------------------------------------------------------
DROP TABLE IF EXISTS `insumos`;
CREATE TABLE `insumos` (
  `id` varchar(36) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text DEFAULT NULL,
  `unidade_medida_id` int(11) NOT NULL,
  `custo_unitario` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `estoque_atual` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `estoque_minimo` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `estoque_maximo` decimal(15,4) DEFAULT NULL,
  `fator_rendimento` decimal(10,4) NOT NULL DEFAULT 1.0000,
  `validade_dias` int(11) DEFAULT NULL,
  `perecivel` tinyint(1) NOT NULL DEFAULT 0,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `unidade_medida_id` (`unidade_medida_id`),
  CONSTRAINT `fk_insumos_unidade` FOREIGN KEY (`unidade_medida_id`) REFERENCES `unidades_medida` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `insumos` (`id`, `nome`, `unidade_medida_id`, `custo_unitario`, `estoque_atual`, `estoque_minimo`, `perecivel`, `validade_dias`) VALUES
('ins-01', 'Contrafilé (Medalhão)', 3, 5.0000, 20.0000, 10.0000, 1, 3),
('ins-02', 'Frango (Peito/Coxa)', 3, 3.5000, 20.0000, 10.0000, 1, 3),
('ins-03', 'Coração de Frango', 3, 3.0000, 20.0000, 10.0000, 1, 3),
('ins-04', 'Bacon (Tiras)', 3, 2.5000, 10.0000, 5.0000, 1, 5),
('ins-05', 'Arroz Cru (Tipo 1)', 3, 1.5000, 20.0000, 10.0000, 0, 180),
('ins-06', 'Feijão Carioca Cru', 3, 1.5000, 20.0000, 10.0000, 0, 180),
('ins-07', 'Farinha de Mandioca', 3, 1.0000, 10.0000, 5.0000, 0, 90),
('ins-08', 'Mandioca In Natura', 3, 1.5000, 20.0000, 10.0000, 1, 7),
('ins-09', 'Carvão Vegetal', 3, 3.5000, 20.0000, 10.0000, 0, 365),
('ins-10', 'Espeto de Madeira', 3, 0.1000, 100.0000, 50.0000, 0, 365),
('ins-11', 'Alho', 3, 1.0000, 10.0000, 5.0000, 1, 30),
('ins-12', 'Sal Refinado', 3, 0.5000, 10.0000, 5.0000, 0, 365),
('ins-13', 'Vinagrete', 3, 1.5000, 20.0000, 10.0000, 1, 2),
('ins-14', 'Óleo de Soja', 3, 2.0000, 10.0000, 5.0000, 0, 180),
('ins-15', 'Tempero Verde', 3, 1.0000, 10.0000, 5.0000, 1, 5),
('ins-16', 'Queijo Coalho', 3, 4.0000, 10.0000, 5.0000, 1, 7);

-- --------------------------------------------------------
-- Tabela: lotes_estoque
-- --------------------------------------------------------
DROP TABLE IF EXISTS `lotes_estoque`;
CREATE TABLE `lotes_estoque` (
  `id` varchar(36) NOT NULL,
  `insumo_id` varchar(36) NOT NULL,
  `quantidade` decimal(15,4) NOT NULL,
  `custo_total` decimal(15,4) NOT NULL,
  `custo_unitario` decimal(15,4) NOT NULL,
  `data_compra` date NOT NULL,
  `data_validade` date DEFAULT NULL,
  `fornecedor` varchar(100) DEFAULT NULL,
  `nota_fiscal` varchar(50) DEFAULT NULL,
  `usuario_id` varchar(36) DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `insumo_id` (`insumo_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_lotes_insumo` FOREIGN KEY (`insumo_id`) REFERENCES `insumos` (`id`),
  CONSTRAINT `fk_lotes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Tabela: movimentacoes_estoque
-- --------------------------------------------------------
DROP TABLE IF EXISTS `movimentacoes_estoque`;
CREATE TABLE `movimentacoes_estoque` (
  `id` varchar(36) NOT NULL,
  `insumo_id` varchar(36) NOT NULL,
  `tipo` enum('entrada','saida_venda','saida_desperdicio','saida_ajuste','entrada_ajuste') NOT NULL,
  `quantidade` decimal(15,4) NOT NULL,
  `custo_unitario` decimal(15,4) DEFAULT NULL,
  `referencia_id` varchar(36) DEFAULT NULL,
  `referencia_tipo` varchar(30) DEFAULT NULL,
  `observacao` text DEFAULT NULL,
  `usuario_id` varchar(36) DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_movest_insumo` (`insumo_id`,`criado_em`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_mov_insumo` FOREIGN KEY (`insumo_id`) REFERENCES `insumos` (`id`),
  CONSTRAINT `fk_mov_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Tabela: categorias_produto
-- --------------------------------------------------------
DROP TABLE IF EXISTS `categorias_produto`;
CREATE TABLE `categorias_produto` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `icone` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `categorias_produto` (`id`, `nome`, `icone`) VALUES
(1, 'Espetinho', '🍢'),
(2, 'Jantinha Simples', '🍱'),
(3, 'Jantinha Completa', '🍽️'),
(4, 'Bebida', '🥤'),
(5, 'Adicional', '➕');

-- --------------------------------------------------------
-- Tabela: produtos
-- --------------------------------------------------------
DROP TABLE IF EXISTS `produtos`;
CREATE TABLE `produtos` (
  `id` varchar(36) NOT NULL,
  `categoria_id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text DEFAULT NULL,
  `preco_venda` decimal(15,4) NOT NULL,
  `preco_custo` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `disponivel` tinyint(1) NOT NULL DEFAULT 1,
  `destino_producao` enum('churrasqueira','cozinha','geral','balcao') NOT NULL DEFAULT 'geral',
  `permite_adicional` tinyint(1) NOT NULL DEFAULT 0,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `fk_produtos_cat` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_produto` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `produtos` (`id`, `categoria_id`, `nome`, `preco_venda`, `destino_producao`) VALUES
('prod-01', 1, 'Espetinho de Medalhão', 7.0000, 'churrasqueira'),
('prod-02', 1, 'Espetinho de Frango c/ Bacon', 6.5000, 'churrasqueira'),
('prod-03', 1, 'Espetinho de Coração', 5.5000, 'churrasqueira'),
('prod-04', 1, 'Espetinho de Queijo Coalho', 6.0000, 'churrasqueira'),
('prod-05', 2, 'Jantinha Simples', 15.0000, 'cozinha'),
('prod-06', 3, 'Jantinha Completa', 22.0000, 'cozinha'),
('prod-07', 4, 'Refrigerante Lata 350ml', 5.0000, 'balcao'),
('prod-08', 4, 'Água Mineral 500ml', 3.0000, 'balcao'),
('prod-09', 4, 'Suco de Laranja 300ml', 6.0000, 'balcao'),
('prod-10', 5, 'Porção Extra de Arroz', 3.0000, 'cozinha'),
('prod-11', 5, 'Porção Extra de Tropeiro', 4.0000, 'cozinha'),
('prod-12', 5, 'Porção Extra de Mandioca', 4.0000, 'cozinha');

-- --------------------------------------------------------
-- Tabela: ficha_tecnica
-- --------------------------------------------------------
DROP TABLE IF EXISTS `ficha_tecnica`;
CREATE TABLE `ficha_tecnica` (
  `id` varchar(36) NOT NULL,
  `produto_id` varchar(36) NOT NULL,
  `insumo_id` varchar(36) NOT NULL,
  `quantidade_bruta` decimal(15,4) NOT NULL,
  `ordem` int(11) NOT NULL DEFAULT 1,
  `observacao` text DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ft_prod_ins` (`produto_id`,`insumo_id`),
  KEY `idx_ficha_produto` (`produto_id`),
  KEY `insumo_id` (`insumo_id`),
  CONSTRAINT `fk_ft_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ft_insumo` FOREIGN KEY (`insumo_id`) REFERENCES `insumos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `ficha_tecnica` (`id`, `produto_id`, `insumo_id`, `quantidade_bruta`, `ordem`) VALUES
('ft-01', 'prod-01', 'ins-01', 0.1200, 1),
('ft-02', 'prod-01', 'ins-10', 1.0000, 2),
('ft-03', 'prod-01', 'ins-12', 0.0030, 3),
('ft-04', 'prod-02', 'ins-02', 0.0900, 1),
('ft-05', 'prod-02', 'ins-04', 0.0200, 2),
('ft-06', 'prod-02', 'ins-10', 1.0000, 3),
('ft-07', 'prod-02', 'ins-12', 0.0030, 4),
('ft-08', 'prod-03', 'ins-03', 0.1000, 1),
('ft-09', 'prod-03', 'ins-10', 1.0000, 2),
('ft-10', 'prod-03', 'ins-12', 0.0030, 3),
('ft-11', 'prod-04', 'ins-16', 0.0800, 1),
('ft-12', 'prod-04', 'ins-10', 1.0000, 2),
('ft-13', 'prod-05', 'ins-05', 0.0600, 1),
('ft-14', 'prod-05', 'ins-06', 0.0600, 2),
('ft-15', 'prod-05', 'ins-04', 0.0200, 3),
('ft-16', 'prod-05', 'ins-07', 0.0150, 4),
('ft-17', 'prod-05', 'ins-08', 0.1180, 5),
('ft-18', 'prod-05', 'ins-13', 0.0500, 6),
('ft-19', 'prod-05', 'ins-11', 0.0050, 7),
('ft-20', 'prod-05', 'ins-12', 0.0030, 8),
('ft-21', 'prod-05', 'ins-14', 0.0050, 9),
('ft-22', 'prod-06', 'ins-05', 0.0600, 1),
('ft-23', 'prod-06', 'ins-06', 0.0600, 2),
('ft-24', 'prod-06', 'ins-04', 0.0200, 3),
('ft-25', 'prod-06', 'ins-07', 0.0150, 4),
('ft-26', 'prod-06', 'ins-08', 0.1180, 5),
('ft-27', 'prod-06', 'ins-13', 0.0500, 6),
('ft-28', 'prod-06', 'ins-11', 0.0050, 7),
('ft-29', 'prod-06', 'ins-12', 0.0030, 8),
('ft-30', 'prod-06', 'ins-14', 0.0050, 9);

-- --------------------------------------------------------
-- Tabela: pedidos
-- --------------------------------------------------------
DROP TABLE IF EXISTS `pedidos`;
CREATE TABLE `pedidos` (
  `id` varchar(36) NOT NULL,
  `numero` int(11) NOT NULL,
  `tipo` enum('balcao','mesa') NOT NULL DEFAULT 'balcao',
  `mesa_numero` varchar(10) DEFAULT NULL,
  `status` enum('aberto','em_preparo','pronto','entregue','cancelado') NOT NULL DEFAULT 'aberto',
  `forma_pagamento` enum('dinheiro','pix','cartao_credito','cartao_debito','fiado') DEFAULT NULL,
  `valor_total` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `valor_pago` decimal(15,4) DEFAULT NULL,
  `observacao` text DEFAULT NULL,
  `usuario_caixa_id` varchar(36) DEFAULT NULL,
  `cancelado_por_id` varchar(36) DEFAULT NULL,
  `motivo_cancelamento` text DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `entregue_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pedidos_status` (`status`),
  KEY `idx_pedidos_data` (`criado_em`),
  KEY `idx_pedidos_mesa_status` (`tipo`, `status`, `mesa_numero`),
  KEY `idx_pedidos_mesa_num` (`mesa_numero`),
  KEY `usuario_caixa_id` (`usuario_caixa_id`),
  KEY `cancelado_por_id` (`cancelado_por_id`),
  CONSTRAINT `fk_pedidos_caixa` FOREIGN KEY (`usuario_caixa_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_pedidos_cancelador` FOREIGN KEY (`cancelado_por_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Tabela: pedido_seq
-- --------------------------------------------------------
DROP TABLE IF EXISTS `pedido_seq`;
CREATE TABLE `pedido_seq` (
  `id` int(11) NOT NULL,
  `seq` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `pedido_seq` (`id`, `seq`) VALUES (1, 0);

-- --------------------------------------------------------
-- Tabela: itens_pedido
-- --------------------------------------------------------
DROP TABLE IF EXISTS `itens_pedido`;
CREATE TABLE `itens_pedido` (
  `id` varchar(36) NOT NULL,
  `pedido_id` varchar(36) NOT NULL,
  `produto_id` varchar(36) NOT NULL,
  `quantidade` int(11) NOT NULL DEFAULT 1,
  `preco_unitario` decimal(15,4) NOT NULL,
  `espetinho_escolhido_id` varchar(36) DEFAULT NULL,
  `observacao_item` text DEFAULT NULL,
  `status_producao` enum('aguardando','em_preparo','pronto','entregue','cancelado') NOT NULL DEFAULT 'aguardando',
  `destino_producao` varchar(30) NOT NULL DEFAULT 'geral',
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_itens_pedido` (`pedido_id`),
  KEY `idx_itens_produto` (`produto_id`),
  KEY `idx_itens_producao_status` (`status_producao`, `destino_producao`),
  KEY `espetinho_escolhido_id` (`espetinho_escolhido_id`),
  CONSTRAINT `fk_itens_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_itens_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`),
  CONSTRAINT `fk_itens_espetinho` FOREIGN KEY (`espetinho_escolhido_id`) REFERENCES `produtos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Tabela: categorias_financeiro
-- --------------------------------------------------------
DROP TABLE IF EXISTS `categorias_financeiro`;
CREATE TABLE `categorias_financeiro` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` enum('entrada','saida') NOT NULL,
  `nome` varchar(100) NOT NULL,
  `icone` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `categorias_financeiro` (`id`, `tipo`, `nome`, `icone`) VALUES
(1, 'entrada', 'Venda Balcão', '💰'),
(2, 'entrada', 'Venda Mesa', '🍽️'),
(3, 'entrada', 'Ajuste/Estorno', '↩️'),
(4, 'saida', 'Compra de Insumos', '🛒'),
(5, 'saida', 'Carvão e Descartáveis', '🔥'),
(6, 'saida', 'Gás de Cozinha', '💨'),
(7, 'saida', 'Mão de Obra', '👷'),
(8, 'saida', 'Aluguel/Ponto', '🏠'),
(9, 'saida', 'Desperdício/Descarte', '🗑️'),
(10, 'saida', 'Outros Custos', '📋');

-- --------------------------------------------------------
-- Tabela: fluxo_caixa
-- --------------------------------------------------------
DROP TABLE IF EXISTS `fluxo_caixa`;
CREATE TABLE `fluxo_caixa` (
  `id` varchar(36) NOT NULL,
  `tipo` enum('entrada','saida') NOT NULL,
  `categoria_id` int(11) NOT NULL,
  `valor` decimal(15,4) NOT NULL,
  `descricao` varchar(255) NOT NULL,
  `referencia_pedido_id` varchar(36) DEFAULT NULL,
  `referencia_lote_id` varchar(36) DEFAULT NULL,
  `data_lancamento` date NOT NULL,
  `usuario_id` varchar(36) DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fluxo_data` (`data_lancamento`),
  KEY `categoria_id` (`categoria_id`),
  KEY `referencia_pedido_id` (`referencia_pedido_id`),
  KEY `referencia_lote_id` (`referencia_lote_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `fk_fluxo_cat` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_financeiro` (`id`),
  CONSTRAINT `fk_fluxo_pedido` FOREIGN KEY (`referencia_pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `fk_fluxo_lote` FOREIGN KEY (`referencia_lote_id`) REFERENCES `lotes_estoque` (`id`),
  CONSTRAINT `fk_fluxo_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Tabela: alertas_estoque
-- --------------------------------------------------------
DROP TABLE IF EXISTS `alertas_estoque`;
CREATE TABLE `alertas_estoque` (
  `id` varchar(36) NOT NULL,
  `insumo_id` varchar(36) NOT NULL,
  `tipo_alerta` enum('estoque_minimo','validade_proxima','estoque_zerado') NOT NULL,
  `mensagem` text NOT NULL,
  `resolvido` tinyint(1) NOT NULL DEFAULT 0,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolvido_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `insumo_id` (`insumo_id`),
  CONSTRAINT `fk_alertas_insumo` FOREIGN KEY (`insumo_id`) REFERENCES `insumos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
