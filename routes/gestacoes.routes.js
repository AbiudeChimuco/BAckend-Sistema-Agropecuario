const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================
// LISTAR TODAS GESTAÇÕES (APENAS ANIMAIS VIVOS)
// ============================
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT g.*, 
                mae.nome AS animal_nome, 
                mae.brinco AS mae_brinco,
                pai.nome AS pai_nome
         FROM gestacoes g
         JOIN animais mae ON g.animal_id = mae.id
         LEFT JOIN animais pai ON g.pai_id = pai.id
         WHERE mae.status NOT IN ('Morto','Abatido')
         ORDER BY g.created_at DESC`,
      );
      res.json({ status: true, data: rows });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar gestações" });
    }
  },
);

// ============================
// FÊMEAS GESTANTES VIVAS
// ============================
router.get(
  "/femeas-gestantes",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT DISTINCT 
          a.id, 
          a.nome, 
          a.brinco
        FROM gestacoes g
        INNER JOIN animais a ON a.id = g.animal_id
        WHERE LOWER(g.estado) = 'ativa'
          AND LOWER(a.sexo) IN ('fêmea','femea','f')
          AND a.status NOT IN ('Morto','Abatido')
      `);
      res.json({ status: true, data: rows });
    } catch (err) {
      console.error("Erro MySQL:", err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar fêmeas gestantes" });
    }
  },
);

// ============================
// CADASTRAR GESTAÇÃO COM REGRAS
// ============================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const {
      animal_id,
      pai_id,
      data_inseminacao,
      data_prevista_parto,
      estado,
      observacoes,
    } = req.body;

    if (!animal_id || !data_inseminacao || !data_prevista_parto) {
      return res.status(400).json({
        status: false,
        message:
          "Campos obrigatórios: animal_id, data_inseminacao, data_prevista_parto",
      });
    }

    try {
      // ✅ Verificar se animal existe, está vivo e é fêmea
      const [animal] = await pool.query(
        "SELECT status, sexo FROM animais WHERE id = ?",
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
            "Não é possível cadastrar gestação para fêmeas mortas ou abatidas",
        });
      }

      if (!["fêmea", "femea", "f"].includes(animal[0].sexo?.toLowerCase())) {
        return res.status(400).json({
          status: false,
          message: "Apenas fêmeas podem ter gestação.",
        });
      }

      // 🚨 Verificar gestação ativa existente
      const [ativas] = await pool.query(
        `SELECT id FROM gestacoes 
         WHERE animal_id = ? 
         AND LOWER(estado) = 'ativa'`,
        [animal_id],
      );

      if (ativas.length > 0) {
        return res.status(400).json({
          status: false,
          message: "Fêmea já possui gestação ativa.",
        });
      }

      // 🧠 Verificar intervalo de 3 meses desde último parto
      const [ultimas] = await pool.query(
        `SELECT data_prevista_parto 
         FROM gestacoes 
         WHERE animal_id = ? 
           AND LOWER(estado) = 'finalizada'
         ORDER BY data_prevista_parto DESC 
         LIMIT 1`,
        [animal_id],
      );

      if (ultimas.length > 0) {
        const dataLimite = new Date(ultimas[0].data_prevista_parto);
        dataLimite.setMonth(dataLimite.getMonth() + 3);

        if (new Date(data_inseminacao) < dataLimite) {
          return res.status(400).json({
            status: false,
            message:
              "Não é possível cadastrar nova gestação antes de 3 meses do último parto.",
          });
        }
      }

      // ✅ Inserir gestação
      const [result] = await pool.query(
        `INSERT INTO gestacoes 
         (animal_id, pai_id, data_inseminacao, data_prevista_parto, estado, observacoes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          animal_id,
          pai_id ?? null,
          data_inseminacao,
          data_prevista_parto,
          (estado || "ativa").toLowerCase(),
          observacoes ?? null,
        ],
      );

      res.json({
        status: true,
        message: "Gestação cadastrada com sucesso!",
        id: result.insertId,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar gestação" });
    }
  },
);

// ============================
// ATUALIZAR GESTAÇÃO
// ============================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    const { id } = req.params;
    const {
      animal_id,
      pai_id,
      data_inseminacao,
      data_prevista_parto,
      estado,
      observacoes,
    } = req.body;

    try {
      // ✅ Verificar se a fêmea está viva e é fêmea
      if (animal_id !== undefined) {
        const [animal] = await pool.query(
          "SELECT status, sexo FROM animais WHERE id = ?",
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
              "Não é possível atualizar gestação para fêmeas mortas ou abatidas",
          });
        }

        if (!["fêmea", "femea", "f"].includes(animal[0].sexo?.toLowerCase())) {
          return res.status(400).json({
            status: false,
            message: "Apenas fêmeas podem ter gestação.",
          });
        }
      }

      // 🚨 Evitar duas gestações ativas
      if (estado && animal_id) {
        if (estado.toLowerCase() === "ativa") {
          const [ativas] = await pool.query(
            `SELECT id FROM gestacoes 
             WHERE animal_id = ? 
               AND LOWER(estado) = 'ativa'
               AND id <> ?`,
            [animal_id, id],
          );

          if (ativas.length > 0) {
            return res.status(400).json({
              status: false,
              message: "A fêmea já possui outra gestação ativa.",
            });
          }
        }
      }

      const updates = [];
      const values = [];

      if (animal_id !== undefined) {
        updates.push("animal_id = ?");
        values.push(animal_id);
      }
      if (pai_id !== undefined) {
        updates.push("pai_id = ?");
        values.push(pai_id);
      }
      if (data_inseminacao !== undefined) {
        updates.push("data_inseminacao = ?");
        values.push(data_inseminacao);
      }
      if (data_prevista_parto !== undefined) {
        updates.push("data_prevista_parto = ?");
        values.push(data_prevista_parto);
      }
      if (estado !== undefined) {
        updates.push("estado = ?");
        values.push(estado.toLowerCase());
      }
      if (observacoes !== undefined) {
        updates.push("observacoes = ?");
        values.push(observacoes);
      }

      updates.push("updated_at = NOW()");
      values.push(id);

      const [result] = await pool.query(
        `UPDATE gestacoes SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Gestação não encontrada" });
      }

      res.json({
        status: true,
        message: "Gestação atualizada com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar gestação" });
    }
  },
);

