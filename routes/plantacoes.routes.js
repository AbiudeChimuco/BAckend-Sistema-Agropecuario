const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Valores válidos para o campo ENUM "estado"
const estadosValidos = ["pendente", "em_andamento", "colhida", "cancelada"];

/* =====================================================
   GET /plantacoes/count → total de plantações
===================================================== */
router.get(
  "/count",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS total FROM plantacoes",
      );
      res.json({ status: true, total: rows[0].total });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao contar plantações" });
    }
  },
);

/* =====================================================
   📄 Relatório PDF de Plantações
===================================================== */
router.get(
  "/relatorio/pdf",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { inicio, fim } = req.query;
      const nomeUsuario = req.user?.nome || "Usuário Desconhecido";

      let query = `
        SELECT p.id, p.nome AS plantacao, s.nome AS safra, t.nome AS talhao,
               p.data_inicio, p.data_prevista_colheita, p.data_fim, p.estado, p.observacoes
        FROM plantacoes p
        JOIN safras s ON p.safra_id = s.id
        JOIN talhoes t ON p.talhao_id = t.id
        WHERE 1=1
      `;

      const params = [];
      if (inicio && fim) {
        query += " AND p.data_inicio BETWEEN ? AND ?";
        params.push(inicio, fim);
      }
      query += " ORDER BY p.data_inicio DESC";

      const [rows] = await pool.query(query, params);

      gerarPDFcomArray(
        res,
        "Relatório de Plantações",
        [
          "id",
          "plantacao",
          "safra",
          "talhao",
          "data_inicio",
          "data_prevista_colheita",
          "data_fim",
          "estado",
          "observacoes",
        ],
        rows,
        nomeUsuario,
      );
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao gerar relatório de plantações" });
    }
  },
);

/* =====================================================
   GET /plantacoes → listar todas plantações
===================================================== */
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT p.*, s.nome AS safra_nome, t.nome AS talhao_nome
        FROM plantacoes p
        JOIN safras s ON p.safra_id = s.id
        JOIN talhoes t ON p.talhao_id = t.id
        ORDER BY p.data_inicio DESC
      `);
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar plantações" });
    }
  },
);

/* =====================================================
   GET /plantacoes/:id → obter uma plantação
===================================================== */
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT p.*, s.nome AS safra_nome, t.nome AS talhao_nome
        FROM plantacoes p
        JOIN safras s ON p.safra_id = s.id
        JOIN talhoes t ON p.talhao_id = t.id
        WHERE p.id = ?
      `,
        [req.params.id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Plantação não encontrada" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar plantação" });
    }
  },
);

