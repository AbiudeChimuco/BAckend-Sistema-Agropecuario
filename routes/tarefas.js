const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Criar tarefa
router.post("/", async (req, res) => {
  try {
    const { titulo, descricao, setor_id, funcionario_id, data_execucao, status } = req.body;

    const [result] = await pool.query(
      `INSERT INTO tarefas 
      (titulo, descricao, setor_id, funcionario_id, data_execucao, status)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [titulo, descricao, setor_id, funcionario_id, data_execucao, status]
    );

    res.json({ id: result.insertId, message: "Tarefa criada!" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Listar tarefas
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, s.nome AS setor, f.nome AS funcionario 
       FROM tarefas t
       LEFT JOIN setores s ON t.setor_id = s.id
       LEFT JOIN funcionarios f ON t.funcionario_id = f.id`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Atualizar tarefa
router.put("/:id", async (req, res) => {
  try {
    const { titulo, descricao, setor_id, funcionario_id, data_execucao, status } = req.body;

    await pool.query(
      `UPDATE tarefas
       SET titulo=?, descricao=?, setor_id=?, funcionario_id=?, data_execucao=?, status=?
       WHERE id=?`,
      [titulo, descricao, setor_id, funcionario_id, data_execucao, status, req.params.id]
    );

    res.json({ message: "Tarefa atualizada!" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Deletar tarefa
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM tarefas WHERE id=?", [req.params.id]);
    res.json({ message: "Tarefa removida!" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

module.exports = router;
