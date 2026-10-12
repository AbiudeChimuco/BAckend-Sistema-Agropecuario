// routes/alertas.routes.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const { autorizartipo } = require("../middleware/auth.middleware");

// Configurações Twilio
const twilioClient = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Configuração Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

router.post(
  "/send",
  autorizartipo(["admin", "gerente",]),
  async (req, res) => {
    const { tipo, destinatario, assunto, mensagem } = req.body;

    if (!tipo || !destinatario || !mensagem) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    try {
      if (tipo === "email") {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: destinatario,
          subject: assunto || "Alerta do sistema",
          text: mensagem,
        });
      } else if (tipo === "whatsapp") {
        await twilioClient.messages.create({
          from: `whatsapp:${TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:${destinatario}`,
          body: mensagem,
        });
      } else {
        return res.status(400).json({ error: "Tipo inválido" });
      }

      // opcional: salvar no banco de dados histórico de alertas

      res.json({ message: "Alerta enviado com sucesso!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao enviar alerta" });
    }
  }
);

module.exports = router;
