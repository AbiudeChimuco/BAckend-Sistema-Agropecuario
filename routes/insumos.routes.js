/* eslint-disable prettier/prettier */
const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

const TIPOS_VALIDOS = [
  "semente",
  "fertilizante",
  "pesticida",
  "adubo",
  "outro",
];

// ======================================================
// LISTAR TODOS (com paginação e busca)
// GET /insumos?page=1&limit=10&search=
// ======================================================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search || "";

      const offset = (page - 1) * limit;

      let where = "";
      let params = [];

      if (search) {
        where = `WHERE i.nome LIKE ? OR f.nome LIKE ?`;
        params.push(`%${search}%`, `%${search}%`);
      }

      // total
      const [totalRows] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM insumos i
        LEFT JOIN fornecedores f ON i.fornecedor = f.id
        ${where}
        `,
        params,
      );

      // dados
      const [rows] = await pool.query(
        `
        SELECT i.*, f.nome AS fornecedor_nome
        FROM insumos i
        LEFT JOIN fornecedores f ON i.fornecedor = f.id
        ${where}
        ORDER BY i.id DESC
        LIMIT ? OFFSET ?
        `,
        [...params, limit, offset],
      );

      res.json({
        status: true,
        data: rows,
        pagination: {
          page,
          limit,
          total: totalRows[0].total,
          totalPages: Math.ceil(totalRows[0].total / limit),
        },
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar insumos" });
    }
  },
);

// ======================================================
// OBTER UM
// ======================================================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [rows] = await pool.query(
        `
        SELECT i.*, f.nome AS fornecedor_nome
        FROM insumos i
        LEFT JOIN fornecedores f ON i.fornecedor = f.id
        WHERE i.id = ?
      `,
        [id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Insumo não encontrado" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: "Erro ao buscar insumo" });
    }
  },
);

// ======================================================
// CADASTRAR
// ======================================================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const {
        nome,
        tipo,
        quantidade_disponivel,
        validade,
        fornecedor,
        preco_unitario,
      } = req.body;

      // validação básica
      if (!nome || !tipo || !fornecedor || preco_unitario === undefined) {
        return res.status(400).json({
          status: false,
          message:
            "Campos obrigatórios: nome, tipo, fornecedor e preço unitário",
        });
      }

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({
          status: false,
          message: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(", ")}`,
        });
      }

      const quantidade = Number(quantidade_disponivel) || 0;
      const preco = Number(preco_unitario);

      if (quantidade < 0) {
        return res
          .status(400)
          .json({ status: false, message: "Quantidade não pode ser negativa" });
      }

      if (preco < 0) {
        return res.status(400).json({
          status: false,
          message: "Preço unitário não pode ser negativo",
        });
      }

      // verificar fornecedor
      const [forn] = await pool.query(
        "SELECT id FROM fornecedores WHERE id = ?",
        [fornecedor],
      );

      if (forn.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Fornecedor inválido",
        });
      }

      const [result] = await pool.query(
        `
        INSERT INTO insumos 
        (nome, tipo, quantidade_disponivel, validade, fornecedor, preco_unitario)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [nome, tipo, quantidade, validade || null, fornecedor, preco],
      );

      res.status(201).json({
        status: true,
        message: "Insumo cadastrado com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar insumo" });
    }
  },
);

// ======================================================
// ATUALIZAR
// ======================================================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const {
        nome,
        tipo,
        quantidade_disponivel,
        validade,
        fornecedor,
        preco_unitario,
      } = req.body;

      if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({
          status: false,
          message: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(", ")}`,
        });
      }

      const campos = [];
      const valores = [];

      if (nome) {
        campos.push("nome = ?");
        valores.push(nome);
      }

      if (tipo) {
        campos.push("tipo = ?");
        valores.push(tipo);
      }

      if (quantidade_disponivel !== undefined) {
        if (quantidade_disponivel < 0) {
          return res.status(400).json({
            status: false,
            message: "Quantidade não pode ser negativa",
          });
        }
        campos.push("quantidade_disponivel = ?");
        valores.push(quantidade_disponivel);
      }

      if (validade !== undefined) {
        campos.push("validade = ?");
        valores.push(validade);
      }

      if (fornecedor !== undefined) {
        campos.push("fornecedor = ?");
        valores.push(fornecedor);
      }

      if (preco_unitario !== undefined) {
        if (preco_unitario < 0) {
          return res.status(400).json({
            status: false,
            message: "Preço unitário não pode ser negativo",
          });
        }
        campos.push("preco_unitario = ?");
        valores.push(preco_unitario);
      }

      if (campos.length === 0) {
        return res
          .status(400)
          .json({ status: false, message: "Nenhum dado para atualizar" });
      }

      valores.push(id);

      const [result] = await pool.query(
        `UPDATE insumos SET ${campos.join(", ")} WHERE id = ?`,
        valores,
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Insumo não encontrado" });
      }

      res.json({ status: true, message: "Insumo atualizado com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar insumo" });
    }
  },
);

// ======================================================
// EXCLUIR
// ======================================================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [result] = await pool.query("DELETE FROM insumos WHERE id = ?", [
        id,
      ]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Insumo não encontrado" });
      }

      res.json({ status: true, message: "Insumo excluído com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir insumo" });
    }
  },
);

module.exports = router;
