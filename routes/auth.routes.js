const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const router = express.Router();

///CADASTRO DE USUÁRIO (LIGADO AO FUNCIONÁRIO)

router.post("/register", async (req, res) => {
  try {
    const { funcionario_id, email, senha, tipo } = req.body;

    if (!funcionario_id || !email || !senha || !tipo) {
      return res.status(400).json({ message: "Preencha todos os campos" });
    }

    // Verificar se funcionário existe
    const [funcionarioRows] = await pool.query(
      "SELECT id, nome FROM funcionarios WHERE id = ?",
      [funcionario_id],
    );
    if (funcionarioRows.length === 0) {
      return res.status(400).json({ message: "Funcionário não encontrado" });
    }

    const nome = funcionarioRows[0].nome;

    // Verificar se email existe
    const [userExists] = await pool.query(
      "SELECT id FROM usuarios WHERE email = ?",
      [email],
    );
    if (userExists.length > 0) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    // Criptografar senha
    const hash = await bcrypt.hash(senha, 10);

    await pool.query(
      "INSERT INTO usuarios (nome, email, senha, tipo, funcionario_id) VALUES (?, ?, ?, ?, ?)",
      [nome, email, hash, tipo.toLowerCase().trim(), funcionario_id],
    );

    res.json({ message: "Usuário cadastrado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao cadastrar usuário" });
  }
});

///LOGIN

router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "Usuário não encontrado" });
    }

    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ message: "Senha inválida" });
    }

    // Gerar token
    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET || "segredo",
      { expiresIn: "7d" },
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        funcionario_id: usuario.funcionario_id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao autenticar usuário" });
  }
});

const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

///LISTAR TODOS OS USUÁRIOS (ADMIN, GERENTE)

router.get(
  "/usuarios",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT u.*, f.nome AS funcionario_nome
        FROM usuarios u
        LEFT JOIN funcionarios f ON f.id = u.funcionario_id
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error("Erro listar usuários:", error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar usuários" });
    }
  },
);

///BUSCAR 1 USUÁRIO (ADMIN, GERENTE)

router.get(
  "/usuarios/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `
        SELECT u.*, f.nome AS funcionario_nome
        FROM usuarios u
        LEFT JOIN funcionarios f ON f.id = u.funcionario_id
        WHERE u.id = ?
        `,
        [id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Usuário não encontrado" });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error("Erro buscar usuário:", error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar usuário" });
    }
  },
);

///EDITAR USUÁRIO (ADMIN, GERENTE)

router.put(
  "/usuarios/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { funcionario_id, email, senha, tipo } = req.body;

      // Buscar o nome do funcionário
      let nome = null;
      if (funcionario_id) {
        const [funcRows] = await pool.query(
          "SELECT nome FROM funcionarios WHERE id = ?",
          [funcionario_id],
        );
        if (funcRows.length === 0) {
          return res
            .status(400)
            .json({ message: "Funcionário não encontrado" });
        }
        nome = funcRows[0].nome;
      }

      // Atualizar senha se enviada
      let senhaHash = null;
      if (senha) {
        senhaHash = await bcrypt.hash(senha, 10);
      }

      const query = `
        UPDATE usuarios SET 
          nome = COALESCE(?, nome),
          email = COALESCE(?, email),
          tipo = COALESCE(?, tipo),
          funcionario_id = COALESCE(?, funcionario_id),
          senha = COALESCE(?, senha)
        WHERE id = ?
      `;

      const values = [
        nome,
        email,
        tipo?.toLowerCase().trim(),
        funcionario_id,
        senhaHash,
        id,
      ];

      const [result] = await pool.query(query, values);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Usuário não encontrado" });
      }

      res.json({ status: true, message: "Usuário atualizado com sucesso!" });
    } catch (error) {
      console.error("Erro atualizar usuário:", error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar usuário" });
    }
  },
);

///DELETAR USUÁRIO (ADMIN, GERENTE)

router.delete(
  "/usuarios/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [result] = await pool.query("DELETE FROM usuarios WHERE id = ?", [
        id,
      ]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Usuário não encontrado" });
      }

      res.json({ status: true, message: "Usuário removido com sucesso!" });
    } catch (error) {
      console.error("Erro remover usuário:", error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir usuário" });
    }
  },
);

// ===============================
// Rota para enviar email de recuperação
// ===============================
router.post("/recuperar-senha", async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [
      email,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ message: "Email não encontrado" });

    const usuario = rows[0];
    const token = crypto.randomBytes(20).toString("hex");
    const expiracao = new Date(Date.now() + 3600000); // 1 hora

    // Salvar token e expiração no banco (adicione colunas token_reset e expira_token na tabela usuarios)
    await pool.query(
      "UPDATE usuarios SET token_reset=?, expira_token=? WHERE id=?",
      [token, expiracao, usuario.id],
    );

    // Enviar email com link
    const transporter = nodemailer.createTransport({
      service: "gmail", // ou outro serviço
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Recuperação de senha",
      text: `Clique no link para redefinir sua senha: http://localhost:3000/redefinir-senha/${token}`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Email de recuperação enviado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao enviar email de recuperação" });
  }
});

// ===============================
// Rota para redefinir senha
// ===============================
router.post("/redefinir-senha/:token", async (req, res) => {
  const { token } = req.params;
  const { senha } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM usuarios WHERE token_reset=? AND expira_token > NOW()",
      [token],
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Token inválido ou expirado" });

    const hash = await bcrypt.hash(senha, 10);
    await pool.query(
      "UPDATE usuarios SET senha=?, token_reset=NULL, expira_token=NULL WHERE id=?",
      [hash, rows[0].id],
    );

    res.json({ message: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao redefinir senha" });
  }
});

module.exports = router;
