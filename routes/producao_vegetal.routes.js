const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

const UNIDADES_VALIDAS = ["kg", "toneladas", "sacos", "caixas"];

// =============================
// FORMATAR DATA
// =============================
function formatarData(data) {
  if (!data) return null;

  if (typeof data === "string" && data.includes("/")) {
    const [dia, mes, ano] = data.split("/");
    const formatada = `${ano}-${mes}-${dia}`;
    return isNaN(Date.parse(formatada)) ? null : formatada;
  }

  return isNaN(Date.parse(data)) ? null : data;
}

// =============================
// ATUALIZAR ESTADO DA SAFRA
// =============================
async function atualizarEstadoSafra(safra_id) {
  const [total] = await pool.query(
    "SELECT COUNT(*) AS total FROM plantacoes WHERE safra_id = ?",
    [safra_id],
  );

  const [colhidas] = await pool.query(
    "SELECT COUNT(*) AS total FROM plantacoes WHERE safra_id = ? AND estado = 'colhida'",
    [safra_id],
  );

  if (total[0].total > 0 && total[0].total === colhidas[0].total) {
    await pool.query("UPDATE safras SET estado = 'colhida' WHERE id = ?", [
      safra_id,
    ]);
  } else {
    await pool.query("UPDATE safras SET estado = 'ativa' WHERE id = ?", [
      safra_id,
    ]);
  }
}

// =============================
// LISTAR PRODUÇÕES
// =============================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT pv.*, s.nome AS safra_nome, p.nome AS plantacao_nome
        FROM producao_vegetal pv
        LEFT JOIN safras s ON pv.safra_id = s.id
        LEFT JOIN plantacoes p ON pv.plantacao_id = p.id
        ORDER BY pv.data_colheita DESC
      `);

      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar produção vegetal" });
    }
  },
);

// =============================
// OBTER POR ID
// =============================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM producao_vegetal WHERE id = ?",
        [req.params.id],
      );

      if (rows.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar produção vegetal" });
    }
  },
);

// =============================
// CRIAR PRODUÇÃO
// =============================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        safra_id,
        plantacao_id,
        quantidade,
        unidade,
        data_colheita,
        qualidade,
        destino,
      } = req.body;

      // normalizar ids
      const safraId = Number(safra_id);
      const plantacaoId = Number(plantacao_id);

      if (!safraId || !plantacaoId || !quantidade || !unidade)
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios não informados",
        });

      if (isNaN(quantidade) || Number(quantidade) <= 0)
        return res
          .status(400)
          .json({ status: false, message: "Quantidade inválida" });

      if (!UNIDADES_VALIDAS.includes(unidade))
        return res
          .status(400)
          .json({ status: false, message: "Unidade inválida" });

      const dataFormatada = formatarData(data_colheita);
      if (!dataFormatada)
        return res
          .status(400)
          .json({ status: false, message: "Data inválida" });

      // VALIDAR SAFRA
      const [safra] = await pool.query("SELECT id FROM safras WHERE id = ?", [
        safraId,
      ]);

      if (safra.length === 0)
        return res
          .status(400)
          .json({ status: false, message: "Safra não existe" });

      // VALIDAR PLANTAÇÃO
      const [plantacao] = await pool.query(
        "SELECT id, safra_id FROM plantacoes WHERE id = ?",
        [plantacaoId],
      );

      if (plantacao.length === 0)
        return res
          .status(400)
          .json({ status: false, message: "Plantação não existe" });

      if (Number(plantacao[0].safra_id) !== Number(safraId)) {
        return res.status(400).json({
          status: false,
          message: "Plantação não pertence à safra informada",
        });
      }

      const [result] = await pool.query(
        `
          INSERT INTO producao_vegetal
          (safra_id, plantacao_id, quantidade, unidade, data_colheita, qualidade, destino)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          safraId,
          plantacaoId,
          quantidade,
          unidade,
          dataFormatada,
          qualidade || null,
          destino || null,
        ],
      );

      await pool.query(
        "UPDATE plantacoes SET estado='colhida', data_fim=? WHERE id=?",
        [dataFormatada, plantacaoId],
      );

      await atualizarEstadoSafra(safraId);

      res.status(201).json({
        status: true,
        message: "Produção vegetal registrada com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao registrar produção vegetal" });
    }
  },
);

