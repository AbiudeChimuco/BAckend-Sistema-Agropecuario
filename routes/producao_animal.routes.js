const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

const TIPOS_VALIDOS = ["leite", "ovos", "carne", "mel", "outro"];
const UNIDADES_VALIDAS = ["LT", "KG", "Unidades"];

// =============================
// LISTAR TODAS PRODUÇÕES
// =============================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
      SELECT 
        p.*, 
        a.nome AS animal_nome,
        a.brinco
      FROM producao_animal p
      JOIN animais a ON a.id = p.animal_id
      ORDER BY p.data DESC
    `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar produção animal" });
    }
  },
);

// =============================
// BUSCAR POR ID
// =============================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `
      SELECT p.*, a.nome AS animal_nome, a.brinco
      FROM producao_animal p
      JOIN animais a ON a.id = p.animal_id
      WHERE p.id = ?
    `,
        [req.params.id],
      );

      if (rows.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar registro" });
    }
  },
);

// =============================
// CRIAR PRODUÇÃO
// =============================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    try {
      const { animal_id, tipo, quantidade, unidade, data, observacoes } =
        req.body;

      // VALIDAÇÕES
      if (!animal_id || !tipo || !quantidade || !unidade || !data)
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios não informados",
        });

      if (quantidade <= 0)
        return res.status(400).json({
          status: false,
          message: "Quantidade deve ser maior que zero",
        });

      if (!TIPOS_VALIDOS.includes(tipo))
        return res
          .status(400)
          .json({ status: false, message: "Tipo de produção inválido" });

      if (!UNIDADES_VALIDAS.includes(unidade))
        return res
          .status(400)
          .json({ status: false, message: "Unidade inválida" });

      // VERIFICAR ANIMAL
      const [animal] = await pool.query("SELECT id FROM animais WHERE id = ?", [
        animal_id,
      ]);
      if (animal.length === 0)
        return res
          .status(400)
          .json({ status: false, message: "Animal não existe" });

      const [result] = await pool.query(
        `
      INSERT INTO producao_animal (animal_id, tipo, quantidade, unidade, data, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
        [animal_id, tipo, quantidade, unidade, data, observacoes || null],
      );

      res.status(201).json({
        status: true,
        message: "Produção registrada com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao registrar produção" });
    }
  },
);

// =============================
// ATUALIZAR PRODUÇÃO
// =============================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    try {
      const { animal_id, tipo, quantidade, unidade, data, observacoes } =
        req.body;

      if (!animal_id || !tipo || !quantidade || !unidade || !data)
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios não informados",
        });

      if (quantidade <= 0)
        return res.status(400).json({
          status: false,
          message: "Quantidade deve ser maior que zero",
        });

      if (!TIPOS_VALIDOS.includes(tipo))
        return res
          .status(400)
          .json({ status: false, message: "Tipo inválido" });

      if (!UNIDADES_VALIDAS.includes(unidade))
        return res
          .status(400)
          .json({ status: false, message: "Unidade inválida" });

      const [animal] = await pool.query("SELECT id FROM animais WHERE id = ?", [
        animal_id,
      ]);
      if (animal.length === 0)
        return res
          .status(400)
          .json({ status: false, message: "Animal não existe" });

      const [result] = await pool.query(
        `
      UPDATE producao_animal
      SET animal_id=?, tipo=?, quantidade=?, unidade=?, data=?, observacoes=?
      WHERE id=?
    `,
        [
          animal_id,
          tipo,
          quantidade,
          unidade,
          data,
          observacoes || null,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0)
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });

      res.json({ status: true, message: "Produção atualizada com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar produção" });
    }
  },
);

// =============================
// DELETAR PRODUÇÃO
// =============================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM producao_animal WHERE id = ?",
        [req.params.id],
      );

      if (result.affectedRows === 0)
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });

      res.json({ status: true, message: "Registro excluído com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir registro" });
    }
  },
);

module.exports = router;
