const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../config/db");
const path = require("path");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/relatorios1",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    try {
      const { tipo, data_inicio, data_fim, animal_id } = req.query;

      if (!tipo) {
        return res
          .status(400)
          .json({
            status: false,
            message:
              "Informe o tipo de relatório: producao_animal, producao_vegetal, mortalidade ou insumos",
          });
      }

      let query = "";
      let params = [];
      let titulo = "";
      let rows = [];

      switch (tipo) {
        case "producao_animal":
          titulo = "RELATÓRIO DE PRODUÇÃO ANIMAL";
          query = `
            SELECT p.*, a.nome AS animal_nome
            FROM producao_animal p
            JOIN animais a ON a.id = p.animal_id
            WHERE 1=1
          `;
          if (animal_id) {
            query += " AND a.id = ?";
            params.push(animal_id);
          }
          if (data_inicio && data_fim) {
            query += " AND p.data BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
          }
          query += " ORDER BY p.data DESC";
          [rows] = await pool.query(query, params);
          break;

        case "producao_vegetal":
          titulo = "RELATÓRIO DE PRODUÇÃO VEGETAL";
          query = `
            SELECT pv.*, s.nome AS safra_nome, p.nome AS plantacao_nome
            FROM producao_vegetal pv
            LEFT JOIN safras s ON pv.safra_id = s.id
            LEFT JOIN plantacoes p ON pv.plantacao_id = p.id
            WHERE 1=1
          `;
          if (data_inicio && data_fim) {
            query += " AND pv.data_colheita BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
          }
          [rows] = await pool.query(query, params);
          break;

        case "mortalidade":
          titulo = "RELATÓRIO DE MORTALIDADE ANIMAL";
          query = `
            SELECT m.*, a.nome AS animal_nome, a.brinco
            FROM mortalidade m
            LEFT JOIN animais a ON m.animal_id = a.id
            WHERE 1=1
          `;
          if (animal_id) {
            query += " AND m.animal_id = ?";
            params.push(animal_id);
          }
          if (data_inicio && data_fim) {
            query += " AND m.data_morte BETWEEN ? AND ?";
            params.push(data_inicio, data_fim);
          }
          query += " ORDER BY m.data_morte DESC";
          [rows] = await pool.query(query, params);
          break;

        case "insumos":
          titulo = "RELATÓRIO DE INSUMOS";
          query = `
            SELECT i.*, f.nome AS fornecedor_nome
            FROM insumos i
            LEFT JOIN fornecedores f ON i.fornecedor = f.id
            ORDER BY i.id DESC
          `;
          [rows] = await pool.query(query);
          break;

        default:
          return res
            .status(400)
            .json({ status: false, message: "Tipo inválido" });
      }

      // =============================
      // GERAR PDF
      // =============================
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=${tipo}.pdf`);
      doc.pipe(res);

      const logoPath = path.join(__dirname, "../public/logo.png");
      if (require("fs").existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 80 });
      }

      doc.fontSize(18).text("FAZENDA MNR", 150, 50);
      doc.fontSize(10).text(`Relatório gerado por: ${req.user.nome}`, 150, 75);
      doc.text(`Data: ${new Date().toLocaleString()}`, 150, 90);
      doc.moveDown(2);
      doc.moveTo(50, 120).lineTo(550, 120).stroke();
      doc.moveDown(2);

      doc.fontSize(14).text(titulo, { align: "center" });
      doc.moveDown(2);

      // =============================
      // CONTEÚDO
      // =============================
      rows.forEach((item, index) => {
        switch (tipo) {
          case "producao_animal":
            doc
              .fontSize(11)
              .text(
                `${index + 1}. Animal: ${item.animal_nome} | Tipo: ${item.tipo} | Quantidade: ${item.quantidade} ${item.unidade} | Data: ${item.data}`,
              );
            break;
          case "producao_vegetal":
            doc
              .fontSize(11)
              .text(
                `${index + 1}. Safra: ${item.safra_nome || "-"} | Plantação: ${item.plantacao_nome || "-"} | Quantidade: ${item.quantidade} ${item.unidade} | Data: ${item.data_colheita} | Qualidade: ${item.qualidade || "-"}`,
              );
            break;
          case "mortalidade":
            doc
              .fontSize(11)
              .text(
                `${index + 1}. Animal: ${item.animal_nome || "-"} | Brinco: ${item.brinco || "-"} | Data: ${item.data_morte} | Causa: ${item.causa_morte} | Responsável: ${item.responsavel}`,
              );
            if (item.observacoes) doc.text(`   Obs: ${item.observacoes}`);
            break;
          case "insumos":
            doc
              .fontSize(11)
              .text(
                `${index + 1}. Nome: ${item.nome} | Tipo: ${item.tipo} | Quantidade: ${item.quantidade_disponivel} | Fornecedor: ${item.fornecedor_nome || "-"} | Validade: ${item.validade || "-"}`,
              );
            break;
        }
        doc.moveDown(0.5);
      });

      // =============================
      // TOTAL
      // =============================
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
      doc
        .fontSize(12)
        .text(`TOTAL DE REGISTROS: ${rows.length}`, { align: "right" });

      // Rodapé
      doc.moveDown(3);
      doc
        .fontSize(8)
        .text(
          "Documento gerado automaticamente pelo Sistema de Gestão da Fazenda",
          { align: "center" },
        );

      doc.end();
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: false, message: "Erro ao gerar relatório" });
    }
  },
);

module.exports = router;
