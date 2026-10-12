const express = require("express");
const axios = require("axios");
const router = express.Router();

const API_KEY = "c3ed04befe59592fb1da284f353e6b50";

// Cache simples em memória

const climaCache = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

router.get("/:cidade", async (req, res) => {
  const cidade = req.params.cidade;

  // Checa se já existe cache válido
  if (climaCache[cidade]) {
    const cached = climaCache[cidade];
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json({ status: true, ...cached.data, cached: true });
    }
  }

  try {
    // Se não tiver cache ou estiver expirado, buscar da API
    const response = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          q: cidade,
          appid: API_KEY,
          units: "metric",
          lang: "pt",
        },
      },
    );

    const data = {
      cidade: response.data.name,
      temperatura: response.data.main.temp,
      clima: response.data.weather[0].description,
      umidade: response.data.main.humidity,
      vento: response.data.wind.speed,
    };

    // Salvar no cache
    climaCache[cidade] = { data, timestamp: Date.now() };

    res.json({ status: true, ...data, cached: false });
  } catch (err) {
    if (err.response) {
      // Erro retornado pela API
      console.error("Erro API:", err.response.data);
      res.status(err.response.status).json({
        status: false,
        message: err.response.data.message || "Erro ao buscar clima",
      });
    } else {
      // Outros erros
      console.error("Erro Node:", err.message);
      res.status(500).json({ status: false, message: "Erro ao buscar clima" });
    }
  }
});

module.exports = router;
