    // routes/perfil.routes.js
    const express = require("express");
    const pool = require("../config/db");
    const bcrypt = require("bcryptjs");
    const { autenticarToken } = require("../middleware/auth.middleware");

    const router = express.Router();

    // Função auxiliar
    const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // ============================
    // 🔹 VER PERFIL DO USUÁRIO
    // ============================
    router.get("/", autenticarToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
        "SELECT u.id, u.email, u.tipo, f.nome, f.genero, f.telefone FROM usuarios u JOIN funcionarios f ON f.id = u.funcionario_id WHERE u.id = ?",
        [req.usuario.id],
        );

        if (!rows[0]) {
        return res
            .status(404)
            .json({ success: false, message: "Usuário não encontrado." });
        }

        res.json({ success: true, perfil: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Erro ao buscar perfil." });
    }
    });

    // ============================
    // 🔹 ATUALIZAR NOME E EMAIL
    // ============================
    router.put("/", autenticarToken, async (req, res) => {
    try {
        const { nome, email } = req.body;

        if (!nome || !email) {
        return res
            .status(400)
            .json({ success: false, message: "Preencha todos os campos." });
        }

        if (!validarEmail(email)) {
        return res
            .status(400)
            .json({ success: false, message: "Email inválido." });
        }

        // Verificar se o email já está sendo usado por outro usuário
        const [emailExists] = await pool.query(
        "SELECT id FROM usuarios WHERE email = ? AND id != ?",
        [email, req.usuario.id],
        );

        if (emailExists.length > 0) {
        return res
            .status(400)
            .json({ success: false, message: "Email já está em uso." });
        }

        await pool.query(
        `UPDATE usuarios u 
        JOIN funcionarios f ON f.id = u.funcionario_id
        SET u.email = ?, f.nome = ?
        WHERE u.id = ?`,
        [email, nome, req.usuario.id],
        );

        res.json({ success: true, message: "Perfil atualizado com sucesso!" });
    } catch (err) {
        console.error(err);
        res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar perfil." });
    }
    });

    // ============================
    // 🔹 ALTERAR SENHA
    // ============================
    router.put("/senha", autenticarToken, async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
        return res
            .status(400)
            .json({ success: false, message: "Preencha todos os campos." });
        }

        if (nova_senha.length < 6) {
        return res
            .status(400)
            .json({
            success: false,
            message: "A nova senha deve ter no mínimo 6 caracteres.",
            });
        }

        // Buscar senha atual
        const [rows] = await pool.query("SELECT senha FROM usuarios WHERE id = ?", [
        req.usuario.id,
        ]);

        if (rows.length === 0) {
        return res
            .status(404)
            .json({ success: false, message: "Usuário não encontrado." });
        }

        const senhaValida = await bcrypt.compare(senha_atual, rows[0].senha);
        if (!senhaValida) {
        return res
            .status(400)
            .json({ success: false, message: "Senha atual incorreta." });
        }

        const hash = await bcrypt.hash(nova_senha, 10);
        await pool.query("UPDATE usuarios SET senha = ? WHERE id = ?", [
        hash,
        req.usuario.id,
        ]);

        res.json({ success: true, message: "Senha atualizada com sucesso!" });
    } catch (err) {
        console.error(err);
        res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar senha." });
    }
    });

    module.exports = router;
