const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");


// ROTAS DE SETORES


// Criar sector → apenas admin e gerente
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { nome, descricao } = req.body;
      if (!nome) {
        return res
          .status(400)
          .json({ status: false, message: "Nome é obrigatório" });
      }

      const [result] = await pool.query(
        "INSERT INTO setores (nome, descricao) VALUES (?, ?)",
        [nome, descricao || null]
      );

      res
        .status(201)
        .json({ status: true, id: result.insertId, message: "Setor criado!" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao criar setor", error });
    }
  }
);

// Listar setores → qualquer usuário autenticado
router.get("/", autenticarToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM setores");
    res.json({ status: true, data: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: false, message: "Erro ao listar setores", error });
  }
});

// Atualizar setor
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { nome, descricao } = req.body;
      const [result] = await pool.query(
        "UPDATE setores SET nome=?, descricao=? WHERE id=?",
        [nome, descricao || null, req.params.id]
      );

      if (!result.affectedRows) {
        return res
          .status(404)
          .json({ status: false, message: "Setor não encontrado" });
      }

      res.json({ status: true, message: "Setor atualizado!" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar setor", error });
    }
  }
);

// Deletar setor → apenas admin
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    try {
      const [result] = await pool.query("DELETE FROM setores WHERE id=?", [
        req.params.id,
      ]);
      if (!result.affectedRows) {
        return res
          .status(404)
          .json({ status: false, message: "Setor não encontrado" });
      }
      res.json({ status: true, message: "Setor removido!" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao remover setor", error });
    }
  }
);

module.exports = router;
