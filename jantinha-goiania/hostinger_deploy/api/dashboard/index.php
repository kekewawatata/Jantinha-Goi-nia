<?php
// hostinger_deploy/api/dashboard/index.php
require_once __DIR__ . '/../db.php';

$pdo = get_db();

// Período selecionado: semanal, mensal, anual (default: semanal)
$periodo = strtolower(trim($_GET['periodo'] ?? 'semanal'));
if (!in_array($periodo, ['semanal', 'mensal', 'anual'])) {
    $periodo = 'semanal';
}

// 1. Resumo do dia
$stmtResumo = $pdo->query("
    SELECT
        COUNT(*)                                                      AS total_pedidos,
        ROUND(COALESCE(SUM(valor_total), 0), 2)                      AS faturamento_hoje,
        ROUND(COALESCE(AVG(valor_total), 0), 2)                      AS ticket_medio,
        COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END), 0) AS cancelamentos
    FROM pedidos
    WHERE DATE(criado_em) = CURDATE()
");
$resumoDia = $stmtResumo->fetch();

// 2. Insumos críticos
$stmtCriticos = $pdo->query("
    SELECT COUNT(*) as c FROM insumos
    WHERE ativo = 1 AND estoque_atual <= estoque_minimo
");
$insumosCriticos = (int)($stmtCriticos->fetch()['c'] ?? 0);

// 3. Faturamento vs Custo com agrupamento por período
$tz = new DateTimeZone('America/Sao_Paulo');
$hoje = new DateTime('now', $tz);
$hojeStr = $hoje->format('Y-m-d');
$ano = (int)$hoje->format('Y');
$mes = (int)$hoje->format('m');
$dia = (int)$hoje->format('d');

$faturamentoCusto = [];

if ($periodo === 'semanal') {
    // ─── SEMANAL: 7 dias da semana atual (Segunda a Domingo) ───
    $diaSemanaN = (int)$hoje->format('N'); // 1 = Segunda ... 7 = Domingo
    $segunda = clone $hoje;
    $segunda->modify('-' . ($diaSemanaN - 1) . ' days');
    $segundaStr = $segunda->format('Y-m-d');

    $domingo = clone $segunda;
    $domingo->modify('+6 days');
    $domingoStr = $domingo->format('Y-m-d');

    $stmtFat = $pdo->prepare("
        SELECT
            data_lancamento                                                AS data,
            ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 2) AS faturamento,
            ROUND(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2) AS custos,
            ROUND(
                SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) -
                SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2
            ) AS lucro_bruto
        FROM fluxo_caixa
        WHERE data_lancamento BETWEEN ? AND ?
        GROUP BY data_lancamento
        ORDER BY data_lancamento ASC
    ");
    $stmtFat->execute([$segundaStr, $domingoStr]);
    $rows = $stmtFat->fetchAll();

    $mapDados = [];
    foreach ($rows as $r) {
        $mapDados[substr($r['data'], 0, 10)] = $r;
    }

    $nomesDias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    $nomesCompletos = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    for ($i = 0; $i < 7; $i++) {
        $curD = clone $segunda;
        $curD->modify("+$i days");
        $dStr = $curD->format('Y-m-d');
        $sublabel = $curD->format('d/m');
        $r = $mapDados[$dStr] ?? null;

        $faturamentoCusto[] = [
            'label'        => $nomesDias[$i],
            'sublabel'     => $sublabel,
            'nomeCompleto' => $nomesCompletos[$i] . "-feira ($sublabel)",
            'data'         => $dStr,
            'faturamento'  => (float)($r['faturamento'] ?? 0),
            'custos'       => (float)($r['custos'] ?? 0),
            'lucro_bruto'  => (float)($r['lucro_bruto'] ?? 0),
            'hoje'         => ($dStr === $hojeStr),
            'futuro'       => ($dStr > $hojeStr),
        ];
    }
} elseif ($periodo === 'anual') {
    // ─── ANUAL: 12 meses do ano atual (Janeiro a Dezembro) ───
    $stmtFat = $pdo->prepare("
        SELECT
            MONTH(data_lancamento)                                         AS mes,
            ROUND(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END), 2) AS faturamento,
            ROUND(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2) AS custos,
            ROUND(
                SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) -
                SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END), 2
            ) AS lucro_bruto
        FROM fluxo_caixa
        WHERE data_lancamento BETWEEN ? AND ?
        GROUP BY MONTH(data_lancamento)
        ORDER BY mes ASC
    ");
    $stmtFat->execute(["$ano-01-01", "$ano-12-31"]);
    $rows = $stmtFat->fetchAll();

    $mapMeses = [];
    foreach ($rows as $r) {
        $mapMeses[(int)$r['mes']] = $r;
    }

    $nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    $nomesMesesCompletos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    for ($m = 1; $m <= 12; $m++) {
        $r = $mapMeses[$m] ?? null;
        $faturamentoCusto[] = [
            'label'        => $nomesMeses[$m - 1],
            'sublabel'     => (string)$ano,
            'nomeCompleto' => $nomesMesesCompletos[$m - 1] . " / $ano",
            'data'         => sprintf('%04d-%02d-01', $ano, $m),
            'faturamento'  => (float)($r['faturamento'] ?? 0),
            'custos'       => (float)($r['custos'] ?? 0),
            'lucro_bruto'  => (float)($r['lucro_bruto'] ?? 0),
            'hoje'         => ($m === $mes),
            'futuro'       => ($m > $mes),
        ];
    }
} else {
    // ─── MENSAL: semanas do mês atual (Sem 1 a Sem 4/5) ───
    $primeiroDiaStr = sprintf('%04d-%02d-01', $ano, $mes);
    $ultimoDiaNum = (int)$hoje->format('t'); // número de dias no mês (28 a 31)
    $ultimoDiaStr = sprintf('%04d-%02d-%02d', $ano, $mes, $ultimoDiaNum);

    $stmtFat = $pdo->prepare("
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
        WHERE data_lancamento BETWEEN ? AND ?
        GROUP BY data_lancamento
        ORDER BY data_lancamento ASC
    ");
    $stmtFat->execute([$primeiroDiaStr, $ultimoDiaStr]);
    $rows = $stmtFat->fetchAll();

    $semanas = [
        ['num' => 1, 'inicio' => 1, 'fim' => 7],
        ['num' => 2, 'inicio' => 8, 'fim' => 14],
        ['num' => 3, 'inicio' => 15, 'fim' => 21],
        ['num' => 4, 'inicio' => 22, 'fim' => 28],
    ];
    if ($ultimoDiaNum >= 29) {
        $semanas[] = ['num' => 5, 'inicio' => 29, 'fim' => $ultimoDiaNum];
    }

    foreach ($semanas as $sem) {
        $fat = 0;
        $cus = 0;
        foreach ($rows as $r) {
            $diaNum = (int)$r['dia'];
            if ($diaNum >= $sem['inicio'] && $diaNum <= $sem['fim']) {
                $fat += (float)($r['faturamento'] ?? 0);
                $cus += (float)($r['custos'] ?? 0);
            }
        }
        $sublabel = sprintf('%02d a %02d', $sem['inicio'], $sem['fim']);
        $isAtual = ($dia >= $sem['inicio'] && $dia <= $sem['fim']);
        $isFuturo = ($dia < $sem['inicio']);

        $faturamentoCusto[] = [
            'label'        => 'Sem ' . $sem['num'],
            'sublabel'     => $sublabel,
            'nomeCompleto' => 'Semana ' . $sem['num'] . " ($sublabel/" . sprintf('%02d', $mes) . ")",
            'data'         => sprintf('%04d-%02d-%02d', $ano, $mes, $sem['inicio']),
            'faturamento'  => round($fat, 2),
            'custos'       => round($cus, 2),
            'lucro_bruto'  => round($fat - $cus, 2),
            'hoje'         => $isAtual,
            'futuro'       => $isFuturo,
        ];
    }
}

// 4. Top 5 mais vendidos (7 dias)
$stmtTop5 = $pdo->query("
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
");
$top5 = $stmtTop5->fetchAll();

// 5. Desperdício ontem
$stmtDesp = $pdo->query("
    SELECT
        ROUND(COALESCE(SUM(me.quantidade * i.custo_unitario), 0), 2) AS valor_desperdicado,
        GROUP_CONCAT(i.nome SEPARATOR ', ')                         AS insumos_afetados
    FROM movimentacoes_estoque me
    JOIN insumos i ON i.id = me.insumo_id
    WHERE me.tipo = 'saida_desperdicio'
      AND DATE(me.criado_em) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
");
$desperdicio = $stmtDesp->fetch();

// 6. Comparativo hoje
$stmtComp = $pdo->query("
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
");
$comparativo = $stmtComp->fetch();

// 7. Top 3 produtos margem
$stmtMargem = $pdo->query("
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
");
$topMargem = $stmtMargem->fetchAll();

json_response([
    'periodo'          => $periodo,
    'resumoDia'        => $resumoDia ?: ['total_pedidos' => 0, 'faturamento_hoje' => 0, 'ticket_medio' => 0, 'cancelamentos' => 0],
    'insumosCriticos'  => $insumosCriticos,
    'faturamentoCusto' => $faturamentoCusto ?: [],
    'top5'             => $top5 ?: [],
    'desperdicio'      => $desperdicio ?: ['valor_desperdicado' => 0, 'insumos_afetados' => ''],
    'comparativo'      => $comparativo ?: ['espetinhos_avulsos' => 0, 'espetinhos_em_jantinha' => 0],
    'topMargem'        => $topMargem ?: [],
]);
