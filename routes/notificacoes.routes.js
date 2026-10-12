const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Criar nova notificação
router.post("/", async (req, res) => {
  const { titulo, mensagem, tipo, usuario_id } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO notificacoes (titulo, mensagem, tipo, usuario_id) VALUES (?, ?, ?, ?)",
      [titulo, mensagem, tipo, usuario_id || null]
    );
    res.json({
      message: "Notificação criada com sucesso",
      id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar notificações do usuário
router.get("/:usuario_id", async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT * FROM notificacoes 
       WHERE usuario_id = ? OR usuario_id IS NULL 
       ORDER BY data_criacao DESC`,
      [usuario_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar como lida
router.put("/:id/lida", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE notificacoes SET lida = 1 WHERE id = ?", [id]);
    res.json({ message: "Notificação marcada como lida" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir (apenas admins)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM notificacoes WHERE id = ?", [id]);
    res.json({ message: "Notificação removida" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
