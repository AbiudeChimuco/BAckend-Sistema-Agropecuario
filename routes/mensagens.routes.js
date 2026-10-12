const express = require("express");
const pool = require("../config/db");
const { autenticarToken } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Configuração do Multer (Upload de anexos)

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/mensagens");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const nomeArquivo =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, nomeArquivo);
  },
});

const upload = multer({ storage });

// Enviar nova mensagem

router.post(
  "/",
  autenticarToken,
  upload.array("anexos", 5),
  async (req, res) => {
    try {
      const { destinatario_id, assunto, conteudo } = req.body;
      const remetente_id = req.usuario.id;

      if (!destinatario_id || !conteudo) {
        return res
          .status(400)
          .json({ erro: "Destinatário e conteúdo são obrigatórios." });
      }

      // Nomes dos arquivos enviados
      const anexos = req.files.map((file) => file.filename);

      const [result] = await pool.query(
        `INSERT INTO mensagens (remetente_id, destinatario_id, assunto, conteudo, anexos)
       VALUES (?, ?, ?, ?, ?)`,
        [
          remetente_id,
          destinatario_id,
          assunto || "",
          conteudo,
          JSON.stringify(anexos),
        ],
      );

      res.status(201).json({
        mensagem: "Mensagem enviada com sucesso.",
        id: result.insertId,
        anexos,
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(500).json({ erro: "Erro interno ao enviar mensagem." });
    }
  },
);

// Listar mensagens recebidas

router.get("/recebidas", autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const [mensagens] = await pool.query(
      `SELECT m.*, u.nome AS remetente_nome 
       FROM mensagens m
       JOIN usuarios u ON m.remetente_id = u.id
       WHERE m.destinatario_id = ?
       ORDER BY m.data_envio DESC`,
      [usuarioId],
    );

    // Converter campo 'anexos' de string JSON para array
    mensagens.forEach((m) => {
      if (m.anexos) m.anexos = JSON.parse(m.anexos);
    });

    res.json(mensagens);
  } catch (error) {
    console.error("Erro ao listar mensagens recebidas:", error);
    res.status(500).json({ erro: "Erro interno ao listar mensagens." });
  }
});

// Listar mensagens enviadas

router.get("/enviadas", autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const [mensagens] = await pool.query(
      `SELECT m.*, u.nome AS destinatario_nome 
       FROM mensagens m
       JOIN usuarios u ON m.destinatario_id = u.id
       WHERE m.remetente_id = ?
       ORDER BY m.data_envio DESC`,
      [usuarioId],
    );

    mensagens.forEach((m) => {
      if (m.anexos) m.anexos = JSON.parse(m.anexos);
    });

    res.json(mensagens);
  } catch (error) {
    console.error("Erro ao listar mensagens enviadas:", error);
    res.status(500).json({ erro: "Erro interno ao listar mensagens." });
  }
});

// PATCH /mensagens/:id/lida → Marcar mensagem como lida

router.patch("/:id/lida", autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [mensagem] = await pool.query(
      `SELECT * FROM mensagens WHERE id = ? AND destinatario_id = ?`,
      [id, usuarioId],
    );

    if (mensagem.length === 0) {
      return res
        .status(404)
        .json({ erro: "Mensagem não encontrada ou não pertence a você." });
    }

    await pool.query(`UPDATE mensagens SET lida = TRUE WHERE id = ?`, [id]);

    res.json({ mensagem: "Mensagem marcada como lida." });
  } catch (error) {
    console.error("Erro ao marcar mensagem como lida:", error);
    res.status(500).json({ erro: "Erro interno ao atualizar mensagem." });
  }
});

//  Apagar mensagem

router.delete("/:id", autenticarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { id } = req.params;

    const [mensagem] = await pool.query(
      `SELECT * FROM mensagens 
       WHERE id = ? AND (remetente_id = ? OR destinatario_id = ?)`,
      [id, usuarioId, usuarioId],
    );

    if (mensagem.length === 0) {
      return res
        .status(404)
        .json({ erro: "Mensagem não encontrada ou não pertence a você." });
    }

    // Apagar anexos do servidor
    if (mensagem[0].anexos) {
      const arquivos = JSON.parse(mensagem[0].anexos);
      arquivos.forEach((arquivo) => {
        const filePath = path.join(__dirname, "../uploads/mensagens", arquivo);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    }

    await pool.query(`DELETE FROM mensagens WHERE id = ?`, [id]);

    res.json({ mensagem: "Mensagem apagada com sucesso." });
  } catch (error) {
    console.error("Erro ao apagar mensagem:", error);
    res.status(500).json({ erro: "Erro interno ao apagar mensagem." });
  }
});

module.exports = router;
