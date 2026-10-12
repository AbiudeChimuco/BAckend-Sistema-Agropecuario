const express = require("express");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Qualquer usuário autenticado pode acessar
router.get("/me", autenticarToken, (req, res) => {
  res.json({
    status: true,
    message: "Usuário autenticado com sucesso!",
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      email: req.usuario.email,
      tipo: req.usuario.tipo,
    },
  });
});

// Apenas admins podem acessar
router.get("/admin", autenticarToken, autorizartipo("admin"), (req, res) => {
  res.json({ message: "Área restrita para administradores!" });
});

module.exports = router;
