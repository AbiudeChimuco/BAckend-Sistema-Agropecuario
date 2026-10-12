const jwt = require("jsonwebtoken");

// ============================
// Middleware de autenticação
// ============================
function autenticarToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: false,
      message: "Token não fornecido. Faça login novamente.",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || "segredo", (err, usuario) => {
    if (err) {
      return res.status(403).json({
        status: false,
        message: "Token inválido ou expirado.",
      });
    }
    // normaliza tipo do usuário
    usuario.tipo = usuario.tipo?.toLowerCase().trim();
    req.usuario = usuario;
    console.log("Usuário autenticado:", usuario); // debug
    next();
  });
}

// ============================
// Middleware de autorização
// ============================
function autorizartipo(...tiposPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        status: false,
        message: "Usuário não autenticado.",
      });
    }

    const tipoUsuario = req.usuario.tipo;

    if (!tiposPermitidos.includes(tipoUsuario)) {
      return res.status(403).json({
        status: false,
        message: `Acesso negado. Tipo '${tipoUsuario}' não possui permissão. Permitidos: ${tiposPermitidos.join(
          ", "
        )}`,
      });
    }

    next();
  };
}

// ============================
// Helper para verificar admin
// ============================
function isAdmin(req) {
  return req.usuario?.tipo === "admin";
}

module.exports = { autenticarToken, autorizartipo, isAdmin };
