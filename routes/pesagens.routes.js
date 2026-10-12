const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

//GET /pesagens → listar todas
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          p.*,
          a.nome AS animal_nome,
          a.brinco
        FROM pesagens p
        JOIN animais a ON a.id = p.animal_id
        ORDER BY p.data_pesagem DESC, p.id DESC
      `);

      res.json({ status: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar pesagens",
      });
    }
  },
);

//GET /pesagens/:id → detalhes
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          p.*,
          a.nome AS animal_nome,
          a.brinco
        FROM pesagens p
        JOIN animais a ON a.id = p.animal_id
        WHERE p.id = ?
      `,
        [req.params.id],
      );

      if (!rows.length) {
        return res.status(404).json({
          status: false,
          message: "Pesagem não encontrada",
        });
      }

      res.json({ status: true, data: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar pesagem",
      });
    }
  },
);

//POST /pesagens → cadastrar
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    let {
      animal_id,
      brinco,
      data_pesagem,
      dataproxima_pesagem,
      peso_recente,
      observacoes,
    } = req.body;

    if (!brinco || !data_pesagem || !peso_recente) {
      return res.status(400).json({
        status: false,
        message: "Campos obrigatórios: brinco, data_pesagem, peso_recente",
      });
    }

    try {
      // Resolver animal_id pelo brinco se necessário
      if (!animal_id) {
        const [animal] = await pool.query(
          "SELECT id, status FROM animais WHERE brinco = ?",
          [brinco],
        );

        if (!animal.length) {
          return res.status(404).json({
            status: false,
            message: "Animal não encontrado pelo brinco",
          });
        }

        if (["Morto", "Abatido"].includes(animal[0].status)) {
          return res.status(400).json({
            status: false,
            message:
              "Não é possível registrar pesagem para animais Mortos ou Abatidos",
          });
        }

        animal_id = animal[0].id;
      } else {
        const [animal] = await pool.query(
          "SELECT status FROM animais WHERE id = ?",
          [animal_id],
        );

        if (!animal.length) {
          return res
            .status(404)
            .json({ status: false, message: "Animal não encontrado" });
        }

        if (["Morto", "Abatido"].includes(animal[0].status)) {
          return res.status(400).json({
            status: false,
            message:
              "Não é possível registrar pesagem para animais Mortos ou Abatidos",
          });
        }
      }

      // ===== BUSCAR PESO ANTERIOR (COM REGRA DA PRIMEIRA PESAGEM) =====
      const [ultimo] = await pool.query(
        `SELECT peso_recente
         FROM pesagens
         WHERE animal_id = ?
         ORDER BY data_pesagem DESC, id DESC
         LIMIT 1`,
        [animal_id],
      );

      let peso_anterior = null;

      if (ultimo.length) {
        // Já existe pesagem anterior
        peso_anterior = ultimo[0].peso_recente;
      } else {
        // Primeira pesagem → usar peso_atual da tabela animais
        const [animalPeso] = await pool.query(
          `SELECT peso_atual FROM animais WHERE id = ?`,
          [animal_id],
        );

        peso_anterior = animalPeso.length
          ? animalPeso[0].peso_atual
          : null;
      }
      // ===============================================================

      // Próxima pesagem
      let proxima = dataproxima_pesagem
        ? new Date(dataproxima_pesagem)
        : new Date(data_pesagem);

      if (!dataproxima_pesagem) proxima.setMonth(proxima.getMonth() + 2);

      await pool.query(
        `INSERT INTO pesagens 
         (animal_id, brinco, data_pesagem, dataproxima_pesagem, peso_anterior, peso_recente, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          animal_id,
          brinco,
          data_pesagem,
          proxima,
          peso_anterior,
          peso_recente,
          observacoes || null,
        ],
      );

      res.json({ status: true, message: "Pesagem cadastrada com sucesso!" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar pesagem" });
    }
  },
);

//PUT /pesagens/:id → atualizar
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const { id } = req.params;
    let {
      animal_id,
      brinco,
      data_pesagem,
      dataproxima_pesagem,
      peso_recente,
      observacoes,
    } = req.body;

    try {
      // Resolver animal_id pelo brinco
      if (!animal_id && brinco) {
        const [animal] = await pool.query(
          "SELECT id, status FROM animais WHERE brinco = ?",
          [brinco],
        );

        if (!animal.length) {
          return res.status(404).json({
            status: false,
            message: "Animal não encontrado pelo brinco",
          });
        }

        if (["Morto", "Abatido"].includes(animal[0].status)) {
          return res.status(400).json({
            status: false,
            message:
              "Não é possível atualizar pesagem de animais Mortos ou Abatidos",
          });
        }

        animal_id = animal[0].id;
      } else if (animal_id) {
        const [animal] = await pool.query(
          "SELECT status FROM animais WHERE id = ?",
          [animal_id],
        );

        if (!animal.length)
          return res
            .status(404)
            .json({ status: false, message: "Animal não encontrado" });

        if (["Morto", "Abatido"].includes(animal[0].status)) {
          return res.status(400).json({
            status: false,
            message:
              "Não é possível atualizar pesagem de animais Mortos ou Abatidos",
          });
        }
      }

      // Peso anterior
      const [ultimo] = await pool.query(
        `SELECT peso_recente
         FROM pesagens
         WHERE animal_id = ? AND id <> ?
         ORDER BY data_pesagem DESC, id DESC
         LIMIT 1`,
        [animal_id, id],
      );

      const peso_anterior = ultimo.length ? ultimo[0].peso_recente : null;

      let proxima = dataproxima_pesagem
        ? new Date(dataproxima_pesagem)
        : new Date(data_pesagem);

      if (!dataproxima_pesagem) proxima.setMonth(proxima.getMonth() + 2);

      const [result] = await pool.query(
        `UPDATE pesagens 
         SET animal_id = ?, brinco = ?, data_pesagem = ?, dataproxima_pesagem = ?, 
             peso_anterior = ?, peso_recente = ?, observacoes = ?
         WHERE id = ?`,
        [
          animal_id,
          brinco,
          data_pesagem,
          proxima,
          peso_anterior,
          peso_recente,
          observacoes || null,
          id,
        ],
      );

      if (!result.affectedRows)
        return res
          .status(404)
          .json({ status: false, message: "Pesagem não encontrada" });

      res.json({ status: true, message: "Pesagem atualizada com sucesso!" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar pesagem" });
    }
  },
);

//DELETE /pesagens/:id
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query("DELETE FROM pesagens WHERE id = ?", [
        req.params.id,
      ]);

      if (!result.affectedRows) {
        return res.status(404).json({
          status: false,
          message: "Pesagem não encontrada",
        });
      }

      res.json({
        status: true,
        message: "Pesagem removida com sucesso!",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        status: false,
        message: "Erro ao remover pesagem",
      });
    }
  },
);

module.exports = router;