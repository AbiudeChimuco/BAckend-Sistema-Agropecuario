const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Listar todos os talhões
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM talhoes ORDER BY nome ASC"
      );
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar talhões" });
    }
  }
);

// Obter um talhão pelo ID
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM talhoes WHERE id = ?", [
        req.params.id,
      ]);
      if (rows.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Talhão não encontrado" });
      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: "Erro ao buscar talhão" });
    }
  }
);

// Cadastrar talhão
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { nome, area_ha, localizacao } = req.body;

      if (!nome || !area_ha || !localizacao) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: nome, área (ha) e localização",
        });
      }

      const [result] = await pool.query(
        "INSERT INTO talhoes (nome, area_ha, localizacao) VALUES (?, ?, ?)",
        [nome, area_ha, localizacao]
      );

      res.status(201).json({
        status: true,
        message: "Talhão cadastrado com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar talhão" });
    }
  }
);

// Atualizar talhão
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { nome, area_ha, localizacao } = req.body;

      const [result] = await pool.query(
        "UPDATE talhoes SET nome = ?, area_ha = ?, localizacao = ? WHERE id = ?",
        [nome, area_ha, localizacao, req.params.id]
      );

      if (result.affectedRows === 0)
        return res
          .status(404)
          .json({ status: false, message: "Talhão não encontrado" });

      res.json({ status: true, message: "Talhão atualizado com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar talhão" });
    }
  }
);

// Excluir talhão
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query("DELETE FROM talhoes WHERE id = ?", [
        req.params.id,
      ]);

      if (result.affectedRows === 0)
        return res
          .status(404)
          .json({ status: false, message: "Talhão não encontrado" });

      res.json({ status: true, message: "Talhão excluído com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir talhão" });
    }
  }
);

module.exports = router;
