const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();
const PDFDocument = require("pdfkit");

// ================================
// LISTAR MOVIMENTAÇÕES
// ================================
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
        `SELECT 
          m.id,
          a.brinco,
          a.nome AS nome_animal,
          lo.nome_lote AS lote_origem_nome,
          ld.nome_lote AS lote_destino_nome,
          m.lote_origem AS lote_origem_id,
          m.lote_destino AS lote_destino_id,
          m.data_movimentacao,
          m.motivo,
          m.responsavel
        FROM movimentacao_lotes m
        LEFT JOIN animais a ON m.animal_id = a.id
        LEFT JOIN lotes lo ON m.lote_origem = lo.id
        LEFT JOIN lotes ld ON m.lote_destino = ld.id
        ORDER BY m.data_movimentacao DESC
        LIMIT ? OFFSET ?`,
        [limit, offset],
      );

      const [total] = await pool.query(
        "SELECT COUNT(*) as count FROM movimentacao_lotes",
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
        .json({ status: false, message: "Erro ao buscar movimentações" });
    }
  },
);

// ================================
// CADASTRAR MOVIMENTAÇÃO (PRO)
// ================================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        animal_id,
        lote_origem,
        lote_destino,
        data_movimentacao,
        motivo,
        responsavel,
      } = req.body;

      // ================= VALIDAR CAMPOS
      if (
        !animal_id ||
        !lote_origem ||
        !lote_destino ||
        !data_movimentacao ||
        !motivo
      ) {
        return res.status(400).json({
          status: false,
          message:
            "Campos obrigatórios: animal_id, lote_origem, lote_destino, data_movimentacao, motivo",
        });
      }

      // 🚫 origem = destino
      if (Number(lote_origem) === Number(lote_destino)) {
        return res.status(400).json({
          status: false,
          message: "Lote de origem e destino não podem ser iguais.",
        });
      }

      await connection.beginTransaction();

      // ================= BUSCAR ANIMAL
      const [animalRows] = await connection.query(
        "SELECT status, lote_id FROM animais WHERE id = ? FOR UPDATE",
        [animal_id],
      );

      if (animalRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: false,
          message: "Animal não encontrado",
        });
      }

      const animal = animalRows[0];

      // 🚫 BLOQUEIO POR STATUS
      if (animal.status === "Morto" || animal.status === "Abatido") {
        await connection.rollback();
        return res.status(400).json({
          status: false,
          message:
            "Não é possível movimentar um animal com status Morto ou Abatido.",
        });
      }

      // 🚫 VALIDAR LOTE ATUAL
      if (Number(animal.lote_id) !== Number(lote_origem)) {
        await connection.rollback();
        return res.status(400).json({
          status: false,
          message: "O lote de origem não corresponde ao lote atual do animal.",
        });
      }

      // ================= INSERIR MOVIMENTAÇÃO
      const [result] = await connection.query(
        `INSERT INTO movimentacao_lotes
        (animal_id, lote_origem, lote_destino, data_movimentacao, motivo, responsavel)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          animal_id,
          lote_origem,
          lote_destino,
          data_movimentacao,
          motivo,
          responsavel ?? null,
        ],
      );

      // 🔥 ATUALIZAR LOTE ATUAL DO ANIMAL
      await connection.query("UPDATE animais SET lote_id = ? WHERE id = ?", [
        lote_destino,
        animal_id,
      ]);

      await connection.commit();

      res.json({
        status: true,
        message: "Movimentação cadastrada com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      await connection.rollback();
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar movimentação" });
    } finally {
      connection.release();
    }
  },
);

// ================================
// ATUALIZAR MOVIMENTAÇÃO (PRO)
// ================================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const { id } = req.params;
    const {
      animal_id,
      lote_origem,
      lote_destino,
      data_movimentacao,
      motivo,
      responsavel,
    } = req.body;

    try {
      // 🚫 validar status se mudar animal
      if (animal_id !== undefined) {
        const [animalRows] = await pool.query(
          "SELECT status FROM animais WHERE id = ?",
          [animal_id],
        );

        if (animalRows.length === 0) {
          return res.status(404).json({
            status: false,
            message: "Animal não encontrado",
          });
        }

        const statusAnimal = animalRows[0].status;

        if (statusAnimal === "Morto" || statusAnimal === "Abatido") {
          return res.status(400).json({
            status: false,
            message:
              "Não é possível movimentar um animal com status Morto ou Abatido.",
          });
        }
      }

      // 🚫 origem = destino
      if (
        lote_origem !== undefined &&
        lote_destino !== undefined &&
        Number(lote_origem) === Number(lote_destino)
      ) {
        return res.status(400).json({
          status: false,
          message: "Lote de origem e destino não podem ser iguais.",
        });
      }

      // ================= UPDATE DINÂMICO
      const updates = [];
      const values = [];

      if (animal_id !== undefined) {
        updates.push("animal_id = ?");
        values.push(animal_id);
      }
      if (lote_origem !== undefined) {
        updates.push("lote_origem = ?");
        values.push(lote_origem);
      }
      if (lote_destino !== undefined) {
        updates.push("lote_destino = ?");
        values.push(lote_destino);
      }
      if (data_movimentacao !== undefined) {
        updates.push("data_movimentacao = ?");
        values.push(data_movimentacao);
      }
      if (motivo !== undefined) {
        updates.push("motivo = ?");
        values.push(motivo);
      }
      if (responsavel !== undefined) {
        updates.push("responsavel = ?");
        values.push(responsavel);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Nenhum campo enviado para atualização",
        });
      }

      values.push(id);

      const [result] = await pool.query(
        `UPDATE movimentacao_lotes SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Movimentação não encontrada" });
      }

      res.json({
        status: true,
        message: "Movimentação atualizada com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar movimentação" });
    }
  },
);

// ================================
// REMOVER
// ================================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query(
        "DELETE FROM movimentacao_lotes WHERE id = ?",
        [id],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Movimentação não encontrada" });
      }

      res.json({
        status: true,
        message: "Movimentação removida com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao remover movimentação" });
    }
  },
);

module.exports = router;
