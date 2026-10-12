const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// listar todos os registros de mortalidade

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { animal_id } = req.query;

    try {
      let query = `
        SELECT m.*, a.nome AS nome_animal, a.brinco
        FROM mortalidade m
        LEFT JOIN animais a ON m.animal_id = a.id
        WHERE 1=1
      `;
      let params = [];

      if (animal_id) {
        query += " AND m.animal_id = ?";
        params.push(animal_id);
      }

      query += " ORDER BY m.data_morte DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rows] = await pool.query(query, params);

      const [total] = await pool.query(
        "SELECT COUNT(*) as count FROM mortalidade",
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
      res.status(500).json({
        status: false,
        message: "Erro ao buscar registros de mortalidade",
      });
    }
  },
);

//  detalhes de um registro de mortalidade

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "capatazpec", "recepcionista", "gerente"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT m.*, a.nome AS nome_animal, a.brinco
         FROM mortalidade m
         LEFT JOIN animais a ON m.animal_id = a.id
         WHERE m.id = ?`,
        [id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar registro" });
    }
  },
);

// cadastrar registro de mortalidade

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "capatazpec", "gerente"),
  async (req, res) => {
    const { animal_id, data_morte, causa_morte, responsavel, observacoes } =
      req.body;

    if (!animal_id || !data_morte || !causa_morte || !responsavel) {
      return res.status(400).json({
        status: false,
        message:
          "Campos obrigatórios: animal_id, data_morte, causa_morte, responsavel",
      });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO mortalidade 
        (animal_id, data_morte, causa_morte, responsavel, observacoes)
        VALUES (?, ?, ?, ?, ?)`,
        [animal_id, data_morte, causa_morte, responsavel, observacoes ?? null],
      );

      res.json({
        status: true,
        message: "Registro de mortalidade cadastrado com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar registro" });
    }
  },
);

// atualizar registro de mortalidade

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "capatazpec", "gerente"),
  async (req, res) => {
    const { id } = req.params;
    const { animal_id, data_morte, causa_morte, responsavel, observacoes } =
      req.body;

    try {
      const [result] = await pool.query(
        `UPDATE mortalidade SET 
        animal_id = ?, data_morte = ?, causa_morte = ?, responsavel = ?, observacoes = ?
        WHERE id = ?`,
        [
          animal_id,
          data_morte,
          causa_morte,
          responsavel,
          observacoes ?? null,
          id,
        ],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });
      }

      res.json({
        status: true,
        message: "Registro atualizado com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar registro" });
    }
  },
);

// remover mortalidade

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query(
        "DELETE FROM mortalidade WHERE id = ?",
        [id],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });
      }

      res.json({ status: true, message: "Registro removido com sucesso!", id });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao remover registro" });
    }
  },
);

module.exports = router;
