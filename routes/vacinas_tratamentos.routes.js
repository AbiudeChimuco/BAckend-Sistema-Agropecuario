const express = require("express");
const router = express.Router();
const db = require("../config/db"); // conexão com o banco
const { autorizartipo } = require("../middleware/auth.middleware");

// Criar nova vacina/tratamento
router.post(
  "/",
  autorizartipo(["admin", "capatazpec", "veterinario"]),
  (req, res) => {
    const {
      animal_id,
      tipo,
      medicamento_id,
      data_aplicacao,
      data_proxima_dose,
      veterinario,
      observacoes,
    } = req.body;

    const query = `
      INSERT INTO vacinas_tratamentos 
      (animal_id, tipo, medicamento_id, data_aplicacao, data_proxima_dose, veterinario, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      query,
      [
        animal_id,
        tipo,
        medicamento_id,
        data_aplicacao,
        data_proxima_dose,
        veterinario,
        observacoes,
      ],
      (err, result) => {
        if (err) {
          console.error("Erro ao inserir vacina/tratamento:", err);
          return res
            .status(500)
            .json({ error: "Erro ao inserir vacina/tratamento" });
        }
        res
          .status(201)
          .json({ message: "Vacina/Tratamento registrado com sucesso!" });
      },
    );
  },
);

// Listar todas vacinas/tratamentos com nomes
router.get(
  "/",
  autorizartipo(["admin", "capatazpec", "recepcionista"]),
  (req, res) => {
    const query = `
      SELECT vt.*, a.nome AS nome_animal, m.nome AS nome_medicamento
      FROM vacinas_tratamentos vt
      JOIN animais a ON vt.animal_id = a.id
      JOIN medicamentos m ON vt.medicamento_id = m.id
      ORDER BY vt.data_aplicacao DESC
    `;
    db.query(query, (err, results) => {
      if (err) {
        console.error("Erro ao listar vacinas/tratamentos:", err);
        return res
          .status(500)
          .json({ error: "Erro ao listar vacinas/tratamentos" });
      }
      res.json(results);
    });
  },
);

// Listar todas vacinas/tratamentos (com nome do medicamento e nome do animal)
router.get(
  "/",
  autorizartipo(["admin", "capatazpec", "recepcionista"]),
  (req, res) => {
    const query = `
      SELECT vt.*, 
             m.nome AS nome_medicamento, 
             a.nome AS nome_animal
      FROM vacinas_tratamentos vt
      JOIN medicamentos m ON vt.medicamento_id = m.id
      JOIN animais a ON vt.animal_id = a.id
    `;
    db.query(query, (err, results) => {
      if (err) {
        console.error("Erro ao listar vacinas/tratamentos:", err);
        return res
          .status(500)
          .json({ error: "Erro ao listar vacinas/tratamentos" });
      }
      res.json(results);
    });
  },
);

// Atualizar vacina/tratamento
router.put(
  "/:id",
  autorizartipo(["admin", "capatazpec", "gerente"]),
  (req, res) => {
    const { id } = req.params;
    const {
      animal_id,
      tipo,
      medicamento_id,
      data_aplicacao,
      data_proxima_dose,
      veterinario,
      observacoes,
    } = req.body;

    const query = `
      UPDATE vacinas_tratamentos 
      SET animal_id = ?, tipo = ?, medicamento_id = ?, data_aplicacao = ?, 
          data_proxima_dose = ?, veterinario = ?, observacoes = ?
      WHERE id = ?
    `;

    db.query(
      query,
      [
        animal_id,
        tipo,
        medicamento_id,
        data_aplicacao,
        data_proxima_dose,
        veterinario,
        observacoes,
        id,
      ],
      (err, result) => {
        if (err) {
          console.error("Erro ao atualizar vacina/tratamento:", err);
          return res
            .status(500)
            .json({ error: "Erro ao atualizar vacina/tratamento" });
        }
        res.json({ message: "Vacina/Tratamento atualizado com sucesso!" });
      },
    );
  },
);

// Deletar vacina/tratamento
router.delete("/:id", autorizartipo(["admin"]), (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM vacinas_tratamentos WHERE id = ?", [id], (err) => {
    if (err) {
      console.error("Erro ao deletar vacina/tratamento:", err);
      return res
        .status(500)
        .json({ error: "Erro ao deletar vacina/tratamento" });
    }
    res.json({ message: "Vacina/Tratamento removido com sucesso!" });
  });
});

module.exports = router;
