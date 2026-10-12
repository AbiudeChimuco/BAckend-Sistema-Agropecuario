const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

//GET /culturas → listar todas as culturas

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM culturas");
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar culturas" });
    }
  },
);

//GET /culturas/:id → obter uma cultura

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM culturas WHERE id = ?", [
        req.params.id,
      ]);
      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Cultura não encontrada" });
      }
      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar cultura" });
    }
  },
);

//POST /culturas → cadastrar cultura

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { nome, tipo, ciclo_dias } = req.body;

      if (!nome || !tipo || !ciclo_dias) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: nome, tipo, ciclo_dias",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO culturas (nome, tipo, ciclo_dias) VALUES (?, ?, ?)`,
        [nome, tipo, ciclo_dias],
      );

      res.status(201).json({
        status: true,
        message: "Cultura cadastrada com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar cultura" });
    }
  },
);

//PUT /culturas/:id → atualizar cultura

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { nome, tipo, ciclo_dias } = req.body;

      const [result] = await pool.query(
        `UPDATE culturas SET nome = ?, tipo = ?, ciclo_dias = ? WHERE id = ?`,
        [nome, tipo, ciclo_dias, req.params.id],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Cultura não encontrada" });
      }

      res.json({ status: true, message: "Cultura atualizada com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar cultura" });
    }
  },
);

//DELETE /culturas/:id → excluir cultura

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query("DELETE FROM culturas WHERE id = ?", [
        req.params.id,
      ]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Cultura não encontrada" });
      }

      res.json({ status: true, message: "Cultura excluída com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir cultura" });
    }
  },
);

module.exports = router;