// ============================
// REMOVER GESTAÇÃO
// ============================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await pool.query("DELETE FROM gestacoes WHERE id = ?", [
        id,
      ]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ status: false, message: "Gestação não encontrada" });
      }

      res.json({
        status: true,
        message: "Gestação removida com sucesso!",
        id,
      });
    } catch (err) {
      console.error("Erro MySQL:", err.sqlMessage || err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao remover gestação" });
    }
  },
);

// ============================
// LISTAR FÊMEAS VIVAS
// ============================
router.get(
  "/animais/femeas",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT id, nome, brinco
        FROM animais
        WHERE LOWER(sexo) IN ('fêmea','femea','f')
          AND status NOT IN ('Morto','Abatido')
        ORDER BY nome ASC
      `);

      res.json({ status: true, data: rows });
    } catch (err) {
      console.error("Erro MySQL:", err);
      res.status(500).json({ status: false, message: "Erro ao buscar fêmeas" });
    }
  },
);

// ============================
// FÊMEAS DISPONÍVEIS
// ============================
router.get(
  "/animais/femeas-disponiveis",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT a.id, a.nome, a.brinco
        FROM animais a
        WHERE LOWER(a.sexo) IN ('fêmea','femea','f')
          AND a.status NOT IN ('Morto','Abatido')
          AND a.id NOT IN (
            SELECT animal_id
            FROM gestacoes
            WHERE LOWER(estado) = 'ativa'
          )
          AND (
            a.id NOT IN (
              SELECT animal_id
              FROM gestacoes
              WHERE LOWER(estado) = 'finalizada'
                AND DATE_ADD(data_prevista_parto, INTERVAL 3 MONTH) > NOW()
            )
            OR a.id IN (
              SELECT animal_id
              FROM gestacoes
              WHERE LOWER(estado) = 'finalizada'
                AND DATE_ADD(data_prevista_parto, INTERVAL 3 MONTH) <= NOW()
            )
          )
        ORDER BY a.nome ASC
      `);

      res.json({ status: true, data: rows });
    } catch (err) {
      console.error("Erro MySQL:", err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar fêmeas disponíveis" });
    }
  },
);

module.exports = router;
