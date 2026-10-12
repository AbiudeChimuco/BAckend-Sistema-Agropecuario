const express = require("express");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================
// UTILITÁRIOS
// ============================

// Formata datas para YYYY-MM-DD
function formatarData(data) {
  if (!data) return null;
  if (typeof data === "string" && data.includes("/")) {
    const [dia, mes, ano] = data.split("/");
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof data === "string" && data.includes("-")) return data.split("T")[0];
  if (data instanceof Date) return data.toISOString().split("T")[0];
  return data;
}

// Função para registrar histórico
async function registrarHistorico(
  usuario,
  acao,
  modulo,
  descricao,
  registroId = null,
) {
  try {
    const sql = `
      INSERT INTO historico_atividades
        (usuario_id, acao, modulo, descricao, registro_afetado_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [usuario.id, acao, modulo, descricao, registroId];
    await pool.query(sql, values);
  } catch (error) {
    console.error("Erro ao registrar histórico:", error);
  }
}

// ============================
// CABEÇALHO PDF
// ============================

function gerarCabecalho(doc, titulo, nomeUsuario) {
  const logoPath = path.join(__dirname, "../public/images/logo.jpg");
  doc.rect(0, 0, doc.page.width, 100).fill("#e8f5e9").fillColor("black");

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 15, { width: 70 });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#2e7d32")
    .text("Fazenda MNR", { align: "center" });

  doc
    .moveDown(0.3)
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("black")
    .text(titulo, { align: "center" });

  doc.moveTo(50, 110).lineTo(550, 110).strokeColor("#2e7d32").stroke();

  const dataAtual = new Date().toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("black")
    .text(`Emitido por: ${nomeUsuario || ""}`, 50, 115, { align: "left" })
    .text(`Emitido em: ${dataAtual}`, -50, 115, { align: "right" });

  doc.moveDown(2);
}

// ============================
// TABELA PDF
// ============================

function gerarTabela(
  doc,
  headers,
  rows,
  startY = 140,
  titulo = "",
  columnWidths = [],
) {
  let y = startY;
  const tableX = 50;
  const tableWidth = 500;
  const rowHeight = 18;

  let widths = [];
  if (columnWidths && columnWidths.length === headers.length) {
    const total = columnWidths.reduce((a, b) => a + b, 0);
    widths = columnWidths.map((w) => (w / total) * tableWidth);
  } else {
    widths = headers.map(() => tableWidth / headers.length);
  }

  function desenharCabecalhoTabela(posY) {
    let x = tableX;
    doc.rect(tableX, posY, tableWidth, 20).fill("#2e7d32");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10);

    headers.forEach((h, i) => {
      doc.text(h.toUpperCase(), x + 5, posY + 5, {
        width: widths[i] - 10,
        align: "left",
      });
      x += widths[i];
    });

    return posY + 25;
  }

  y = desenharCabecalhoTabela(y);
  doc.fillColor("black").font("Helvetica").fontSize(9);

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > 730) {
      doc.addPage();
      gerarCabecalho(doc, titulo, "");
      y = desenharCabecalhoTabela(140);
      doc.fillColor("black").font("Helvetica").fontSize(9);
    }

    if (rowIndex % 2 === 0) {
      doc.rect(tableX, y, tableWidth, rowHeight).fill("#f5f5f5");
      doc.fillColor("black");
    }

    let x = tableX;
    headers.forEach((h, i) => {
      let text = row[h] !== undefined && row[h] !== null ? String(row[h]) : "";
      doc.text(text, x + 5, y + 4, { width: widths[i] - 10, ellipsis: true });

      doc
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x, y + rowHeight)
        .stroke();
      x += widths[i];
    });

    doc
      .moveTo(tableX, y + rowHeight)
      .lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor("#cccccc")
      .stroke();
    y += rowHeight;
  });

  doc
    .moveTo(tableX + tableWidth, startY)
    .lineTo(tableX + tableWidth, y)
    .strokeColor("#cccccc")
    .stroke();
}

// ============================
// RODAPÉ PDF
// ============================

function gerarRodape(doc, totalRegistros) {
  const totalPaginas = doc.bufferedPageRange().count;

  for (let i = 0; i < totalPaginas; i++) {
    doc.switchToPage(i);
    const yRodape = doc.page.height - 50;

    doc
      .moveTo(50, yRodape - 10)
      .lineTo(550, yRodape - 10)
      .strokeColor("gray")
      .stroke();

    let textoRodape = `Página ${i + 1} de ${totalPaginas}`;
    if (i + 1 === totalPaginas)
      textoRodape += `  |  Total de Registros: ${totalRegistros}`;

    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("gray")
      .text(textoRodape, 50, yRodape, { align: "center", width: 500 });

    if (i + 1 === totalPaginas) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("gray")
        .text(
          "Sistema KulongaAgro © Todos os direitos reservados",
          50,
          yRodape + 12,
          { align: "center", width: 500 },
        );
    }
  }
}

// ============================
// GERAR PDF
// ============================

async function gerarPDF(
  res,
  titulo,
  headers,
  query,
  params = [],
  nomeUsuario,
  columnWidths = [],
) {
  const [rows] = await pool.query(query, params);
  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  const nomeArquivo = encodeURIComponent(titulo);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${nomeArquivo}.pdf`);
  doc.pipe(res);

  gerarCabecalho(doc, titulo, nomeUsuario);
  gerarTabela(doc, headers, rows, 140, titulo, columnWidths);
  gerarRodape(doc, rows.length);

  doc.end();
}

