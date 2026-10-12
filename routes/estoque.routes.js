const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// listar todas as movimentações

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT e.id, e.medicamento_id, m.nome AS medicamento_nome,
                e.quantidade, e.tipo_movimentacao, e.data_movimentacao, e.observacoes
         FROM estoque e
         JOIN medicamentos m ON e.medicamento_id = m.id
         ORDER BY e.data_movimentacao DESC`,
      );
      res.json(rows);
    } catch (err) {
      console.error("Erro ao listar estoque:", err);
      res.status(500).json({ error: "Erro ao listar estoque" });
    }
  },
);

//  buscar uma movimentação

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT e.id, e.medicamento_id, m.nome AS medicamento_nome,
                e.quantidade, e.tipo_movimentacao, e.data_movimentacao, e.observacoes
         FROM estoque e
         JOIN medicamentos m ON e.medicamento_id = m.id
         WHERE e.id = ?`,
        [req.params.id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Movimentação não encontrada" });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("Erro ao buscar movimentação:", err);
      res.status(500).json({ error: "Erro ao buscar movimentação" });
    }
  },
);

//registrar movimentação

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    const {
      medicamento_id,
      quantidade,
      tipo_movimentacao,
      data_movimentacao,
      observacoes,
    } = req.body;

    try {
      const [result] = await pool.query(
        "INSERT INTO estoque (medicamento_id, quantidade, tipo_movimentacao, data_movimentacao, observacoes) VALUES (?, ?, ?, ?, ?)",
        [
          medicamento_id,
          quantidade,
          tipo_movimentacao,
          data_movimentacao,
          observacoes,
        ],
      );

      res.status(201).json({
        id: result.insertId,
        medicamento_id,
        quantidade,
        tipo_movimentacao,
        data_movimentacao,
        observacoes,
      });
    } catch (err) {
      console.error("Erro ao registrar movimentação:", err);
      res.status(500).json({ error: "Erro ao registrar movimentação" });
    }
  },
);

//atualizar movimentação

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const {
      medicamento_id,
      quantidade,
      tipo_movimentacao,
      data_movimentacao,
      observacoes,
    } = req.body;

    try {
      const [result] = await pool.query(
        "UPDATE estoque SET medicamento_id=?, quantidade=?, tipo_movimentacao=?, data_movimentacao=?, observacoes=? WHERE id=?",
        [
          medicamento_id,
          quantidade,
          tipo_movimentacao,
          data_movimentacao,
          observacoes,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Movimentação não encontrada" });
      }

      res.json({ message: "Movimentação atualizada com sucesso" });
    } catch (err) {
      console.error("Erro ao atualizar movimentação:", err);
      res.status(500).json({ error: "Erro ao atualizar movimentação" });
    }
  },
);

//  excluir movimentação

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query("DELETE FROM estoque WHERE id = ?", [
        req.params.id,
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Movimentação não encontrada" });
      }

      res.json({ message: "Movimentação excluída com sucesso" });
    } catch (err) {
      console.error("Erro ao excluir movimentação:", err);
      res.status(500).json({ error: "Erro ao excluir movimentação" });
    }
  },
);

// saldo atual por medicamento

router.get(
  "/resumo",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
            m.id AS medicamento_id,
            m.nome AS medicamento_nome,
            COALESCE(SUM(
              CASE 
                WHEN e.tipo_movimentacao = 'entrada' THEN e.quantidade
                WHEN e.tipo_movimentacao = 'saida' THEN -e.quantidade
                ELSE 0
              END
            ),0) AS saldo_atual
         FROM medicamentos m
         LEFT JOIN estoque e ON e.medicamento_id = m.id
         GROUP BY m.id, m.nome
         ORDER BY m.nome`,
      );

      res.json(rows);
    } catch (err) {
      console.error("Erro ao calcular resumo do estoque:", err);
      res.status(500).json({ error: "Erro ao calcular resumo do estoque" });
    }
  },
);

module.exports = router;
