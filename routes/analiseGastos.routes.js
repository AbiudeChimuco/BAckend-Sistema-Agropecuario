/* eslint-disable prettier/prettier */
const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

/*
=====================================================
📊 ANÁLISE AVANÇADA DE INSUMOS GASTOS x PRODUÇÃO
(APENAS SAFRAS COLHIDAS)
GET /analise-gastos/avancado
(opcional ?safra_id=)
=====================================================
*/
router.get(
  "/avancado",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { safra_id } = req.query;

      if (!safra_id) {
        const [safras] = await pool.query(
          `SELECT id AS safra_id, nome AS safra_nome
           FROM safras
           WHERE estado = 'colhida'
           ORDER BY id DESC`,
        );
        return res.json({ status: true, data: safras });
      }

      const [rows] = await pool.query(
        `
        WITH gastos AS (
          SELECT
            ai.safra_id,
            i.tipo AS tipo_insumo,
            SUM(ai.quantidade * i.preco_unitario) AS gasto_tipo
          FROM aplicacoes_insumos ai
          JOIN insumos i ON i.id = ai.insumo_id
          WHERE ai.safra_id = ?
          GROUP BY ai.safra_id, i.tipo
        ),
        total_gasto AS (
          SELECT safra_id, SUM(gasto_tipo) AS gasto_total
          FROM gastos
          GROUP BY safra_id
        ),
        producao AS (
          SELECT pv.safra_id, SUM(pv.quantidade) AS total_produzido
          FROM producao_vegetal pv
          WHERE pv.safra_id = ?
          GROUP BY pv.safra_id
        )
        SELECT
          s.id AS safra_id,
          s.nome AS safra_nome,
          (
            SELECT JSON_OBJECTAGG(tipo_insumo, gasto_tipo)
            FROM gastos g
            WHERE g.safra_id = s.id
          ) AS gastos_por_tipo,
          (SELECT gasto_total FROM total_gasto tg WHERE tg.safra_id = s.id) AS gasto_total,
          (SELECT total_produzido FROM producao p WHERE p.safra_id = s.id) AS total_produzido,
          CASE
            WHEN (SELECT total_produzido FROM producao p WHERE p.safra_id = s.id) > 0
            THEN (SELECT gasto_total FROM total_gasto tg WHERE tg.safra_id = s.id) /
                 (SELECT total_produzido FROM producao p WHERE p.safra_id = s.id)
            ELSE 0
          END AS custo_medio_por_unidade,
          CASE
            WHEN (SELECT total_produzido FROM producao p WHERE p.safra_id = s.id) > 0
            THEN (SELECT gasto_total FROM total_gasto tg WHERE tg.safra_id = s.id) /
                 (SELECT total_produzido FROM producao p WHERE p.safra_id = s.id)
            ELSE 0
          END AS projecao_custo_unidade
        FROM safras s
        WHERE s.estado = 'colhida' AND s.id = ?
        ORDER BY s.id DESC
        `,
        [safra_id, safra_id, safra_id],
      );

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao gerar análise avançada de insumos e produção",
      });
    }
  },
);
module.exports = router;
