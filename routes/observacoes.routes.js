const express = require("express");
const pool = require("../config/db");

const router = express.Router();

//ADICIONAR OBSERVAÇÃO AO CHECKLIST

router.post("/", async (req, res) => {
  const { checklist_id, usuario_id, observacao } = req.body;

  try {
    const [result] = await pool.execute(
      "INSERT INTO checklist_observacoes (checklist_id, usuario_id, observacao) VALUES (?, ?, ?)",
      [checklist_id, usuario_id, observacao],
    );

    res
      .status(201)
      .json({ message: "Observação adicionada!", id: result.insertId });
  } catch (error) {
    console.error("Erro ao adicionar observação:", error);
    res.status(500).json({ error: "Erro de servidor" });
  }
});

//LISTAR OBSERVAÇÕES POR CHECKLIST

router.get("/:checklist_id", async (req, res) => {
  const { checklist_id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT o.*, u.nome AS usuario_nome
       FROM checklist_observacoes o
       LEFT JOIN usuarios u ON o.usuario_id = u.id
       WHERE checklist_id = ? 
       ORDER BY o.data_observacao DESC`,
      [checklist_id],
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao buscar observações:", error);
    res.status(500).json({ error: "Erro de servidor" });
  }
});

//DELETAR UMA OBSERVAÇÃO

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.execute("DELETE FROM checklist_observacoes WHERE id = ?", [id]);

    res.status(200).json({ message: "Observação removida!" });
  } catch (error) {
    console.error("Erro ao excluir observação:", error);
    res.status(500).json({ error: "Erro de servidor" });
  }
});

module.exports = router;