/* =====================================================
   POST /plantacoes → cadastrar plantação
===================================================== */
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        nome,
        safra_id,
        talhao_id,
        data_inicio,
        data_prevista_colheita,
        data_fim,
        estado,
        observacoes,
      } = req.body;

      if (!nome || !safra_id || !talhao_id || !data_inicio) {
        return res.status(400).json({
          status: false,
          message:
            "Campos obrigatórios: nome, safra_id, talhao_id, data_inicio",
        });
      }

      // validar existência da safra
      const [safra] = await pool.query("SELECT id FROM safras WHERE id = ?", [
        safra_id,
      ]);
      if (safra.length === 0) {
        return res
          .status(400)
          .json({ status: false, message: "Safra inválida" });
      }

      // validar existência do talhão
      const [talhao] = await pool.query("SELECT id FROM talhoes WHERE id = ?", [
        talhao_id,
      ]);
      if (talhao.length === 0) {
        return res
          .status(400)
          .json({ status: false, message: "Talhão inválido" });
      }

      let estadoFinal = estado || "pendente";
      if (!estadosValidos.includes(estadoFinal)) {
        return res.status(400).json({
          status: false,
          message: `Estado inválido. Valores permitidos: ${estadosValidos.join(
            ", ",
          )}`,
        });
      }

      if (
        (estadoFinal === "colhida" || estadoFinal === "cancelada") &&
        !data_fim
      ) {
        return res.status(400).json({
          status: false,
          message:
            "Data de fim obrigatória para plantações colhidas ou canceladas",
        });
      }

      const [result] = await pool.query(
        `
        INSERT INTO plantacoes 
        (nome, safra_id, talhao_id, data_inicio, data_prevista_colheita, data_fim, estado, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          nome,
          safra_id,
          talhao_id,
          data_inicio,
          data_prevista_colheita || null,
          data_fim || null,
          estadoFinal,
          observacoes || null,
        ],
      );

      res.status(201).json({
        status: true,
        message: "Plantação cadastrada com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar plantação" });
    }
  },
);

/* =====================================================
   PUT /plantacoes/:id → atualizar plantação
===================================================== */
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        nome,
        safra_id,
        talhao_id,
        data_inicio,
        data_prevista_colheita,
        data_fim,
        estado,
        observacoes,
      } = req.body;

      let estadoFinal = estado || "pendente";
      if (!estadosValidos.includes(estadoFinal)) {
        return res.status(400).json({
          status: false,
          message: `Estado inválido. Valores permitidos: ${estadosValidos.join(
            ", ",
          )}`,
        });
      }

      if (
        (estadoFinal === "colhida" || estadoFinal === "cancelada") &&
        !data_fim
      ) {
        return res.status(400).json({
          status: false,
          message:
            "Data de fim obrigatória para plantações colhidas ou canceladas",
        });
      }

      const [result] = await pool.query(
        `
        UPDATE plantacoes 
        SET nome = ?, safra_id = ?, talhao_id = ?, data_inicio = ?,
            data_prevista_colheita = ?, data_fim = ?, estado = ?, observacoes = ?
        WHERE id = ?
      `,
        [
          nome,
          safra_id,
          talhao_id,
          data_inicio,
          data_prevista_colheita || null,
          data_fim || null,
          estadoFinal,
          observacoes || null,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Plantação não encontrada" });
      }

      res.json({ status: true, message: "Plantação atualizada com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar plantação" });
    }
  },
);

/* =====================================================
   DELETE /plantacoes/:id → excluir plantação
===================================================== */
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [plantacao] = await pool.query(
        "SELECT estado FROM plantacoes WHERE id = ?",
        [req.params.id],
      );

      if (plantacao.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Plantação não encontrada" });
      }

      if (plantacao[0].estado === "colhida") {
        return res.status(400).json({
          status: false,
          message: "Não é permitido excluir uma plantação já colhida",
        });
      }

      await pool.query("DELETE FROM plantacoes WHERE id = ?", [req.params.id]);

      res.json({ status: true, message: "Plantação excluída com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir plantação" });
    }
  },
);

/* =====================================================
   📊 PRODUTIVIDADE POR HECTARE
===================================================== */
router.get(
  "/produtividade/hectare",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          p.id,
          p.nome AS plantacao,
          t.nome AS talhao,
          t.area_hectares,
          COALESCE(SUM(pv.quantidade_kg),0) AS producao_total_kg,
          CASE 
            WHEN t.area_hectares > 0 
            THEN ROUND(COALESCE(SUM(pv.quantidade_kg),0)/t.area_hectares,2)
            ELSE 0
          END AS produtividade_kg_ha
        FROM plantacoes p
        JOIN talhoes t ON p.talhao_id = t.id
        LEFT JOIN producao_vegetal pv ON pv.safra_id = p.safra_id
        GROUP BY p.id
        ORDER BY produtividade_kg_ha DESC
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao calcular produtividade",
      });
    }
  },
);

/* =====================================================
   🌾 PRODUÇÃO TOTAL POR SAFRA
===================================================== */
router.get(
  "/producao/por-safra",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          s.id AS safra_id,
          s.nome AS safra,
          COUNT(DISTINCT p.id) AS total_plantacoes,
          COALESCE(SUM(pv.quantidade_kg),0) AS producao_total_kg
        FROM safras s
        LEFT JOIN plantacoes p ON p.safra_id = s.id
        LEFT JOIN producao_vegetal pv ON pv.safra_id = s.id
        GROUP BY s.id
        ORDER BY s.id DESC
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao gerar produção por safra",
      });
    }
  },
);

/* =====================================================
   📉 PLANTAÇÕES ATRASADAS
===================================================== */
router.get(
  "/atrasadas",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          p.*, 
          s.nome AS safra_nome,
          t.nome AS talhao_nome,
          DATEDIFF(CURDATE(), p.data_prevista_colheita) AS dias_atraso
        FROM plantacoes p
        JOIN safras s ON p.safra_id = s.id
        JOIN talhoes t ON p.talhao_id = t.id
        WHERE p.estado <> 'colhida'
          AND p.data_prevista_colheita IS NOT NULL
          AND p.data_prevista_colheita < CURDATE()
        ORDER BY dias_atraso DESC
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao listar plantações atrasadas",
      });
    }
  },
);

/* =====================================================
   🔔 ALERTAS INTELIGENTES AGRÍCOLAS
===================================================== */
router.get(
  "/alertas",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const [atrasadas] = await pool.query(`
        SELECT COUNT(*) AS total
        FROM plantacoes
        WHERE estado <> 'colhida'
          AND data_prevista_colheita IS NOT NULL
          AND data_prevista_colheita < CURDATE()
      `);

      const [emAndamento] = await pool.query(`
        SELECT COUNT(*) AS total
        FROM plantacoes
        WHERE estado = 'em_andamento'
      `);

      const [pendentes] = await pool.query(`
        SELECT COUNT(*) AS total
        FROM plantacoes
        WHERE estado = 'pendente'
      `);

      res.json({
        status: true,
        data: {
          atrasadas: atrasadas[0].total,
          em_andamento: emAndamento[0].total,
          pendentes: pendentes[0].total,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao gerar alertas agrícolas",
      });
    }
  },
);

module.exports = router;
