const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// listar todos funcionários

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM funcionarios");
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar funcionários" });
    }
  },
);

// listar ou pegar funcionário

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM funcionarios WHERE id = ?",
        [req.params.id],
      );
      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Funcionário não encontrado" });
      }
      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar funcionário" });
    }
  },
);

//  cadastrar

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const {
        nome,
        genero,
        data_nascimento,
        documento_id,
        funcao,
        salario_base,
        telefone,
        email,
        endereco,
        estado_civil,
        nacionalidade,
        foto_perfil,
        observacoes,
      } = req.body;

      if (!nome || !funcao) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: nome e função",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO funcionarios 
        (nome, genero, data_nascimento, documento_id, funcao, salario_base, telefone, email, endereco, estado_civil, nacionalidade, foto_perfil, observacoes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nome,
          genero || null,
          data_nascimento || null,
          documento_id || null,
          funcao,
          salario_base || null,
          telefone || null,
          email || null,
          endereco || null,
          estado_civil || null,
          nacionalidade || null,
          foto_perfil || null,
          observacoes || null,
        ],
      );

      res.status(201).json({
        status: true,
        message: "Funcionário cadastrado com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar funcionário" });
    }
  },
);

// PUT /funcionarios/:id → atualizar

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const {
        nome,
        genero,
        data_nascimento,
        documento_id,
        funcao,
        salario_base,
        telefone,
        email,
        endereco,
        estado_civil,
        nacionalidade,
        foto_perfil,
        observacoes,
      } = req.body;

      const [result] = await pool.query(
        `UPDATE funcionarios 
         SET nome = ?, genero = ?, data_nascimento = ?, documento_id = ?, funcao = ?, salario_base = ?, telefone = ?, email = ?, endereco = ?, estado_civil = ?, nacionalidade = ?, foto_perfil = ?, observacoes = ?
         WHERE id = ?`,
        [
          nome,
          genero,
          data_nascimento,
          documento_id,
          funcao,
          salario_base,
          telefone,
          email,
          endereco,
          estado_civil,
          nacionalidade,
          foto_perfil,
          observacoes,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Funcionário não encontrado" });
      }

      res.json({ status: true, message: "Funcionário atualizado com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar funcionário" });
    }
  },
);

//  excluir funcionário

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM funcionarios WHERE id = ?",
        [req.params.id],
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Funcionário não encontrado" });
      }

      res.json({ status: true, message: "Funcionário excluído com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir funcionário" });
    }
  },
);

router.get(
  "/count",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS total FROM funcionarios",
      );
      res.json({ status: true, total: rows[0].total });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao contar funcionarios" });
    }
  },
);

module.exports = router;
