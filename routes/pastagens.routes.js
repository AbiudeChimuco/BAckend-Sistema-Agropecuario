const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Funções CRUD internas

// Listar todas as pastagens
const getPastagens = async () => {
  const [rows] = await pool.query("SELECT * FROM pastagens");
  return rows;
};

// Obter pastagem por ID
const getPastagemById = async (id) => {
  const [rows] = await pool.query("SELECT * FROM pastagens WHERE id = ?", [id]);
  return rows[0];
};

// Criar nova pastagem
const createPastagem = async (data) => {
  const { nome, area_ha, localizacao, estado, observacoes } = data;

  if (!nome || !area_ha) {
    throw new Error("Campos obrigatórios: nome e área");
  }

  const [result] = await pool.query(
    `INSERT INTO pastagens (nome, area_ha, localizacao, estado, observacoes)
     VALUES (?, ?, ?, ?, ?)`,
    [
      nome,
      area_ha,
      localizacao || null,
      estado || "disponivel",
      observacoes || null,
    ],
  );

  return {
    id: result.insertId,
    nome,
    area_ha,
    localizacao,
    estado,
    observacoes,
  };
};

// Atualizar pastagem
const updatePastagem = async (id, data) => {
  const { nome, area_ha, localizacao, estado, observacoes } = data;

  if (!nome || !area_ha) {
    throw new Error("Campos obrigatórios: nome e área");
  }

  await pool.query(
    `UPDATE pastagens SET nome = ?, area_ha = ?, localizacao = ?, estado = ?, observacoes = ? WHERE id = ?`,
    [
      nome,
      area_ha,
      localizacao || null,
      estado || "disponivel",
      observacoes || null,
      id,
    ],
  );

  return { id, nome, area_ha, localizacao, estado, observacoes };
};

// Deletar pastagem
const deletePastagem = async (id) => {
  await pool.query("DELETE FROM pastagens WHERE id = ?", [id]);
  return { id };
};

//  listar todas pastagens
router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "tecnico"),
  async (req, res) => {
    try {
      const data = await getPastagens();
      res.json({ status: true, data });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao listar pastagens" });
    }
  },
);

// GET pastagens
router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "tecnico"),
  async (req, res) => {
    try {
      const data = await getPastagemById(req.params.id);
      if (!data) {
        return res
          .status(404)
          .json({ status: false, message: "Pastagem não encontrada" });
      }
      res.json({ status: true, data });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao buscar pastagem" });
    }
  },
);

// criar pastagem
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const data = await createPastagem(req.body);
      res.status(201).json({
        status: true,
        message: "Pastagem cadastrada com sucesso",
        data,
      });
    } catch (error) {
      console.error(error);
      res.status(400).json({
        status: false,
        message: error.message || "Erro ao cadastrar pastagem",
      });
    }
  },
);

// PUT /pastagens/:id → atualizar pastagem
router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const data = await updatePastagem(req.params.id, req.body);
      res.json({
        status: true,
        message: "Pastagem atualizada com sucesso",
        data,
      });
    } catch (error) {
      console.error(error);
      res.status(400).json({
        status: false,
        message: error.message || "Erro ao atualizar pastagem",
      });
    }
  },
);

// DELETE /pastagens/:id → excluir pastagem
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin"),
  async (req, res) => {
    try {
      const data = await deletePastagem(req.params.id);
      res.json({
        status: true,
        message: "Pastagem deletada com sucesso",
        data,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao deletar pastagem" });
    }
  },
);

module.exports = router;
