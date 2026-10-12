const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================
// GET /aplicacoes_insumos → LISTAR TODAS
// ============================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT a.*,
               i.nome AS insumo_nome,
               i.tipo AS insumo_tipo,
               s.nome AS safra_nome
        FROM aplicacoes_insumos a
        JOIN insumos i ON a.insumo_id = i.id
        JOIN safras s ON a.safra_id = s.id
        ORDER BY a.data_aplicacao DESC
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar aplicações" });
    }
  },
);

// ============================
// GET /aplicacoes_insumos/:id → BUSCAR POR ID
// ============================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `
        SELECT a.*,
               i.nome AS insumo_nome,
               i.tipo AS insumo_tipo,
               s.nome AS safra_nome
        FROM aplicacoes_insumos a
        JOIN insumos i ON a.insumo_id = i.id
        JOIN safras s ON a.safra_id = s.id
        WHERE a.id = ?
      `,
        [id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Aplicação não encontrada" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar aplicação" });
    }
  },
);

// ============================
// POST /aplicacoes_insumos → CRIAR APLICAÇÃO
// ============================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { safra_id, insumo_id, quantidade, responsavel_id } = req.body;

      if (!safra_id || !insumo_id || quantidade === undefined) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: safra_id, insumo_id, quantidade",
        });
      }

      const qtd = Number(quantidade);

      if (Number.isNaN(qtd) || qtd <= 0) {
        return res.status(400).json({
          status: false,
          message: "Quantidade deve ser maior que zero",
        });
      }

      await connection.beginTransaction();

      // Verifica safra
      const [safraRows] = await connection.query(
        "SELECT id FROM safras WHERE id = ?",
        [safra_id],
      );

      if (safraRows.length === 0) {
        throw new Error("Safra não encontrada");
      }

      // Verifica insumo (bloqueia a linha)
      const [insumoRows] = await connection.query(
        "SELECT quantidade_disponivel, tipo FROM insumos WHERE id = ? FOR UPDATE",
        [insumo_id],
      );

      if (insumoRows.length === 0) {
        throw new Error("Insumo não encontrado");
      }

      const tipo_aplicacao = insumoRows[0].tipo;

      if (qtd > insumoRows[0].quantidade_disponivel) {
        throw new Error("Quantidade insuficiente em estoque");
      }

      const nova_quantidade = insumoRows[0].quantidade_disponivel - qtd;

      // Atualiza estoque
      await connection.query(
        "UPDATE insumos SET quantidade_disponivel = ? WHERE id = ?",
        [nova_quantidade, insumo_id],
      );

      // Regista aplicação
      const [result] = await connection.query(
        `
        INSERT INTO aplicacoes_insumos
        (safra_id, insumo_id, tipo_aplicacao, quantidade, responsavel_id, data_aplicacao)
        VALUES (?, ?, ?, ?, ?, NOW())
        `,
        [safra_id, insumo_id, tipo_aplicacao, qtd, responsavel_id || null],
      );

      await connection.commit();

      res.status(201).json({
        status: true,
        message: "Aplicação registrada com sucesso",
        id: result.insertId,
        quantidade_atual_insumo: nova_quantidade,
      });
    } catch (error) {
      await connection.rollback();
      console.error(error.message);
      res.status(400).json({ status: false, message: error.message });
    } finally {
      connection.release();
    }
  },
);

// ============================
// PUT /aplicacoes_insumos/:id → ATUALIZAR
// ============================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;
      const { safra_id, quantidade, responsavel_id } = req.body;

      if (quantidade === undefined) {
        return res.status(400).json({
          status: false,
          message: "Quantidade inválida",
        });
      }

      const qtd = Number(quantidade);

      if (Number.isNaN(qtd) || qtd <= 0) {
        return res.status(400).json({
          status: false,
          message: "Quantidade inválida",
        });
      }

      await connection.beginTransaction();

      const [aplicacaoRows] = await connection.query(
        `SELECT insumo_id, quantidade FROM aplicacoes_insumos WHERE id = ? FOR UPDATE`,
        [id],
      );

      if (aplicacaoRows.length === 0) {
        throw new Error("Aplicação não encontrada");
      }

      const { insumo_id, quantidade: quantidade_antiga } = aplicacaoRows[0];

      const diferenca = qtd - quantidade_antiga;

      const [insumoRows] = await connection.query(
        `SELECT quantidade_disponivel FROM insumos WHERE id = ? FOR UPDATE`,
        [insumo_id],
      );

      if (diferenca > 0 && diferenca > insumoRows[0].quantidade_disponivel) {
        throw new Error("Estoque insuficiente");
      }

      // Ajusta estoque
      await connection.query(
        `UPDATE insumos
         SET quantidade_disponivel = quantidade_disponivel - ?
         WHERE id = ?`,
        [diferenca, insumo_id],
      );

      // Atualiza aplicação
      await connection.query(
        `
        UPDATE aplicacoes_insumos
        SET safra_id = ?, quantidade = ?, responsavel_id = ?
        WHERE id = ?
        `,
        [safra_id, qtd, responsavel_id || null, id],
      );

      await connection.commit();

      res.json({
        status: true,
        message: "Aplicação atualizada com sucesso",
      });
    } catch (error) {
      await connection.rollback();
      console.error(error.message);
      res.status(400).json({ status: false, message: error.message });
    } finally {
      connection.release();
    }
  },
);

// ============================
// DELETE /aplicacoes_insumos/:id → REMOVER (ESTORNA ESTOQUE)
// ============================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;

      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT insumo_id, quantidade FROM aplicacoes_insumos WHERE id = ? FOR UPDATE`,
        [id],
      );

      if (rows.length === 0) {
        throw new Error("Aplicação não encontrada");
      }

      const { insumo_id, quantidade } = rows[0];

      await connection.query(
        `
        UPDATE insumos
        SET quantidade_disponivel = quantidade_disponivel + ?
        WHERE id = ?
        `,
        [quantidade, insumo_id],
      );

      await connection.query(`DELETE FROM aplicacoes_insumos WHERE id = ?`, [
        id,
      ]);

      await connection.commit();

      res.json({
        status: true,
        message: "Aplicação removida com sucesso",
      });
    } catch (error) {
      await connection.rollback();
      console.error(error.message);
      res.status(400).json({ status: false, message: error.message });
    } finally {
      connection.release();
    }
  },
);

module.exports = router;
