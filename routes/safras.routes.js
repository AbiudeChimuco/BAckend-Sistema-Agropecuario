const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Valores válidos do ENUM safra.estado
const estadosValidos = ["pendente", "em_andamento", "colhida", "cancelada"];

/* =====================================================
   GET /safras/count → total de safras
===================================================== */
router.get(
  "/count",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT COUNT(*) AS total FROM safras");
      res.json({ status: true, total: rows[0].total });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: "Erro ao contar safras" });
    }
  },
);

/* =====================================================
   GET /safras → listar todas as safras
===================================================== */
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT s.*, c.nome AS cultura_nome, t.nome AS talhao_nome
         FROM safras s
         LEFT JOIN culturas c ON s.cultura_id = c.id
         LEFT JOIN talhoes t ON s.talhao_id = t.id
         ORDER BY s.id DESC`,
      );
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: "Erro ao listar safras" });
    }
  },
);

/* =====================================================
   GET /safras/:id → obter uma safra
===================================================== */
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT s.*, c.nome AS cultura_nome, t.nome AS talhao_nome
         FROM safras s
         LEFT JOIN culturas c ON s.cultura_id = c.id
         LEFT JOIN talhoes t ON s.talhao_id = t.id
         WHERE s.id = ?`,
        [req.params.id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Safra não encontrada" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: "Erro ao buscar safra" });
    }
  },
);

/* =====================================================
   POST /safras → cadastrar safra
===================================================== */
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        nome,
        cultura_id,
        talhao_id,
        data_inicio,
        data_prevista_colheita,
        observacoes,
      } = req.body;

      if (
        !nome ||
        !cultura_id ||
        !talhao_id ||
        !data_inicio ||
        !data_prevista_colheita
      ) {
        return res.status(400).json({
          status: false,
          message:
            "Campos obrigatórios: nome, cultura_id, talhao_id, data_inicio, data_prevista_colheita",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO safras 
          (nome, cultura_id, talhao_id, data_inicio, data_prevista_colheita, estado, observacoes)
         VALUES (?, ?, ?, ?, ?, 'em_andamento', ?)`,
        [
          nome,
          cultura_id,
          talhao_id,
          data_inicio,
          data_prevista_colheita,
          observacoes || null,
        ],
      );

      res.status(201).json({
        status: true,
        message: "Safra cadastrada com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar safra" });
    }
  },
);

/* =====================================================
   PUT /safras/:id → atualizar safra
===================================================== */
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        nome,
        cultura_id,
        talhao_id,
        data_inicio,
        data_prevista_colheita,
        data_fim,
        estado,
        observacoes,
      } = req.body;

      let estadoFinal = estado || "em_andamento";

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
          message: "Data de fim obrigatória para safras colhidas ou canceladas",
        });
      }

      const [result] = await pool.query(
        `UPDATE safras SET 
          nome = ?, 
          cultura_id = ?, 
          talhao_id = ?, 
          data_inicio = ?, 
          data_prevista_colheita = ?, 
          data_fim = ?, 
          estado = ?, 
          observacoes = ?
        WHERE id = ?`,
        [
          nome,
          cultura_id,
          talhao_id,
          data_inicio,
          data_prevista_colheita,
          data_fim || null,
          estadoFinal,
          observacoes || null,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Safra não encontrada" });
      }

      res.json({ status: true, message: "Safra atualizada com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar safra" });
    }
  },
);

/* =====================================================
   DELETE /safras/:id → excluir safra
===================================================== */
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [safra] = await pool.query(
        "SELECT estado FROM safras WHERE id = ?",
        [req.params.id],
      );

      if (safra.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Safra não encontrada" });
      }

      if (safra[0].estado === "colhida") {
        return res.status(400).json({
          status: false,
          message: "Não é permitido excluir uma safra já colhida",
        });
      }

      await pool.query("DELETE FROM safras WHERE id = ?", [req.params.id]);

      res.json({ status: true, message: "Safra excluída com sucesso" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: "Erro ao excluir safra" });
    }
  },
);

/* =====================================================
   POST /safras/:id/producao → registrar produção
===================================================== */
router.post(
  "/:id/producao",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { quantidade_kg, data_colheita } = req.body;

      if (!quantidade_kg || !data_colheita) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: quantidade_kg, data_colheita",
        });
      }

      const [safra] = await pool.query(
        "SELECT id, estado FROM safras WHERE id = ?",
        [req.params.id],
      );

      if (safra.length === 0) {
        return res.status(404).json({
          status: false,
          message: "Safra não encontrada",
        });
      }

      if (safra[0].estado === "colhida") {
        return res.status(400).json({
          status: false,
          message: "Esta safra já foi colhida",
        });
      }

      await pool.query(
        `INSERT INTO producao_vegetal 
         (safra_id, quantidade_kg, data_colheita) 
         VALUES (?, ?, ?)`,
        [req.params.id, quantidade_kg, data_colheita],
      );

      await pool.query(
        "UPDATE safras SET estado = 'colhida', data_fim = ? WHERE id = ?",
        [data_colheita, req.params.id],
      );

      res.json({
        status: true,
        message: "Produção registrada e safra concluída",
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao registrar produção" });
    }
  },
);

module.exports = router;
