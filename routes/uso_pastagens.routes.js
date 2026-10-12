const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// GET /uso-pastagens → listar todos usos de pastagens

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          up.id,
          up.pastagem_id,
          p.nome AS pastagem_nome,
          up.lote_id,
          l.nome AS lote_nome,
          up.data_inicio,
          up.data_fim,
          up.observacoes
        FROM uso_pastagens up
        LEFT JOIN pastagens p ON up.pastagem_id = p.id
        LEFT JOIN lotes l ON up.lote_id = l.id
        ORDER BY up.data_inicio DESC
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao listar uso de pastagens",
      });
    }
  },
);

// GET /uso-pastagens/:id

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT 
          up.id,
          up.pastagem_id,
          p.nome AS pastagem_nome,
          up.lote_id,
          l.nome AS lote_nome,
          up.data_inicio,
          up.data_fim,
          up.observacoes
        FROM uso_pastagens up
        LEFT JOIN pastagens p ON up.pastagem_id = p.id
        LEFT JOIN lotes l ON up.lote_id = l.id
        WHERE up.id = ?
      `,
        [req.params.id],
      );

      if (rows.length === 0) {
        return res.status(404).json({
          status: false,
          message: "Uso de pastagem não encontrado",
        });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar uso de pastagem",
      });
    }
  },
);

// POST /uso-pastagens

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { pastagem_id, lote_id, data_inicio, data_fim, observacoes } =
        req.body;

      if (!pastagem_id || !lote_id || !data_inicio) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: pastagem_id, lote_id, data_inicio",
        });
      }

      // Verificar se a pastagem existe
      const [past] = await pool.query(
        "SELECT id, nome FROM pastagens WHERE id = ?",
        [pastagem_id],
      );
      if (past.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Pastagem inválida",
        });
      }

      // Verificar se o lote existe
      const [lot] = await pool.query(
        "SELECT id, nome FROM lotes WHERE id = ?",
        [lote_id],
      );
      if (lot.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Lote inválido",
        });
      }

      const [result] = await pool.query(
        `
        INSERT INTO uso_pastagens 
        (pastagem_id, lote_id, data_inicio, data_fim, observacoes)
        VALUES (?, ?, ?, ?, ?)
      `,
        [
          pastagem_id,
          lote_id,
          data_inicio,
          data_fim || null,
          observacoes || null,
        ],
      );

      res.status(201).json({
        status: true,
        message: "Uso de pastagem cadastrado com sucesso",
        data: {
          id: result.insertId,
          pastagem_id,
          pastagem_nome: past[0].nome,
          lote_id,
          lote_nome: lot[0].nome,
          data_inicio,
          data_fim,
          observacoes,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao cadastrar uso de pastagem",
      });
    }
  },
);

// PUT /uso-pastagens/:id

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { pastagem_id, lote_id, data_inicio, data_fim, observacoes } =
        req.body;

      const [result] = await pool.query(
        `
        UPDATE uso_pastagens
        SET pastagem_id = ?, lote_id = ?, data_inicio = ?, data_fim = ?, observacoes = ?
        WHERE id = ?
      `,
        [
          pastagem_id,
          lote_id,
          data_inicio,
          data_fim || null,
          observacoes || null,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: false,
          message: "Uso de pastagem não encontrado",
        });
      }

      res.json({
        status: true,
        message: "Uso de pastagem atualizado com sucesso",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao atualizar uso de pastagem",
      });
    }
  },
);

// DELETE pastagens

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM uso_pastagens WHERE id = ?",
        [req.params.id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: false,
          message: "Uso de pastagem não encontrado",
        });
      }

      res.json({
        status: true,
        message: "Uso de pastagem excluído com sucesso",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao excluir uso de pastagem",
      });
    }
  },
);

module.exports = router;
