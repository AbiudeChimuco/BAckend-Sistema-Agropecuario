const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

//listar todos (com paginação)

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "recepcionista"),
  async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
      const [rows] = await pool.query(
        `SELECT * FROM fornecedores ORDER BY id DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      );

      const [total] = await pool.query(
        "SELECT COUNT(*) as count FROM fornecedores",
      );

      res.json({
        status: true,
        total: total[0].count,
        page,
        limit,
        data: rows,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar fornecedores" });
    }
  },
);

// detalhes de um fornecedor

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "recepcionista"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM fornecedores WHERE id = ?",
        [id],
      );

      if (rows.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Fornecedor não encontrado" });

      res.json({ status: true, data: rows[0] });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar fornecedor" });
    }
  },
);

// cadastrar fornecedor

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "recepcionista"),
  async (req, res) => {
    const { nome, telefone, email, endereco, observacoes } = req.body;

    if (!nome) {
      return res.status(400).json({
        status: false,
        message: "Campo obrigatório: nome",
      });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO fornecedores 
        (nome, telefone, email, endereco, observacoes, data_registro)
        VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          nome,
          telefone ?? null,
          email ?? null,
          endereco ?? null,
          observacoes ?? null,
        ],
      );

      res.json({
        status: true,
        message: "Fornecedor cadastrado com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar fornecedor" });
    }
  },
);

// atualizar fornecedor

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { id } = req.params;
    const { nome, telefone, email, endereco, observacoes } = req.body;

    try {
      const [result] = await pool.query(
        `UPDATE fornecedores SET 
         nome = ?, telefone = ?, email = ?, endereco = ?, observacoes = ?
         WHERE id = ?`,
        [
          nome,
          telefone ?? null,
          email ?? null,
          endereco ?? null,
          observacoes ?? null,
          id,
        ],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Fornecedor não encontrado" });
      }

      res.json({
        status: true,
        message: "Fornecedor atualizado com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar fornecedor" });
    }
  },
);

// remover fornecedor

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query(
        "DELETE FROM fornecedores WHERE id = ?",
        [id],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Fornecedor não encontrado" });
      }

      res.json({
        status: true,
        message: "Fornecedor removido com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao remover fornecedor" });
    }
  },
);

module.exports = router;
