const pool = require("../config/db");

/* =======================
   RELATÓRIOS FINANCEIROS
   ======================= */

// Financeiro mensal (receitas x despesas)
async function financeiroMensal(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(data, '%Y-%m') AS mes,
             SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS total_receitas,
             SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS total_despesas,
             (SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) -
              SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END)) AS saldo
      FROM financeiro
      GROUP BY mes
      ORDER BY mes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório financeiro" });
  }
}

// Despesas por categoria
async function despesasPorCategoria(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT categoria, SUM(valor) AS total
      FROM financeiro
      WHERE tipo = 'despesa'
      GROUP BY categoria
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório de despesas" });
  }
}

/* ==========================
   RELATÓRIOS PRODUÇÃO ANIMAL
   ========================== */

// Produção animal por mês e tipo
async function producaoAnimalMensal(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT tipo, DATE_FORMAT(data, '%Y-%m') AS mes, SUM(quantidade) AS total
      FROM producao_animal
      GROUP BY tipo, mes
      ORDER BY mes DESC, tipo
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório produção animal" });
  }
}

/* ===========================
   RELATÓRIOS PRODUÇÃO VEGETAL
   =========================== */

// Colheita por safra
async function colheitaPorSafra(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT s.nome AS safra, SUM(pv.quantidade) AS total, pv.unidade
      FROM producao_vegetal pv
      JOIN safras s ON pv.safra_id = s.id
      GROUP BY pv.safra_id, pv.unidade
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório produção vegetal" });
  }
}

// Colheita por plantação
async function colheitaPorPlantacao(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.nome AS plantacao, SUM(pv.quantidade) AS total, pv.unidade
      FROM producao_vegetal pv
      JOIN plantacoes p ON pv.plantacao_id = p.id
      GROUP BY pv.plantacao_id, pv.unidade
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório produção vegetal" });
  }
}

/* =========================
   RELATÓRIOS TRANSACOES
   ========================= */

// Vendas x Compras mensais
async function transacoesMensais(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(data, '%Y-%m') AS mes,
             SUM(CASE WHEN tipo = 'venda' THEN valor_total ELSE 0 END) AS total_vendas,
             SUM(CASE WHEN tipo = 'compra' THEN valor_total ELSE 0 END) AS total_compras
      FROM transacoes
      GROUP BY mes
      ORDER BY mes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório transações" });
  }
}

// Top clientes e fornecedores
async function topEntidades(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT entidade, tipo, SUM(valor_total) AS total
      FROM transacoes
      GROUP BY entidade, tipo
      ORDER BY total DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório entidades" });
  }
}

/* =========================
   RELATÓRIOS PASTAGENS
   ========================= */

// Histórico de uso de pastagens
async function historicoPastagens(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.nome AS pastagem, l.nome AS lote, up.data_inicio, up.data_fim,
             DATEDIFF(IFNULL(up.data_fim, CURDATE()), up.data_inicio) AS dias_ocupacao
      FROM movimentacao_pastos up
      JOIN pastos p ON up.pasto_id = p.id
      JOIN lotes l ON up.lote_id = l.id
      ORDER BY up.data_inicio DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório pastagens" });
  }
}

// Lotação por hectare
async function lotacaoPorHa(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.nome AS pastagem, p.area_ha,
             COUNT(a.id) / p.area_ha AS animais_por_ha
      FROM movimentacao_pastos up
      JOIN pastos p ON up.pasto_id = p.id
      JOIN lotes l ON up.lote_id = l.id
      JOIN animais a ON l.id = a.lote_id
      WHERE up.data_fim IS NULL
      GROUP BY p.id
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório de lotação" });
  }
}

/* =========================
   RELATÓRIOS ANIMAIS
   ========================= */

// Animais em gestação
async function animaisGestantes(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id AS animal_id, 
        a.nome, 
        a.especie, 
        g.data_inseminacao, 
        g.data_prevista_parto,
        g.estado,
        g.observacoes
      FROM gestacoes g
      JOIN animais a ON g.animal_id = a.id
      WHERE g.estado IS NOT NULL
      ORDER BY g.data_prevista_parto ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao buscar animais gestantes" });
  }
}

