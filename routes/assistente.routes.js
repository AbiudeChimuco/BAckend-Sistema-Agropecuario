const express = require("express");
const pool = require("../config/db");
const { autenticarToken } = require("../middleware/auth.middleware");

const router = express.Router();

//  responder perguntas

router.post("/", autenticarToken, async (req, res) => {
  try {
    const { pergunta } = req.body;
    if (!pergunta)
      return res.status(400).json({ erro: "Pergunta obrigatória." });

    const texto = pergunta.toLowerCase();
    let resposta = "Desculpe, ainda não sei responder a isso.";

    // --- Exemplos de temas detectados ---
    if (texto.includes("nascimento") || texto.includes("natalidade")) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS total FROM natalidade 
         WHERE MONTH(data_nascimento) = MONTH(CURRENT_DATE())`,
      );
      resposta = `Neste mês ocorreram ${rows[0].total} nascimentos registrados.`;
    } else if (texto.includes("morte") || texto.includes("mortalidade")) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS total FROM mortalidade 
         WHERE MONTH(data_morte) = MONTH(CURRENT_DATE())`,
      );
      resposta = `Foram registradas ${rows[0].total} mortes neste mês.`;
    } else if (
      texto.includes("vacina") ||
      texto.includes("vacinas atrasadas")
    ) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS total FROM vacinas 
         WHERE data_aplicacao < CURDATE() AND status = 'pendente'`,
      );
      resposta =
        rows[0].total === 0
          ? "Todas as vacinas estão em dia. ✅"
          : `Existem ${rows[0].total} vacinas pendentes ou atrasadas.`;
    } else if (texto.includes("produção") || texto.includes("safra")) {
      const [rows] = await pool.query(
        `SELECT SUM(quantidade) AS total FROM producao 
         WHERE YEAR(data_colheita) = YEAR(CURRENT_DATE())`,
      );
      resposta = rows[0].total
        ? `A produção total deste ano é de ${rows[0].total} unidades. 🌾`
        : "Ainda não há registros de produção este ano.";
    } else if (texto.includes("peso") || texto.includes("pesagem")) {
      const [rows] = await pool.query(
        `SELECT AVG(peso) AS media FROM pesagens WHERE data_pesagem >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      );
      resposta = rows[0].media
        ? `O peso médio dos animais nos últimos 30 dias é de ${rows[0].media.toFixed(
            1,
          )} kg. 🐄`
        : "Ainda não há dados de pesagem recentes.";
    } else if (
      texto.includes("ajuda") ||
      texto.includes("comandos") ||
      texto.includes("o que posso")
    ) {
      resposta = `Posso ajudar com informações como:
- número de nascimentos, mortes ou vacinas pendentes
- média de peso dos animais
- total de produção agrícola
- status de lotes e safras
Basta perguntar! 😊`;
    }

    res.json({ resposta });
  } catch (error) {
    console.error("Erro no assistente:", error);
    res.status(500).json({ erro: "Erro interno ao processar a pergunta." });
  }
});

module.exports = router;
