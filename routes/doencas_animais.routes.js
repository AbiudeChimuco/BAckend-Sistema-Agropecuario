const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ================= LISTAR DOENÇAS =================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
      const [rows] = await pool.query(
        `SELECT d.*, a.nome AS nome_animal
         FROM doencas_animais d
         JOIN animais a ON d.animal_id = a.id
         ORDER BY d.data_diagnostico DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      );

      const [total] = await pool.query(`
        SELECT COUNT(*) as count
        FROM doencas_animais d
        JOIN animais a ON d.animal_id = a.id
      `);

      res.json({
        status: true,
        total: total[0].count,
        page,
        limit,
        totalPages: Math.ceil(total[0].count / limit),
        data: rows,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar doenças",
      });
    }
  },
);

// ================= DETALHE =================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [rows] = await pool.query(
        `SELECT d.*, a.nome AS nome_animal
         FROM doencas_animais d
         JOIN animais a ON d.animal_id = a.id
         WHERE d.id = ?`,
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({
          status: false,
          message: "Doença não encontrada",
        });
      }

      res.json({ status: true, data: rows[0] });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar doença",
      });
    }
  },
);

// ================= CADASTRAR =================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    const {
      animal_id,
      nome_doenca,
      sintomas,
      severidade,
      data_diagnostico,
      veterinario,
      observacoes,
    } = req.body;

    if (!animal_id || !nome_doenca) {
      return res.status(400).json({
        status: false,
        message: "Campos obrigatórios: animal_id e nome_doenca",
      });
    }

    try {
      // ✅ valida se animal existe
      const [animal] = await pool.query("SELECT id FROM animais WHERE id = ?", [
        animal_id,
      ]);

      if (animal.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Animal informado não existe",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO doencas_animais
         (animal_id, nome_doenca, sintomas, severidade, data_diagnostico, veterinario, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          animal_id,
          nome_doenca,
          sintomas ?? null,
          severidade ?? null,
          data_diagnostico ?? null,
          veterinario ?? null,
          observacoes ?? null,
        ],
      );

      res.json({
        status: true,
        message: "Doença cadastrada com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao cadastrar doença",
      });
    }
  },
);

// ================= ATUALIZAR =================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { id } = req.params;
    const {
      animal_id,
      nome_doenca,
      sintomas,
      severidade,
      data_diagnostico,
      veterinario,
      observacoes,
      foi_recuperado,
      data_recuperacao,
    } = req.body;

    try {
      const [result] = await pool.query(
        `UPDATE doencas_animais SET
         animal_id = ?, nome_doenca = ?, sintomas = ?, severidade = ?,
         data_diagnostico = ?, veterinario = ?, observacoes = ?,
         foi_recuperado = ?, data_recuperacao = ?
         WHERE id = ?`,
        [
          animal_id,
          nome_doenca,
          sintomas ?? null,
          severidade ?? null,
          data_diagnostico ?? null,
          veterinario ?? null,
          observacoes ?? null,
          foi_recuperado ?? null,
          data_recuperacao ?? null,
          id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: false,
          message: "Doença não encontrada",
        });
      }

      res.json({
        status: true,
        message: "Doença atualizada com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao atualizar doença",
      });
    }
  },
);

// ================= REMOVER =================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query(
        "DELETE FROM doencas_animais WHERE id = ?",
        [id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: false,
          message: "Doença não encontrada",
        });
      }

      res.json({
        status: true,
        message: "Doença removida com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao remover doença",
      });
    }
  },
);

module.exports = router;
