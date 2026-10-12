const express = require("express");
const pool = require("../config/db");
const {
  autenticarToken,
  autorizartipo,
} = require("../middleware/auth.middleware");

const router = express.Router();

// GET animais → listar todos os animais

router.get(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM animais");
      res.json({ status: true, data: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao listar animais",
      });
    }
  },
);

// GET /animais/:id → obter um animal

router.get(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec", "recepcionista"),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM animais WHERE id = ?", [
        req.params.id,
      ]);

      if (rows.length === 0) {
        return res.status(404).json({
          status: false,
          message: "Animal não encontrado",
        });
      }

      res.json({ status: true, data: rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao buscar animal",
      });
    }
  },
);

// POST animais → cadastrar animal

router.post(
  "/",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    try {
      const {
        brinco,
        nome,
        especie,
        raca,
        sexo,
        data_nascimento,
        peso_inicial,
        peso_atual,
        lote_id,
        status,
        origem,
        observacoes,
        pai_id,
        mae_id,
        valor_compra,
        data_compra,
        fornecedor_id,
        foto,
        data_entrada,
      } = req.body;

      // .............VALIDAÇÕES
      if (!brinco) {
        return res.status(400).json({
          status: false,
          message: "O campo brinco é obrigatório",
        });
      }

      if (!especie || !raca) {
        return res.status(400).json({
          status: false,
          message: "Campos obrigatórios: espécie e raça",
        });
      }

      if (!["macho", "femea"].includes(sexo)) {
        return res.status(400).json({
          status: false,
          message: "Sexo inválido (macho/femea)",
        });
      }

      if (
        !["bovino", "ovino", "suino", "aves", "caprino", "quinos"].includes(
          especie,
        )
      ) {
        return res.status(400).json({
          status: false,
          message:
            "Espécie inválida (bovino, ovino, suino, aves, caprino, quinos)",
        });
      }

      if (!["local", "comprado"].includes(origem)) {
        return res.status(400).json({
          status: false,
          message: "Origem inválida (local/comprado)",
        });
      }

      if (origem === "comprado" && (!valor_compra || !fornecedor_id)) {
        return res.status(400).json({
          status: false,
          message:
            "Para animais comprados é obrigatório informar valor_compra e fornecedor_id",
        });
      }

      if (origem === "local" && (!pai_id || !mae_id)) {
        return res.status(400).json({
          status: false,
          message:
            "Para animais de origem local é obrigatório informar pai_id e mae_id",
        });
      }

      //  VERIFICAR BRINCO ÚNICO
      const [existe] = await pool.query(
        "SELECT id FROM animais WHERE brinco = ?",
        [brinco],
      );

      if (existe.length > 0) {
        return res.status(400).json({
          status: false,
          message: "Já existe um animal cadastrado com este brinco",
        });
      }

      //  INSERT
      const [result] = await pool.query(
        `INSERT INTO animais
        (brinco, nome, especie, raca, sexo, data_nascimento,
         peso_inicial, peso_atual, lote_id, status, origem,
         observacoes, pai_id, mae_id, valor_compra, data_compra,
         fornecedor_id, foto, data_entrada)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          brinco,
          nome,
          especie,
          raca,
          sexo,
          data_nascimento || null,
          peso_inicial || null,
          peso_atual || null,
          lote_id || null,
          status || "ativo",
          origem,
          observacoes || null,
          pai_id || null,
          mae_id || null,
          valor_compra || null,
          data_compra || null,
          fornecedor_id || null,
          foto || null,
          data_entrada || null,
        ],
      );

      res.status(201).json({
        status: true,
        message: "Animal cadastrado com sucesso",
        id: result.insertId,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao cadastrar animal",
      });
    }
  },
);

//  actualizar animal

router.put(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente", "capatazpec"),
  async (req, res) => {
    try {
      const {
        brinco,
        nome,
        especie,
        raca,
        sexo,
        data_nascimento,
        peso_inicial,
        peso_atual,
        lote_id,
        status,
        origem,
        observacoes,
        pai_id,
        mae_id,
        valor_compra,
        data_compra,
        fornecedor_id,
        foto,
        data_entrada,
      } = req.body;

      if (!brinco) {
        return res.status(400).json({
          status: false,
          message: "O campo brinco é obrigatório",
        });
      }

      //  verificar se o brinco é unico
      const [existe] = await pool.query(
        "SELECT id FROM animais WHERE brinco = ? AND id <> ?",
        [brinco, req.params.id],
      );

      if (existe.length > 0) {
        return res.status(400).json({
          status: false,
          message: "Este brinco já está sendo usado por outro animal",
        });
      }

      const [result] = await pool.query(
        `UPDATE animais SET
          brinco = ?, nome = ?, especie = ?, raca = ?, sexo = ?,
          data_nascimento = ?, peso_inicial = ?, peso_atual = ?,
          lote_id = ?, status = ?, origem = ?, observacoes = ?,
          pai_id = ?, mae_id = ?, valor_compra = ?, data_compra = ?,
          fornecedor_id = ?, foto = ?, data_entrada = ?
        WHERE id = ?`,
        [
          brinco,
          nome || null,
          especie,
          raca,
          sexo,
          data_nascimento || null,
          peso_inicial || null,
          peso_atual || null,
          lote_id || null,
          status || "ativo",
          origem,
          observacoes || null,
          pai_id || null,
          mae_id || null,
          valor_compra || null,
          data_compra || null,
          fornecedor_id || null,
          foto || null,
          data_entrada || null,
          req.params.id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: false,
          message: "Animal não encontrado",
        });
      }

      res.json({
        status: true,
        message: "Animal atualizado com sucesso",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: "Erro ao atualizar animal",
      });
    }
  },
);

//apagar animal

// apagar animal (apagando tudo que depende dele)
router.delete(
  "/:id",
  autenticarToken,
  autorizartipo("admin", "gerente"),
  async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

     
      await conn.query("DELETE FROM doencas_animais WHERE animal_id = ?", [id]);

      // gestações do animal
      await conn.query("DELETE FROM gestacoes WHERE animal_id = ?", [id]);

   
      const [result] = await conn.query("DELETE FROM animais WHERE id = ?", [
        id,
      ]);

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({
          status: false,
          message: "Animal não encontrado",
        });
      }

      await conn.commit();

      res.json({
        status: true,
        message:
          "Animal e todos os registos relacionados foram apagados com sucesso",
      });
    } catch (error) {
      await conn.rollback();
      console.error(error);

      res.status(500).json({
        status: false,
        message: "Erro ao excluir animal",
      });
    } finally {
      conn.release();
    }
  },
); // =

router.get("/gestantes", autenticarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
        SELECT 
          a.id,
          a.nome,
          a.brinco,
          g.id AS gestacao_id
        FROM animais a
        INNER JOIN gestacoes g ON g.animal_id = a.id
        WHERE g.status = 'ativa'
      `);

    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao listar fêmeas gestantes" });
  }
});

module.exports = router;
