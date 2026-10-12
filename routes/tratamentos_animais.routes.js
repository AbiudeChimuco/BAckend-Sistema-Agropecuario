const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ================= LISTAR TRATAMENTOS COM FILTROS E PAGINAÇÃO =================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const {
        animal_id,
        data_inicio,
        data_fim,
        page = 1,
        limit = 20,
      } = req.query;
      const offset = (page - 1) * limit;

      let where = [];
      let params = [];

      if (animal_id) {
        where.push("t.animal_id = ?");
        params.push(animal_id);
      }
      if (data_inicio) {
        where.push("t.data_aplicacao >= ?");
        params.push(data_inicio);
      }
      if (data_fim) {
        where.push("t.data_aplicacao <= ?");
        params.push(data_fim);
      }

      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [rows] = await pool.query(
        `SELECT 
          t.*,
          a.nome AS nome_animal,
          m.nome AS nome_medicamento
        FROM tratamentos_animais t
        JOIN animais a ON t.animal_id = a.id
        JOIN medicamentos m ON t.medicamento_id = m.id
        ${whereClause}
        ORDER BY t.data_aplicacao DESC
        LIMIT ? OFFSET ?`,
        [...params, Number(limit), Number(offset)],
      );

      res.json({ status: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        status: false,
        message: "Erro ao listar tratamentos",
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
    try {
      const [rows] = await pool.query(
        `SELECT 
          t.*,
          a.nome AS nome_animal,
          m.nome AS nome_medicamento
        FROM tratamentos_animais t
        JOIN animais a ON t.animal_id = a.id
        JOIN medicamentos m ON t.medicamento_id = m.id
        WHERE t.id = ?`,
        [req.params.id],
      );

      if (!rows.length) {
        return res
          .status(404)
          .json({ status: false, message: "Tratamento não encontrado" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar tratamento",
      });
    }
  },
);

// ================= REGISTRAR TRATAMENTO =================
// registrar tratamento e subtrair da quantidade do medicamento
// POST /tratamentos_animais
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const {
      animal_id,
      medicamento_id,
      quantidade_aplicada,
      data_aplicacao,
      data_proxima_aplicacao,
      responsavel,
      observacoes,
    } = req.body;

    if (!animal_id || !medicamento_id || !quantidade_aplicada) {
      return res
        .status(400)
        .json({ status: false, message: "Campos obrigatórios faltando." });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO tratamentos_animais
        (animal_id, medicamento_id, quantidade_aplicada, data_aplicacao, data_proxima_aplicacao, responsavel, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          animal_id,
          medicamento_id,
          quantidade_aplicada,
          data_aplicacao,
          data_proxima_aplicacao,
          responsavel,
          observacoes,
        ],
      );

      // Subtrair quantidade aplicada do medicamento
      await pool.query(
        `UPDATE medicamentos
         SET quantidade = quantidade - ?
         WHERE id = ?`,
        [quantidade_aplicada, medicamento_id],
      );

      res
        .status(201)
        .json({
          status: true,
          message: "Tratamento registado!",
          id: result.insertId,
        });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao registrar tratamento." });
    }
  },
);
// ================= ATUALIZAR TRATAMENTO =================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const {
      animal_id,
      medicamento_id,
      quantidade_aplicada,
      data_aplicacao,
      data_proxima_aplicacao,
      responsavel,
      observacoes,
    } = req.body;

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // busca tratamento existente
      const [tratRows] = await conn.query(
        "SELECT * FROM tratamentos_animais WHERE id = ?",
        [req.params.id],
      );
      if (!tratRows.length) {
        await conn.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Tratamento não encontrado" });
      }
      const tratAtual = tratRows[0];

      // busca medicamento atual
      const [medRows] = await conn.query(
        "SELECT quantidade, nome FROM medicamentos WHERE id = ?",
        [medicamento_id],
      );
      if (!medRows.length) {
        await conn.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Medicamento não encontrado" });
      }
      const medAtual = medRows[0];

      // calcula diferença de quantidade
      const diffQuantidade =
        quantidade_aplicada - tratAtual.quantidade_aplicada;
      if (medAtual.quantidade < diffQuantidade) {
        await conn.rollback();
        return res.status(400).json({
          status: false,
          message: `Quantidade insuficiente do medicamento ${medAtual.nome}. Disponível: ${medAtual.quantidade}`,
        });
      }

      // atualiza tratamento
      await conn.query(
        `UPDATE tratamentos_animais
         SET animal_id=?, medicamento_id=?, quantidade_aplicada=?, data_aplicacao=?, data_proxima_aplicacao=?, responsavel=?, observacoes=?
         WHERE id=?`,
        [
          animal_id,
          medicamento_id,
          quantidade_aplicada,
          data_aplicacao || new Date(),
          data_proxima_aplicacao ?? null,
          responsavel ?? null,
          observacoes ?? null,
          req.params.id,
        ],
      );

      // atualiza quantidade do medicamento
      await conn.query(
        `UPDATE medicamentos SET quantidade = quantidade - ? WHERE id = ?`,
        [diffQuantidade, medicamento_id],
      );

      // retorna tratamento atualizado
      const [novoTrat] = await conn.query(
        `SELECT t.*, a.nome AS nome_animal, m.nome AS nome_medicamento
         FROM tratamentos_animais t
         JOIN animais a ON t.animal_id = a.id
         JOIN medicamentos m ON t.medicamento_id = m.id
         WHERE t.id = ?`,
        [req.params.id],
      );

      await conn.commit();
      res.json({
        status: true,
        message: "Tratamento atualizado com sucesso",
        data: novoTrat[0],
      });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar tratamento" });
    } finally {
      conn.release();
    }
  },
);

// ================= REMOVER TRATAMENTO =================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // busca tratamento
      const [tratRows] = await conn.query(
        "SELECT * FROM tratamentos_animais WHERE id = ?",
        [req.params.id],
      );
      if (!tratRows.length) {
        await conn.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Tratamento não encontrado" });
      }
      const tratAtual = tratRows[0];

      // retorna quantidade ao medicamento
      await conn.query(
        `UPDATE medicamentos SET quantidade = quantidade + ? WHERE id = ?`,
        [tratAtual.quantidade_aplicada, tratAtual.medicamento_id],
      );

      // remove tratamento
      await conn.query("DELETE FROM tratamentos_animais WHERE id = ?", [
        req.params.id,
      ]);

      await conn.commit();
      res.json({ status: true, message: "Tratamento removido com sucesso" });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao remover tratamento" });
    } finally {
      conn.release();
    }
  },
);

module.exports = router;
