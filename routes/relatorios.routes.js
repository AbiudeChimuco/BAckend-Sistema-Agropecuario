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
// TABELA PDF (com larguras por coluna)
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

    // Zebra
    if (rowIndex % 2 === 0) {
      doc.rect(tableX, y, tableWidth, rowHeight).fill("#f5f5f5");
      doc.fillColor("black");
    }

    let x = tableX;

    headers.forEach((h, i) => {
      let text = "";

      if (row[h] !== undefined && row[h] !== null) {
        const valor = row[h];

        if (valor instanceof Date) {
          text = valor.toLocaleDateString("pt-AO");
        } else if (
          typeof valor === "string" &&
          valor.match(/^\d{4}-\d{2}-\d{2}/)
        ) {
          const [ano, mes, dia] = valor.split("-");
          text = `${dia}/${mes}/${ano}`;
        } else {
          text = String(valor);
        }
      }

      doc.text(text, x + 5, y + 4, {
        width: widths[i] - 10,
        ellipsis: true,
      });

      // linha vertical
      doc
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x, y + rowHeight)
        .stroke();

      x += widths[i];
    });

    // linha inferior
    doc
      .moveTo(tableX, y + rowHeight)
      .lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor("#cccccc")
      .stroke();

    y += rowHeight;
  });

  // borda direita
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
// FUNÇÃO PRINCIPAL
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
// ROTAS DE RELATÓRIOS PDF
// ============================

const relatorios = [
  {
    path: "animais",
    table: "animais",
    headers: ["id", "brinco", "nome", "especie", "sexo", "data_nascimento"],
    columnWidths: [40, 70, 120, 90, 60, 120],
    dateColumn: "data_nascimento",
    title: "Relatório de Animais",
  },
  {
    path: "pesagens",
    table: "pesagens p",
    headers: ["id", "brinco", "peso_recente", "data_pesagem"],
    columnWidths: [50, 120, 130, 200],
    dateColumn: "data_pesagem",
    title: "Relatório de Pesagens",
  },
  {
    path: "natalidade",
    table: "natalidade",
    headers: ["id", "animal_mae_id", "data_parto", "total_nascidos"],
    columnWidths: [50, 150, 150, 150],
    dateColumn: "data_parto",
    title: "Relatório de Natalidade",
  },
  {
    path: "mortalidade",
    table: "mortalidade",
    headers: ["id", "animal_id", "nome", "causa_morte", "data_morte"],
    columnWidths: [40, 90, 120, 140, 110],
    dateColumn: "data_morte",
    title: "Relatório de Mortalidade",
  },
  {
    path: "gestacoes",
    table: "gestacoes",
    headers: ["id", "animal_id", "data_inicio", "estado"],
    columnWidths: [60, 150, 150, 140],
    dateColumn: "data_inicio",
    title: "Relatório de Gestações",
  },
  {
    path: "producao",
    table: "producao_animal",
    headers: ["id", "animal_id", "tipo", "quantidade", "data_producao"],
    columnWidths: [40, 90, 120, 110, 140],
    dateColumn: "data_producao",
    title: "Relatório de Produção Animal",
  },
  {
    path: "producao-vegetal",
    table: "producao_vegetal",
    headers: [
      "id",
      "safra_id",
      "plantacao",
      "qualidade",
      "quantidade",
      "data_colheita",
    ],
    columnWidths: [40, 90, 140, 110, 120],
    dateColumn: "data_producao",
    title: "Relatório de Produção Vegetal",
  },
  {
    path: "tratamentos",
    table: "tratamentos_animais",
    headers: ["id", "animal_id", "descricao", "data_tratamento"],
    columnWidths: [40, 80, 250, 130],
    dateColumn: "data_tratamento",
    title: "Relatório de Tratamentos",
  },
  {
    path: "doencas_animais",
    table: "doencas_animais",
    headers: ["id", "animal_id", "doenca", "data_diagnostico"],
    columnWidths: [40, 80, 260, 120],
    dateColumn: "data_diagnostico",
    title: "Relatório de Doenças de Animais",
  },
];

relatorios.forEach((rel) => {
  router.get(
    `/${rel.path}/pdf`,
    autenticarToken,
    autorizartipo(
      "admin",
      "gerente",
      "capatazpec",
      "capatazagri",
      "recepcionista",
    ),
    async (req, res) => {
      const { inicio, fim } = req.query;

      let where = "";
      let params = [];

      if (inicio && fim) {
        where = `WHERE DATE(${rel.dateColumn}) BETWEEN ? AND ?`;
        params.push(inicio, fim);
      }

      const query = `SELECT * FROM ${rel.table} ${where} ORDER BY id DESC`;

      await gerarPDF(
        res,
        rel.title,
        rel.headers,
        query,
        params,
        req.user?.nome,
        rel.columnWidths,
      );
    },
  );
});

