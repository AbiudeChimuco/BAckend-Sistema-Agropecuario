// routes/usuarios.routes.js
const express = require("express");
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Funções auxiliares

const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const tiposValidos = ["admin", "comum"];

// POST /register → Cadastrar usuário (Admin ou sistema)

router.post("/register", async (req, res) => {
  try {
    const { funcionario_id, email, senha, tipo } = req.body;

    if (!funcionario_id || !email || !senha || !tipo) {
      return res
        .status(400)
        .json({ success: false, message: "Preencha todos os campos." });
    }

    if (!validarEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email inválido." });
    }

    if (!tiposValidos.includes(tipo)) {
      return res
        .status(400)
        .json({ success: false, message: "Tipo de usuário inválido." });
    }

    // Verificar funcionário
    const [funcionario] = await pool.query(
      "SELECT id, nome FROM funcionarios WHERE id = ?",
      [funcionario_id],
    );
    if (funcionario.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Funcionário não encontrado." });
    }

    const nome = funcionario[0].nome;

    // Verificar email duplicado
    const [userExists] = await pool.query(
      "SELECT id FROM usuarios WHERE email = ?",
      [email],
    );
    if (userExists.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email já cadastrado." });
    }

    // Criptografar senha
    const hash = await bcrypt.hash(senha, 10);

    const [result] = await pool.query(
      "INSERT INTO usuarios (nome, email, senha, tipo, funcionario_id) VALUES (?, ?, ?, ?, ?)",
      [nome, email, hash, tipo, funcionario_id],
    );

    res.status(201).json({
      success: true,
      message: "Usuário cadastrado com sucesso!",
      usuario: { id: result.insertId, nome, email, tipo },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Erro ao cadastrar usuário." });
  }
});

//  Perfil do usuário logado

router.get("/me", autenticarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nome, email, tipo FROM usuarios WHERE id = ?",
      [req.usuario.id],
    );

    if (!rows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Usuário não encontrado." });
    }

    res.json({ success: true, usuario: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erro ao buscar perfil." });
  }
});

//  Atualizar nome e email do próprio usuário

router.put("/me/update-profile", autenticarToken, async (req, res) => {
  try {
    const { nome, email } = req.body;

    if (!nome || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Preencha todos os campos." });
    }

    if (!validarEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email inválido." });
    }

    // Verificar email duplicado
    const [emailExists] = await pool.query(
      "SELECT id FROM usuarios WHERE email = ? AND id != ?",
      [email, req.usuario.id],
    );
    if (emailExists.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email já está sendo usado." });
    }

    await pool.query("UPDATE usuarios SET nome = ?, email = ? WHERE id = ?", [
      nome,
      email,
      req.usuario.id,
    ]);

    res.json({ success: true, message: "Perfil atualizado com sucesso!" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Erro ao atualizar perfil." });
  }
});

//  Alterar senha do próprio usuário

router.put("/me/update-password", autenticarToken, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;

    if (!senha_atual || !nova_senha) {
      return res
        .status(400)
        .json({ success: false, message: "Preencha todos os campos." });
    }

    const [rows] = await pool.query("SELECT senha FROM usuarios WHERE id = ?", [
      req.usuario.id,
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuário não encontrado." });
    }

    const senhaValida = await bcrypt.compare(senha_atual, rows[0].senha);
    if (!senhaValida) {
      return res
        .status(400)
        .json({ success: false, message: "Senha atual incorreta." });
    }

    const hash = await bcrypt.hash(nova_senha, 10);
    await pool.query("UPDATE usuarios SET senha = ? WHERE id = ?", [
      hash,
      req.usuario.id,
    ]);

    res.json({ success: true, message: "Senha atualizada com sucesso!" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Erro ao atualizar senha." });
  }
});

// Listar usuários
router.get("/", autenticarToken, autorizartipo("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nome, email, tipo FROM usuarios",
    );
    res.json({ success: true, usuarios: rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Erro ao buscar usuários." });
  }
});

//  Atualizar usuário

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    try {
      const { nome, email, senha, tipo } = req.body;
      const { id } = req.params;

      if (!tiposValidos.includes(tipo)) {
        return res
          .status(400)
          .json({ success: false, message: "Tipo de usuário inválido." });
      }

      if (!validarEmail(email)) {
        return res
          .status(400)
          .json({ success: false, message: "Email inválido." });
      }

      const [emailExists] = await pool.query(
        "SELECT id FROM usuarios WHERE email = ? AND id != ?",
        [email, id],
      );
      if (emailExists.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "Email já está sendo usado." });
      }

      if (senha) {
        const hash = await bcrypt.hash(senha, 10);
        await pool.query(
          "UPDATE usuarios SET nome = ?, email = ?, tipo = ?, senha = ? WHERE id = ?",
          [nome, email, tipo, hash, id],
        );
      } else {
        await pool.query(
          "UPDATE usuarios SET nome = ?, email = ?, tipo = ? WHERE id = ?",
          [nome, email, tipo, id],
        );
      }

      res.json({ success: true, message: "Usuário atualizado com sucesso!" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar usuário." });
    }
  },
);

// Deletar usuário

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (parseInt(id) === req.usuario.id) {
        return res.status(400).json({
          success: false,
          message: "Você não pode deletar a si mesmo.",
        });
      }

      const [exists] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ?",
        [id],
      );
      if (exists.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Usuário não encontrado." });
      }

      await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
      res.json({ success: true, message: "Usuário deletado com sucesso!" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Erro ao deletar usuário." });
    }
  },
);

module.exports = router;
