const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/:brinco/rastreio",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const { brinco } = req.params;

      if (!brinco) {
        return res
          .status(400)
          .json({ status: false, message: "Brinco é obrigatório" });
      }

      // ===============================
      // ANIMAL
      // ===============================
      const [[animalRaw]] = await pool.query(
        `SELECT * FROM animais WHERE brinco = ?`,
        [brinco],
      );

      if (!animalRaw) {
        return res
          .status(404)
          .json({ status: false, message: "Animal não encontrado" });
      }

      const { peso_atual, ...animal } = animalRaw; // Não enviar peso da tabela animais

      // ===============================
      // PESAGENS DO ANIMAL
      // ===============================
      let pesagens = [];
      try {
        const [rows] = await pool.query(
          `SELECT
              id,
              data_pesagem,
              dataproxima_pesagem,
              peso_anterior,
              peso_recente,
              observacoes
           FROM pesagens
           WHERE animal_id = ?
           ORDER BY data_pesagem DESC, id DESC`,
          [animal.id],
        );

        pesagens = rows;
      } catch (err) {
        console.error("Erro ao buscar pesagens:", err.sqlMessage || err);
      }

      // ===============================
      // PRODUÇÃO DO ANIMAL
      // ===============================
      let producao_animal = [];
      try {
        const [rows] = await pool.query(
          `SELECT
              p.id,
              p.data,
              p.tipo,
              p.quantidade,
              p.unidade,
              p.observacoes
           FROM producao_animal p
           WHERE p.animal_id = ?
           ORDER BY p.data DESC`,
          [animal.id],
        );
        producao_animal = rows;
      } catch (err) {
        console.error("Erro ao buscar produção:", err.sqlMessage || err);
      }

      // ===============================
      // DOENÇAS
      // ===============================
      let doencas_animais = [];
      try {
        const [rows] = await pool.query(
          `SELECT * FROM doencas_animais WHERE animal_id = ? ORDER BY data_diagnostico DESC`,
          [animal.id],
        );
        doencas_animais = rows;
      } catch (err) {
        console.error("Erro ao buscar doenças:", err.sqlMessage || err);
      }

      // ===============================
      // GESTAÇÕES
      // ===============================
      let gestacoes = [];
      try {
        const [rows] = await pool.query(
          `SELECT 
              g.*,
              pai.nome AS pai_nome
           FROM gestacoes g
           LEFT JOIN animais pai ON g.pai_id = pai.id
           WHERE g.animal_id = ?
           ORDER BY g.created_at DESC`,
          [animal.id],
        );
        gestacoes = rows;
      } catch (err) {
        console.error("Erro ao buscar gestações:", err.sqlMessage || err);
      }

      // ===============================
      // NATALIDADE
      // ===============================
      let natalidade = [];
      try {
        const [rows] = await pool.query(
          `SELECT
              id,
              data_parto,
              total_nascidos,
              vivos,
              mortos,
              observacoes
           FROM natalidade
           WHERE mae_id = ?
           ORDER BY data_parto DESC`,
          [animal.id],
        );
        natalidade = rows;
      } catch (err) {
        console.error("Erro ao buscar natalidade:", err.sqlMessage || err);
      }

      return res.json({
        status: true,
        data: {
          animal,
          pesagens,
          producao_animal, // 👈 Produção adicionada ao rastreio
          doencas_animais,
          gestacoes,
          natalidade,
        },
      });
    } catch (err) {
      console.error("Erro geral no rastreio:", err.sqlMessage || err);
      return res.status(500).json({
        status: false,
        message: "Erro ao buscar rastreio do animal",
      });
    }
  },
);

module.exports = router;
