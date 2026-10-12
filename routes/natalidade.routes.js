const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

//GET /natalidade → listar todas

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT n.*,
               mae.nome   AS mae_nome,
               mae.brinco AS mae_brinco
        FROM natalidade n
        JOIN animais mae ON n.mae_id = mae.id
        ORDER BY n.created_at DESC
      `);

      res.json({ status: true, data: rows });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar natalidades",
      });
    }
  }
);

// cadastrar natalidade (POR BRINCO)

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const {
      brinco_mae,
      data_parto,
      total_nascidos,
      vivos,
      mortos,
      observacoes,
    } = req.body;

    if (!brinco_mae || !data_parto) {
      return res.status(400).json({
        status: false,
        message: "Campos obrigatórios: brinco_mae, data_parto",
      });
    }

    if ((vivos ?? 0) + (mortos ?? 0) > (total_nascidos ?? 1)) {
      return res.status(400).json({
        status: false,
        message: "Vivos + mortos não pode ser maior que o total",
      });
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      /*  Buscar fêmea pelo brinco */
      const [[mae]] = await conn.query(
        `SELECT id, sexo FROM animais WHERE brinco = ?`,
        [brinco_mae]
      );

      if (!mae || !["fêmea", "femea", "f"].includes(mae.sexo.toLowerCase())) {
        await conn.rollback();
        return res.status(400).json({
          status: false,
          message: "Brinco inválido ou animal não é fêmea",
        });
      }

      /* Buscar gestação ATIVA */
      const [[gestacao]] = await conn.query(
        `
        SELECT id 
        FROM gestacoes
        WHERE animal_id = ?
          AND LOWER(estado) = 'ativa'
        `,
        [mae.id]
      );

      if (!gestacao) {
        await conn.rollback();
        return res.status(400).json({
          status: false,
          message: "Fêmea não possui gestação ativa",
        });
      }

      /*  Impedir dupla natalidade */
      const [existe] = await conn.query(
        `SELECT id FROM natalidade WHERE gestacao_id = ?`,
        [gestacao.id]
      );

      if (existe.length > 0) {
        await conn.rollback();
        return res.status(400).json({
          status: false,
          message: "Já existe natalidade para esta gestação",
        });
      }

      /*  Inserir natalidade */
      const [result] = await conn.query(
        `
        INSERT INTO natalidade
        (gestacao_id, mae_id, data_parto, total_nascidos, vivos, mortos, observacoes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          gestacao.id,
          mae.id,
          data_parto,
          total_nascidos ?? 1,
          vivos ?? total_nascidos ?? 1,
          mortos ?? 0,
          observacoes ?? null,
        ]
      );

      /* 5️⃣ Finalizar gestação */
      await conn.query(
        `
        UPDATE gestacoes
        SET estado = 'finalizada', updated_at = NOW()
        WHERE id = ?
        `,
        [gestacao.id]
      );

      await conn.commit();

      res.json({
        status: true,
        message: "Natalidade registada com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      await conn.rollback();
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao registar natalidade",
      });
    } finally {
      conn.release();
    }
  }
);

//atualizar

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const { id } = req.params;
    const { data_parto, total_nascidos, vivos, mortos, observacoes } = req.body;

    try {
      const updates = [];
      const values = [];

      if (data_parto !== undefined) {
        updates.push("data_parto = ?");
        values.push(data_parto);
      }
      if (total_nascidos !== undefined) {
        updates.push("total_nascidos = ?");
        values.push(total_nascidos);
      }
      if (vivos !== undefined) {
        updates.push("vivos = ?");
        values.push(vivos);
      }
      if (mortos !== undefined) {
        updates.push("mortos = ?");
        values.push(mortos);
      }
      if (observacoes !== undefined) {
        updates.push("observacoes = ?");
        values.push(observacoes);
      }

      if (!updates.length) {
        return res.status(400).json({
          status: false,
          message: "Nenhum campo para atualizar",
        });
      }

      updates.push("updated_at = NOW()");
      values.push(id);

      const [result] = await pool.query(
        `UPDATE natalidade SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          status: false,
          message: "Natalidade não encontrada",
        });
      }

      res.json({
        status: true,
        message: "Natalidade atualizada com sucesso!",
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao atualizar natalidade",
      });
    }
  }
);

//DELETE natalidade/:id

router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    try {
      const [result] = await pool.query(`DELETE FROM natalidade WHERE id = ?`, [
        req.params.id,
      ]);

      if (!result.affectedRows) {
        return res.status(404).json({
          status: false,
          message: "Natalidade não encontrada",
        });
      }

      res.json({
        status: true,
        message: "Natalidade removida com sucesso!",
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res.status(500).json({
        status: false,
        message: "Erro ao remover natalidade",
      });
    }
  }
);

module.exports = router;
