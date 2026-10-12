const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Criar evento do calendário
router.post("/", async (req, res) => {
  try {
    const { titulo, descricao, data_evento, tipo } = req.body;

    const [result] = await pool.query(
      "INSERT INTO calendario_agricola (titulo, descricao, data_evento, tipo) VALUES (?, ?, ?, ?)",
      [titulo, descricao, data_evento, tipo]
    );

    res.json({
      id: result.insertId,
      message: "Evento adicionado ao calendário!",
    });
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Listar eventos
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM calendario_agricola ORDER BY data_evento ASC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Atualizar evento
router.put("/:id", async (req, res) => {
  try {
    const { titulo, descricao, data_evento, tipo } = req.body;

    await pool.query(
      `UPDATE calendario_agricola
       SET titulo=?, descricao=?, data_evento=?, tipo=?
       WHERE id=?`,
      [titulo, descricao, data_evento, tipo, req.params.id]
    );

    res.json({ message: "Evento atualizado!" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Deletar evento
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM calendario_agricola WHERE id=?", [
      req.params.id,
    ]);
    res.json({ message: "Evento removido!" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

module.exports = router;
