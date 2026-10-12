const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * Listar espécies (ENUM da tabela animais)
 */
router.get("/", autenticarToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM animais LIKE 'especie'");
    const enumStr = rows[0].Type; // ex: enum('Bovino','Caprino','Suíno')
    const matches = enumStr.match(/'([^']+)'/g).map((s) => s.replace(/'/g, ""));
    res.json({ data: matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar espécies" });
  }
});

/**
 * Adicionar nova espécie ao ENUM
 */
router.post("/", autenticarToken, autorizartipo("admin"), async (req, res) => {
  try {
    const { novaEspecie } = req.body;

    if (!novaEspecie) {
      return res.status(400).json({ message: "Informe o nome da espécie" });
    }

    // Buscar espécies atuais
    const [rows] = await pool.query("SHOW COLUMNS FROM animais LIKE 'especie'");
    const enumStr = rows[0].Type;
    const especies = enumStr
      .match(/'([^']+)'/g)
      .map((s) => s.replace(/'/g, ""));

    if (especies.includes(novaEspecie)) {
      return res.status(400).json({ message: "Espécie já existente" });
    }

    // Montar nova lista ENUM
    const novasEspecies = [...especies, novaEspecie];
    const enumSQL = `ALTER TABLE animais MODIFY especie ENUM('${novasEspecies.join(
      "','"
    )}')`;

    await pool.query(enumSQL);

    res.json({
      message: "Espécie adicionada com sucesso",
      data: novasEspecies,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao adicionar espécie" });
  }
});

module.exports = router;
