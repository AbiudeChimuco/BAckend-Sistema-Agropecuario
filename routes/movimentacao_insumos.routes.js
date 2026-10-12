const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

//  listar todas movimentações

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT m.*, i.nome AS insumo_nome, i.tipo AS insumo_tipo
        FROM movimentacao_insumos m
        JOIN insumos i ON m.insumo_id = i.id
        ORDER BY m.data_movimentacao DESC
      `);
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar movimentações" });
    }
  },
);

// registrar entrada ou saída

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { insumo_id, tipo_movimentacao, quantidade, responsavel_id } =
        req.body;

      if (!insumo_id || !tipo_movimentacao || !quantidade) {
        return res.status(400).json({
          status: false,
          message:
            "Campos obrigatórios: insumo_id, tipo_movimentacao, quantidade",
        });
      }

      if (!["entrada", "saida"].includes(tipo_movimentacao)) {
        return res.status(400).json({
          status: false,
          message: "Tipo de movimentação inválido. Use 'entrada' ou 'saida'",
        });
      }

      // Busca insumo para atualizar quantidade
      const [insumoRows] = await pool.query(
        "SELECT quantidade_disponivel FROM insumos WHERE id = ?",
        [insumo_id],
      );

      if (insumoRows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Insumo não encontrado" });
      }

      let nova_quantidade = insumoRows[0].quantidade_disponivel;

      if (tipo_movimentacao === "entrada") {
        nova_quantidade += quantidade;
      } else {
        if (quantidade > nova_quantidade) {
          return res.status(400).json({
            status: false,
            message: "Quantidade insuficiente em estoque",
          });
        }
        nova_quantidade -= quantidade;
      }

      // Atualiza quantidade no insumo
      await pool.query(
        "UPDATE insumos SET quantidade_disponivel = ? WHERE id = ?",
        [nova_quantidade, insumo_id],
      );

      // Registra movimentação
      const [result] = await pool.query(
        `INSERT INTO movimentacao_insumos (insumo_id, tipo_movimentacao, quantidade, responsavel_id, data_movimentacao)
         VALUES (?, ?, ?, ?, NOW())`,
        [insumo_id, tipo_movimentacao, quantidade, responsavel_id || null],
      );

      res.status(201).json({
        status: true,
        message: "Movimentação registrada com sucesso",
        id: result.insertId,
        quantidade_atual: nova_quantidade,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao registrar movimentação" });
    }
  },
);

// atualizar movimentação (opcional)

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { quantidade } = req.body;

      if (!quantidade) {
        return res
          .status(400)
          .json({ status: false, message: "Quantidade obrigatória" });
      }

      await pool.query(
        "UPDATE movimentacao_insumos SET quantidade = ? WHERE id = ?",
        [quantidade, id],
      );

      res.json({ status: true, message: "Movimentação atualizada" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar movimentação" });
    }
  },
);

// DELETE /movimentacao_insumos/:id → excluir movimentação

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM movimentacao_insumos WHERE id = ?", [id]);
      res.json({ status: true, message: "Movimentação excluída" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir movimentação" });
    }
  },
);

module.exports = router;
