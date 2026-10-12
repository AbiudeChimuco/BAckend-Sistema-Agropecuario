            const express = require("express");
            const pool = require("../config/db");
            const {
              autenticarToken,
              autorizartipo,
            } = require("../middleware/auth.middleware");

            const router = express.Router();

            // Função auxiliar para criar aviso

            function criarAviso(tipo, id, nome, diasRestantes) {
              // Mensagens individuais por tipo
              let mensagemBase = "";
              switch (tipo) {
                case "Gestacao":
                  mensagemBase = `Faltam ${diasRestantes} dias para o parto do animal`;
                  break;
                case "Pesagem":
                  mensagemBase = `Faltam ${diasRestantes} dias para a próxima pesagem do animal`;
                  break;
                case "Safra":
                  mensagemBase = `Faltam ${diasRestantes} dias para a colheita da safra`;
                  break;
                case "Plantacao":
                  mensagemBase = `Faltam ${diasRestantes} dias para a colheita da plantação`;
                  break;
                case "Insumo":
                  mensagemBase = `Faltam ${diasRestantes} dias para o vencimento do insumo`;
                  break;
                case "Medicamento":
                  mensagemBase = `Faltam ${diasRestantes} dias para o vencimento do medicamento`;
                  break;
                default:
                  mensagemBase = `Faltam ${diasRestantes} dias para ${tipo.toLowerCase()}`;
              }

              return {
                tipo,
                [`${tipo.toLowerCase()}_id`]: id,
                [`${tipo.toLowerCase()}_nome`]: nome,
                mensagem: `${mensagemBase} "${nome}"`,
                dias_restantes: diasRestantes,
              };
            }

            // Função genérica para buscar avisos

            async function buscarAvisos({
              tabela,
              idCampo,
              nomeCampo,
              dataCampo,
              diasLimite,
              tipo,
              estado = null,
              join = null,
            }) {
              let selectNome = nomeCampo ? `, ${nomeCampo} AS nome` : "";
              let query = `SELECT ${idCampo} AS ${tipo.toLowerCase()}_id${selectNome},
                          DATEDIFF(${dataCampo}, CURDATE()) AS dias_restantes
                          FROM ${tabela} WHERE DATEDIFF(${dataCampo}, CURDATE()) BETWEEN 0 AND ?`;

              const params = [diasLimite];
              if (estado) {
                query += ` AND estado = ?`;
                params.push(estado);
              }

              if (join) {
                query = `
                  SELECT t.${idCampo} AS ${tipo.toLowerCase()}_id, j.${join.campoNome} AS nome,
                        DATEDIFF(t.${dataCampo}, CURDATE()) AS dias_restantes
                  FROM ${tabela} t
                  JOIN ${join.tabela} j ON t.${join.campoId} = j.id
                  WHERE DATEDIFF(t.${dataCampo}, CURDATE()) BETWEEN 0 AND ?
                  ${estado ? `AND t.estado = ?` : ""}
                `;
              }

              const [rows] = await pool.query(query, params);

              return rows.map((r) =>
                criarAviso(
                  tipo,
                  r[`${tipo.toLowerCase()}_id`],
                  r.nome || `ID ${r[`${tipo.toLowerCase()}_id`]}`,
                  r.dias_restantes,
                ),
              );
            }

            // GET /avisos → listar todos os avisos com permissões

            router.get(
              "/",
              autenticarToken,
              autorizartipo(
                "admin",
                "gerente",
                "capatazpec",
                "recepcionista",
                "capatazagri",
              ),
              async (req, res) => {
                try {
                  let avisos = [];

                  // Gestação
                  avisos.push(
                    ...(await buscarAvisos({
                      tabela: "gestacoes",
                      idCampo: "id",
                      nomeCampo: null,
                      dataCampo: "data_prevista_parto",
                      diasLimite: 7,
                      tipo: "Gestacao",
                      join: { tabela: "animais", campoId: "animal_id", campoNome: "nome" },
                      estado: "ativa",
                    })),
                  );

                  // Pesagens
                  avisos.push(
                    ...(await buscarAvisos({
                      tabela: "pesagens",
                      idCampo: "id",
                      nomeCampo: null,
                      dataCampo: "dataproxima_pesagem",
                      diasLimite: 7,
                      tipo: "Pesagem",
                      join: { tabela: "animais", campoId: "animal_id", campoNome: "nome" },
                    })),
                  );

                  // Safras
                  avisos.push(
                    ...(await buscarAvisos({
                      tabela: "safras",
                      idCampo: "id",
                      nomeCampo: "nome",
                      dataCampo: "data_prevista_colheita",
                      diasLimite: 8,
                      tipo: "Safra",
                      estado: "em_andamento",
                    })),
                  );

                  // Plantações
                  avisos.push(
                    ...(await buscarAvisos({
                      tabela: "plantacoes",
                      idCampo: "id",
                      nomeCampo: "nome",
                      dataCampo: "data_prevista_colheita",
                      diasLimite: 14,
                      tipo: "Plantacao",
                      estado: "em_andamento",
                    })),
                  );

                  // Insumos
                  avisos.push(
                    ...(await buscarAvisos({
                      tabela: "insumos",
                      idCampo: "id",
                      nomeCampo: "nome",
                      dataCampo: "validade",
                      diasLimite: 21,
                      tipo: "Insumo",
                    })),
                  );

                  // Medicamentos
                  avisos.push(
                    ...(await buscarAvisos({
                      tabela: "medicamentos",
                      idCampo: "id",
                      nomeCampo: "nome",
                      dataCampo: "validade",
                      diasLimite: 21,
                      tipo: "Medicamento",
                    })),
                  );

                  // Filtrar avisos por tipo de usuário

                  const tipoUsuario = req.usuario.tipo;

                  const avisosFiltrados = avisos.filter((aviso) => {
                    if (["admin", "gerente"].includes(tipoUsuario)) return true;
                    if (tipoUsuario === "capatazagri")
                      return ["Safra", "Plantacao"].includes(aviso.tipo);
                    if (tipoUsuario === "capatazpec")
                      return ["Gestacao", "Pesagem"].includes(aviso.tipo);
                    if (tipoUsuario === "recepcionista")
                      return ["Insumo", "Medicamento"].includes(aviso.tipo);
                    return false;
                  });

                  res.json({ status: true, data: avisosFiltrados });
                } catch (err) {
                  console.error("Erro ao gerar avisos:", err);
                  res.status(500).json({ status: false, message: "Erro ao gerar avisos" });
                }
              },
            );

            module.exports = router;
