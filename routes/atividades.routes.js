const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================
// 🔹 LISTAR ATIVIDADES DO UTILIZADOR
// ============================
router.get(
  "/",
  autenticarToken,
  autorizartipo(
    "admin",
    "gerente",
    "capatazagri",
    "capatazpec",
    "recepcionista",
  ),
  async (req, res) => {
    try {
      const usuarioId = req.usuario.id;

      const [rows] = await pool.query(
        `
        SELECT 
          a.id,
          a.titulo,
          a.descricao,
          a.status,
          a.data_criacao,
          a.data_limite,
          a.usuario_id,
          a.criado_por,
          u.nome AS responsavel_nome,
          c.nome AS criador_nome,
          CASE
            WHEN a.status = 'pendente'
             AND a.data_limite IS NOT NULL
             AND a.data_limite <= CURDATE() + INTERVAL 3 DAY
            THEN 1
            ELSE 0
          END AS aviso
        FROM atividades a
        JOIN usuarios u ON u.id = a.usuario_id
        JOIN usuarios c ON c.id = a.criado_por
        WHERE a.usuario_id = ?
           OR a.criado_por = ?
        ORDER BY a.data_criacao DESC
        `,
        [usuarioId, usuarioId],
      );

      res.json({
        success: true,
        atividades: rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar atividades.",
      });
    }
  },
);

// ============================
// 🔹 BUSCAR ATIVIDADE POR ID
// ============================
router.get(
  "/:id",
  autenticarToken,
  autorizartipo(
    "admin",
    "gerente",
    "capatazagri",
    "capatazpec",
    "recepcionista",
  ),
  async (req, res) => {
    try {
      const { id } = req.params;
      const usuarioId = req.usuario.id;

      const [rows] = await pool.query(
        `
        SELECT 
          a.id,
          a.titulo,
          a.descricao,
          a.status,
          a.data_criacao,
          a.data_limite,
          a.usuario_id,
          a.criado_por,
          u.nome AS responsavel_nome,
          c.nome AS criador_nome
        FROM atividades a
        JOIN usuarios u ON u.id = a.usuario_id
        JOIN usuarios c ON c.id = a.criado_por
        WHERE a.id = ?
          AND (a.usuario_id = ? OR a.criado_por = ?)
        `,
        [id, usuarioId, usuarioId],
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Atividade não encontrada.",
        });
      }

      res.json({
        success: true,
        atividade: rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar atividade.",
      });
    }
  },
);

// ============================
// 🔹 ADICIONAR ATIVIDADE
// ============================
router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { titulo, descricao, usuario_id, data_limite } = req.body;

      if (!titulo || !usuario_id) {
        return res.status(400).json({
          success: false,
          message: "Título e usuário responsável são obrigatórios.",
        });
      }

      const criado_por = req.usuario.id;

      const [result] = await pool.query(
        `
        INSERT INTO atividades
        (titulo, descricao, usuario_id, criado_por, status, data_limite)
        VALUES (?, ?, ?, ?, 'pendente', ?)
        `,
        [titulo, descricao || "", usuario_id, criado_por, data_limite || null],
      );

      res.json({
        success: true,
        message: "Atividade criada com sucesso!",
        atividadeId: result.insertId,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Erro ao criar atividade.",
      });
    }
  },
);

// ============================
// 🔹 ATUALIZAR ATIVIDADE
// ============================
router.put(
  "/:id",
  autenticarToken,
  autorizartipo(
    "admin",
    "gerente",
    "capatazagri",
    "capatazpec",
    "recepcionista",
  ),
  async (req, res) => {
    try {
      const { status, data_limite, usuario_id } = req.body;
      const { id } = req.params;

      if (status && !["pendente", "concluida"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status inválido.",
        });
      }

      let query = `
        UPDATE atividades
           SET status = COALESCE(?, status),
               data_limite = COALESCE(?, data_limite)
      `;

      const params = [status || null, data_limite || null];

      // apenas admin/gerente podem mudar responsável
      if (usuario_id && ["admin", "gerente"].includes(req.usuario.tipo)) {
        query += `, usuario_id = ?`;
        params.push(usuario_id);
      }

      // funcionário só pode alterar se for o responsável
      query += `
        WHERE id = ?
          AND (
            usuario_id = ?
            OR (
              criado_por = ?
              AND ? IN ('admin','gerente')
            )
          )
      `;

      params.push(id, req.usuario.id, req.usuario.id, req.usuario.tipo);

      const [result] = await pool.query(query, params);

      if (result.affectedRows === 0) {
        return res.status(403).json({
          success: false,
          message: "Sem permissão para atualizar esta atividade.",
        });
      }

      res.json({
        success: true,
        message: "Atividade atualizada com sucesso!",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Erro ao atualizar atividade.",
      });
    }
  },
);

// ============================
// 🔹 DELETAR ATIVIDADE
// ============================
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [result] = await pool.query(
        `
        DELETE FROM atividades
        WHERE id = ?
          AND (usuario_id = ? OR criado_por = ?)
        `,
        [id, req.usuario.id, req.usuario.id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Atividade não encontrada ou sem permissão.",
        });
      }

      res.json({
        success: true,
        message: "Atividade deletada com sucesso!",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Erro ao deletar atividade.",
      });
    }
  },
);

module.exports = router;