// ============================
// VISÃO GERAL - DASHBOARD
// ============================

router.get(
  "/visao-geral",
  autenticarToken,
  autorizartipo(
    "admin",
    "gerente",
    "capatazpec",
    "capatazagri",
    "recepcionista",
  ),
  async (req, res) => {
    try {
      const [
        animais,
        pesos,
        natalidade,
        gestacoes,
        mortalidade,
        producaoAnimal,
        producaoVegetal,
        distribuicaoLotes,
        distribuicaoInsumos,
        aplicacaoInsumosPorSafra,
      ] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS total, SUM(CASE WHEN sexo='Fêmea' THEN 1 ELSE 0 END) AS femeas, SUM(CASE WHEN sexo='Macho' THEN 1 ELSE 0 END) AS machos FROM animais`,
        ),
        pool.query(
          `SELECT a.especie, ROUND(AVG(p.peso_recente),2) AS peso_medio FROM pesagens p JOIN animais a ON a.id = p.animal_id GROUP BY a.especie`,
        ),
        pool.query(
          `SELECT DATE_FORMAT(data_parto,'%m/%Y') AS mes, COUNT(*) AS total_partos FROM natalidade GROUP BY mes ORDER BY MIN(data_parto)`,
        ),
        pool.query(
          `SELECT SUM(CASE WHEN estado='ativa' THEN 1 ELSE 0 END) AS ativas, SUM(CASE WHEN estado='finalizada' THEN 1 ELSE 0 END) AS finalizada FROM gestacoes`,
        ),
        pool.query(
          `SELECT causa_morte, COUNT(*) AS total FROM mortalidade GROUP BY causa_morte`,
        ),
        pool.query(`SELECT COUNT(*) AS total_animal FROM producao_animal`),
        pool.query(`SELECT COUNT(*) AS total_vegetal FROM producao_vegetal`),
        pool.query(
          `SELECT l.id, l.nome_lote AS lote, COUNT(a.id) AS quantidade_animais FROM lotes l LEFT JOIN animais a ON a.lote_id = l.id GROUP BY l.id, l.nome_lote ORDER BY l.nome_lote`,
        ),
        pool.query(
          `SELECT tipo, SUM(quantidade_disponivel) AS total_quantidade FROM insumos GROUP BY tipo ORDER BY tipo`,
        ),
        pool.query(
          `SELECT s.nome AS safra, SUM(ai.quantidade) AS total_aplicado FROM aplicacoes_insumos ai JOIN safras s ON ai.safra_id = s.id GROUP BY ai.safra_id, s.nome ORDER BY s.nome`,
        ),
      ]);

      res.json({
        status: true,
        data: {
          animais: animais[0][0],
          pesos: pesos[0],
          natalidade: natalidade[0],
          gestacoes: gestacoes[0][0],
          mortalidade: mortalidade[0],
          producaoAnimal: producaoAnimal[0][0].total_animal,
          producaoVegetal: producaoVegetal[0][0].total_vegetal,
          distribuicaoLotes: distribuicaoLotes[0],
          distribuicaoInsumos: distribuicaoInsumos[0],
          aplicacaoInsumosPorSafra: aplicacaoInsumosPorSafra[0],
        },
      });
    } catch (err) {
      console.error("Erro ao gerar visão geral:", err);
      res
        .status(500)
        .json({ status: false, message: "Erro ao gerar visão geral" });
    }
  },
);

// ============================
// APLICAÇÃO DE INSUMOS POR SAFRA
// ============================

router.get(
  "/aplicacao-insumos/safra",
  autenticarToken,
  autorizartipo(
    "admin",
    "gerente",
    "capatazpec",
    "capatazagri",
    "recepcionista",
  ),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT s.nome AS safra, SUM(ai.quantidade) AS total_aplicado
        FROM aplicacoes_insumos ai
        JOIN safras s ON ai.safra_id = s.id
        GROUP BY ai.safra_id, s.nome
        ORDER BY s.nome
      `);

      res.json({ status: true, data: rows });
    } catch (err) {
      console.error("Erro ao buscar aplicação de insumos por safra:", err);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar aplicação de insumos por safra",
      });
    }
  },
);

module.exports = router;
