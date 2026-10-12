const express = require("express");
const pool = require("../config/db");
const { autenticarToken } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", autenticarToken, async (req, res) => {
  try {
    // 📊 Várias queries em paralelo
    const [
      [[{ count: usuarios }]],
      [[{ count: animais }]],
      [[{ count: pesagens }]],
      [[{ count: notificacoes }]],
      [[{ count: safras }]],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM usuarios"),
      pool.query("SELECT COUNT(*) AS count FROM animais"),
      pool.query("SELECT COUNT(*) AS count FROM pesagens"),
      pool.query(
        "SELECT COUNT(*) AS count FROM notificacoes_estoque WHERE lida = 0"
      ), // só não lidas
      pool.query("SELECT COUNT(*) AS count FROM safras"),
    ]);

    res.json({
      status: true,
      data: {
        usuarios,
        animais,
        pesagens,
        notificacoes,
        safras,
      },
    });
  } catch (err) {
    console.error("Erro Dashboard:", err.sqlMessage || err);
    res
      .status(500)
      .json({ status: false, message: "Erro ao carregar dashboard" });
  }
});

module.exports = router;