// Natalidade por mês
async function natalidadeMensal(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(data_parto, '%Y-%m') AS mes,
             COUNT(*) AS total_nascimentos
      FROM natalidade
      GROUP BY mes
      ORDER BY mes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório de natalidade" });
  }
}

// Mortalidade por mês
async function mortalidadeMensal(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(data_morte, '%Y-%m') AS mes,
             COUNT(*) AS total_obitos
      FROM mortalidade
      GROUP BY mes
      ORDER BY mes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao gerar relatório de mortalidade" });
  }
}

// Crescimento do rebanho (absoluto)
async function crescimentoRebanho(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        meses.mes,
        IFNULL(n.nascimentos, 0) AS nascimentos,
        IFNULL(m.mortes, 0) AS mortes,
        (IFNULL(n.nascimentos, 0) - IFNULL(m.mortes, 0)) AS crescimento
      FROM (
        SELECT DISTINCT DATE_FORMAT(data_parto, '%Y-%m') AS mes
        FROM natalidade
        UNION
        SELECT DISTINCT DATE_FORMAT(data_morte, '%Y-%m') AS mes
        FROM mortalidade
      ) meses
      LEFT JOIN (
        SELECT DATE_FORMAT(data_parto, '%Y-%m') AS mes, COUNT(*) AS nascimentos
        FROM natalidade
        GROUP BY mes
      ) n ON meses.mes = n.mes
      LEFT JOIN (
        SELECT DATE_FORMAT(data_morte, '%Y-%m') AS mes, COUNT(*) AS mortes
        FROM mortalidade
        GROUP BY mes
      ) m ON meses.mes = m.mes
      ORDER BY meses.mes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res.status(500).json({ error: "Erro ao calcular crescimento do rebanho" });
  }
}

// Crescimento percentual do rebanho (%)
async function crescimentoPercentual(req, res) {
  try {
    const [rows] = await pool.query(`
      WITH base AS (
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') AS mes,
          COUNT(*) AS total_rebanho
        FROM animais
        GROUP BY mes
      )
      SELECT 
        cr.mes,
        cr.nascimentos,
        cr.mortes,
        cr.crescimento,
        ROUND((cr.crescimento / NULLIF(b.total_rebanho, 0)) * 100, 2) AS taxa_percentual
      FROM (
        SELECT 
          meses.mes,
          IFNULL(n.nascimentos, 0) AS nascimentos,
          IFNULL(m.mortes, 0) AS mortes,
          (IFNULL(n.nascimentos, 0) - IFNULL(m.mortes, 0)) AS crescimento
        FROM (
          SELECT DISTINCT DATE_FORMAT(data_parto, '%Y-%m') AS mes
          FROM natalidade
          UNION
          SELECT DISTINCT DATE_FORMAT(data_morte, '%Y-%m') AS mes
          FROM mortalidade
        ) meses
        LEFT JOIN (
          SELECT DATE_FORMAT(data_parto, '%Y-%m') AS mes, COUNT(*) AS nascimentos
          FROM natalidade
          GROUP BY mes
        ) n ON meses.mes = n.mes
        LEFT JOIN (
          SELECT DATE_FORMAT(data_morte, '%Y-%m') AS mes, COUNT(*) AS mortes
          FROM mortalidade
          GROUP BY mes
        ) m ON meses.mes = m.mes
      ) cr
      LEFT JOIN base b ON cr.mes = b.mes
      ORDER BY cr.mes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro MySQL:", err);
    res
      .status(500)
      .json({ error: "Erro ao calcular crescimento percentual do rebanho" });
  }
}

/* =========================
   EXPORTAR TODAS FUNÇÕES
   ========================= */
module.exports = {
  // Financeiro
  financeiroMensal,
  despesasPorCategoria,
  // Produção Animal
  producaoAnimalMensal,
  // Produção Vegetal
  colheitaPorSafra,
  colheitaPorPlantacao,
  // Transações
  transacoesMensais,
  topEntidades,
  // Pastagens
  historicoPastagens,
  lotacaoPorHa,
  // Animais
  animaisGestantes,
  natalidadeMensal,
  mortalidadeMensal,
  crescimentoRebanho,
  crescimentoPercentual,
};
