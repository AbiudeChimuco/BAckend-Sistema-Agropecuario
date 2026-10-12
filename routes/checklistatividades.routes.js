const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

//CHECKLIST ATIVIDADES

router.get(
  "/:id/atividades",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri", "funcionario"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT a.*, f.nome AS nome_responsavel
         FROM checklist_atividades a
         LEFT JOIN funcionarios f ON a.id_responsavel = f.id
         WHERE a.id_checklist = ?`,
        [req.params.id],
      );
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao listar atividades do checklist",
      });
    }
  },
);

//cadastrar atividade

router.post(
  "/:id/atividades",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        titulo,
        descricao,
        setor,
        prioridade,
        status,
        id_responsavel,
        data_prevista,
        hora_prevista,
        data_conclusao,
        categoria,
        repeticao,
        duracao_estimada,
      } = req.body;

      if (!titulo || !setor || !data_prevista) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: titulo, setor, data_prevista",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO checklist_atividades
         (id_checklist, titulo, descricao, setor, prioridade, status, id_responsavel, data_prevista, hora_prevista, data_conclusao, categoria, repeticao, duracao_estimada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          titulo,
          descricao || null,
          setor,
          prioridade || "media",
          status || "pendente",
          id_responsavel || null,
          data_prevista,
          hora_prevista || null,
          data_conclusao || null,
          categoria || null,
          repeticao || "nenhuma",
          duracao_estimada || null,
        ],
      );

      res.status(201).json({
        status: true,
        id: result.insertId,
        message: "Atividade criada com sucesso",
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao cadastrar atividade" });
    }
  },
);

// atualizar atividade

router.put(
  "/atividades/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazagri"),
  async (req, res) => {
    try {
      const {
        titulo,
        descricao,
        setor,
        prioridade,
        status,
        id_responsavel,
        data_prevista,
        hora_prevista,
        data_conclusao,
        categoria,
        repeticao,
        duracao_estimada,
      } = req.body;

      const [result] = await pool.query(
        `UPDATE checklist_atividades
         SET titulo = ?, descricao = ?, setor = ?, prioridade = ?, status = ?, id_responsavel = ?, data_prevista = ?, hora_prevista = ?, data_conclusao = ?, categoria = ?, repeticao = ?, duracao_estimada = ?
         WHERE id = ?`,
        [
          titulo,
          descricao || null,
          setor,
          prioridade || "media",
          status || "pendente",
          id_responsavel || null,
          data_prevista,
          hora_prevista || null,
          data_conclusao || null,
          categoria || null,
          repeticao || "nenhuma",
          duracao_estimada || null,
          req.params.id,
        ],
      );

      if (!result.affectedRows) {
        return res
          .status(404)
          .json({ status: false, message: "Atividade não encontrada" });
      }

      res.json({ status: true, message: "Atividade atualizada com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao atualizar atividade" });
    }
  },
);

// excluir atividade

router.delete(
  "/atividades/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM checklist_atividades WHERE id = ?",
        [req.params.id],
      );

      if (!result.affectedRows) {
        return res
          .status(404)
          .json({ status: false, message: "Atividade não encontrada" });
      }

      res.json({ status: true, message: "Atividade excluída com sucesso" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao excluir atividade" });
    }
  },
);

module.exports = router;