// ============================
// ROTAS DE HISTÓRICO
// ============================

const modulos = [
  "animais",
  "pesagens",
  "natalidade",
  "mortalidade",
  "gestacoes",
  "producao-animal",
  "producao-vegetal",
];

modulos.forEach((modulo) => {
  router.get(
    `/historico/${modulo}`,
    autenticarToken,
    autorizartipo("admin", "gerente"),
    async (req, res) => {
      try {
        const { inicio, fim } = req.query;
        let where = "WHERE h.modulo = ?";
        const params = [modulo];

        if (inicio && fim) {
          where += " AND DATE(h.data_registo) BETWEEN ? AND ?";
          params.push(inicio, fim);
        }

        const [rows] = await pool.query(
          `
            SELECT h.id, h.usuario_id, u.nome AS usuario, h.acao, h.modulo, h.descricao, h.data_registo
            FROM historico_atividades h
            LEFT JOIN usuarios u ON u.id = h.usuario_id
            ${where}
            ORDER BY h.data_registo DESC
          `,
          params,
        );

        res.json({ status: true, modulo, total: rows.length, dados: rows });
      } catch (error) {
        console.error("Erro ao buscar histórico do módulo " + modulo, error);
        res.status(500).json({
          status: false,
          message: "Erro ao buscar histórico de atividades",
        });
      }
    },
  );

  // PDF do histórico
  router.get(
    `/historico/${modulo}/pdf`,
    autenticarToken,
    autorizartipo("admin", "gerente"),
    async (req, res) => {
      const { inicio, fim } = req.query;
      let where = "WHERE h.modulo = ?";
      const params = [modulo];

      if (inicio && fim) {
        where += " AND DATE(h.data_registo) BETWEEN ? AND ?";
        params.push(inicio, fim);
      }

      const query = `
        SELECT h.id, h.usuario_id, u.nome AS usuario, h.acao, h.modulo, h.descricao, h.data_registo
        FROM historico_atividades h
        LEFT JOIN usuarios u ON u.id = h.usuario_id
        ${where}
        ORDER BY h.data_registo DESC
      `;

      await gerarPDF(
        res,
        `Histórico de ${modulo}`,
        ["id", "usuario", "acao", "descricao", "data_registo"],
        query,
        params,
        req.usuario?.nome,
        [40, 120, 100, 180, 120],
      );
    },
  );
});

module.exports = router;