// =============================
// ATUALIZAR PRODUÇÃO
// =============================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        safra_id,
        plantacao_id,
        quantidade,
        unidade,
        data_colheita,
        qualidade,
        destino,
      } = req.body;

      const safraId = Number(safra_id);
      const plantacaoId = Number(plantacao_id);

      if (!safraId || !plantacaoId || !quantidade || !unidade)
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios não informados",
        });

      const dataFormatada = formatarData(data_colheita);
      if (!dataFormatada)
        return res
          .status(400)
          .json({ status: false, message: "Data inválida" });

      // validar se a plantação pertence à safra
      const [plantacao] = await pool.query(
        "SELECT safra_id FROM plantacoes WHERE id=?",
        [plantacaoId],
      );

      if (plantacao.length === 0)
        return res
          .status(400)
          .json({ status: false, message: "Plantação não existe" });

      if (Number(plantacao[0].safra_id) !== Number(safraId))
        return res.status(400).json({
          status: false,
          message: "Plantação não pertence à safra informada",
        });

      const [antiga] = await pool.query(
        "SELECT plantacao_id FROM producao_vegetal WHERE id=?",
        [req.params.id],
      );

      if (antiga.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });

      const plantacaoAntiga = antiga[0].plantacao_id;

      await pool.query(
        `
          UPDATE producao_vegetal
          SET safra_id=?, plantacao_id=?, quantidade=?, unidade=?, data_colheita=?, qualidade=?, destino=?
          WHERE id=?
        `,
        [
          safraId,
          plantacaoId,
          quantidade,
          unidade,
          dataFormatada,
          qualidade || null,
          destino || null,
          req.params.id,
        ],
      );

      await pool.query(
        "UPDATE plantacoes SET estado='colhida', data_fim=? WHERE id=?",
        [dataFormatada, plantacaoId],
      );

      if (Number(plantacaoAntiga) !== Number(plantacaoId)) {
        const [restantes] = await pool.query(
          "SELECT COUNT(*) AS total FROM producao_vegetal WHERE plantacao_id=?",
          [plantacaoAntiga],
        );

        if (restantes[0].total === 0) {
          await pool.query(
            "UPDATE plantacoes SET estado='ativa', data_fim=NULL WHERE id=?",
            [plantacaoAntiga],
          );
        }
      }

      await atualizarEstadoSafra(safraId);

      res.json({
        status: true,
        message: "Produção vegetal atualizada com sucesso",
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar produção vegetal" });
    }
  },
);

// =============================
// EXCLUIR PRODUÇÃO
// =============================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT plantacao_id FROM producao_vegetal WHERE id=?",
        [req.params.id],
      );

      if (rows.length === 0)
        return res
          .status(404)
          .json({ status: false, message: "Registro não encontrado" });

      const plantacao_id = rows[0].plantacao_id;

      await pool.query("DELETE FROM producao_vegetal WHERE id=?", [
        req.params.id,
      ]);

      const [restantes] = await pool.query(
        "SELECT COUNT(*) AS total FROM producao_vegetal WHERE plantacao_id=?",
        [plantacao_id],
      );

      if (restantes[0].total === 0) {
        await pool.query(
          "UPDATE plantacoes SET estado='ativa', data_fim=NULL WHERE id=?",
          [plantacao_id],
        );
      }

      const [plantacao] = await pool.query(
        "SELECT safra_id FROM plantacoes WHERE id=?",
        [plantacao_id],
      );

      await atualizarEstadoSafra(plantacao[0].safra_id);

      res.json({
        status: true,
        message: "Produção vegetal excluída com sucesso",
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir produção vegetal" });
    }
  },
);

module.exports = router;
