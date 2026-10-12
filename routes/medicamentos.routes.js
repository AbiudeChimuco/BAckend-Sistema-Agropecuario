const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ================== LISTAR TODOS MEDICAMENTOS ==================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM medicamentos ORDER BY nome",
      );
      res.json(rows);
    } catch (err) {
      console.error("Erro ao listar medicamentos:", err);
      res.status(500).json({ error: "Erro ao listar medicamentos" });
    }
  },
);

// ================== RESUMO DE MEDICAMENTOS (COM SALDO) ==================
router.get(
  "/resumo",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          m.id AS medicamento_id,
          m.nome AS medicamento_nome,
          COALESCE(SUM(
            CASE
              WHEN e.tipo_movimentacao = 'entrada' THEN e.quantidade
              WHEN e.tipo_movimentacao = 'saida'   THEN -e.quantidade
            END
          ),0) AS saldo_atual
        FROM medicamentos m
        LEFT JOIN estoque e ON e.medicamento_id = m.id
        GROUP BY m.id, m.nome
        ORDER BY m.nome
      `);

      res.json({
        status: true,
        data: rows,
      });
    } catch (error) {
      console.error("Erro ao listar resumo:", error);
      res.status(500).json({
        status: false,
        message: "Erro ao listar resumo de medicamentos",
      });
    }
  },
);

// ================== BUSCAR MEDICAMENTO POR ID ==================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM medicamentos WHERE id = ?",
        [req.params.id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Medicamento não encontrado" });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("Erro ao buscar medicamento:", err);
      res.status(500).json({ error: "Erro ao buscar medicamento" });
    }
  },
);

// ================== CRIAR MEDICAMENTO ==================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { nome, tipo, descricao, quantidade, unidade, validade, fornecedor } =
      req.body;

    try {
      const [result] = await pool.query(
        `INSERT INTO medicamentos 
         (nome, tipo, descricao, quantidade, unidade, validade, fornecedor, data_registro)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [nome, tipo, descricao, quantidade, unidade, validade, fornecedor],
      );

      res.status(201).json({
        id: result.insertId,
        nome,
        tipo,
        descricao,
        quantidade,
        unidade,
        validade,
        fornecedor,
        data_registro: new Date(),
      });
    } catch (err) {
      console.error("Erro ao cadastrar medicamento:", err);
      res.status(500).json({ error: "Erro ao cadastrar medicamento" });
    }
  },
);

// ================== ATUALIZAR MEDICAMENTO ==================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { nome, tipo, descricao, quantidade, unidade, validade, fornecedor } =
      req.body;

    try {
      const [result] = await pool.query(
        `UPDATE medicamentos 
         SET nome=?, tipo=?, descricao=?, quantidade=?, unidade=?, validade=?, fornecedor=?
         WHERE id=?`,
        [
          nome,
          tipo,
          descricao,
          quantidade,
          unidade,
          validade,
          fornecedor,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Medicamento não encontrado" });
      }

      res.json({ message: "Medicamento atualizado com sucesso" });
    } catch (err) {
      console.error("Erro ao atualizar medicamento:", err);
      res.status(500).json({ error: "Erro ao atualizar medicamento" });
    }
  },
);

// ================== REMOVER MEDICAMENTO ==================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM medicamentos WHERE id = ?",
        [req.params.id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Medicamento não encontrado" });
      }

      res.json({ message: "Medicamento removido com sucesso" });
    } catch (err) {
      console.error("Erro ao remover medicamento:", err);
      res.status(500).json({ error: "Erro ao remover medicamento" });
    }
  },
);

// ================== MEDICAMENTOS PRÓXIMOS DO VENCIMENTO ==================
router.get(
  "/validade/proximos",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM medicamentos
         WHERE validade IS NOT NULL
         AND validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         ORDER BY validade ASC`,
      );

      res.json(rows);
    } catch (err) {
      console.error("Erro ao listar próximos do vencimento:", err);
      res.status(500).json({ error: "Erro ao listar próximos do vencimento" });
    }
  },
);

module.exports = router;
