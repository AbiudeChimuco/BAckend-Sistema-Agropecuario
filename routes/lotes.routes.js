const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// listar todos os lotes

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
      const [rows] = await pool.query(`SELECT * FROM lotes LIMIT ? OFFSET ?`, [
        limit,
        offset,
      ]);

      const [total] = await pool.query("SELECT COUNT(*) as count FROM lotes");

      res.json({
        status: true,
        total: total[0].count,
        page,
        limit,
        data: rows,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({ status: false, message: "Erro ao buscar lotes" });
    }
  },
);

//  detalhes de um lote

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query("SELECT * FROM lotes WHERE id = ?", [id]);
      if (rows.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Lote não encontrado" });

      res.json({ status: true, data: rows[0] });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({ status: false, message: "Erro ao buscar lote" });
    }
  },
);

// cadastrar lote

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const { nome_lote, tipo, localizacao, especie, observacoes } = req.body;

    if (!nome_lote || !tipo) {
      return res.status(400).json({
        status: false,
        message: "Campos obrigatórios: nome_lote, tipo",
      });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO lotes 
          (nome_lote, tipo, localizacao, especie, observacoes)
          VALUES (?, ?, ?, ?, ?)`,
        [
          nome_lote,
          tipo,
          localizacao ?? null,
          especie ?? null,
          observacoes ?? null,
        ],
      );

      res.json({
        status: true,
        message: "Lote cadastrado com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar lote" });
    }
  },
);

// atualizar lote

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const { id } = req.params;
    const { nome_lote, tipo, localizacao, especie, observacoes } = req.body;

    try {
      const updates = [];
      const values = [];

      if (nome_lote !== undefined) {
        updates.push("nome_lote = ?");
        values.push(nome_lote);
      }
      if (tipo !== undefined) {
        updates.push("tipo = ?");
        values.push(tipo);
      }
      if (localizacao !== undefined) {
        updates.push("localizacao = ?");
        values.push(localizacao);
      }
      if (especie !== undefined) {
        updates.push("especie = ?");
        values.push(especie);
      }
      if (observacoes !== undefined) {
        updates.push("observacoes = ?");
        values.push(observacoes);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Nenhum campo enviado para atualização",
        });
      }

      values.push(id);

      const [result] = await pool.query(
        `UPDATE lotes SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Lote não encontrado" });
      }

      res.json({
        status: true,
        message: "Lote atualizado com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar lote" });
    }
  },
);

// remover lote

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query("DELETE FROM lotes WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Lote não encontrado" });
      }

      res.json({ status: true, message: "Lote removido com sucesso!", id });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({ status: false, message: "Erro ao remover lote" });
    }
  },
);

module.exports = router;
