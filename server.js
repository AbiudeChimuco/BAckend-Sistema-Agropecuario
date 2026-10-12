const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

/* ===============================
 * CONFIGURAÇÃO INICIAL
 * =============================== */
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* ===============================
 * IMPORTAÇÃO DE ROTAS
 * =============================== */
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/usuarios.routes");
const animaisRoutes = require("./routes/animais.routes");
const pesagensRoutes = require("./routes/pesagens.routes");
const vacinasTratamentosRoutes = require("./routes/vacinas_tratamentos.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const lotesRoutes = require("./routes/lotes.routes");
const movimentacaoRoutes = require("./routes/movimentacao.routes");
const gestacoesRoutes = require("./routes/gestacoes.routes");
const natalidadeRoutes = require("./routes/natalidade.routes");
const mortalidadeRoutes = require("./routes/mortalidade.routes");
const fornecedoresRoutes = require("./routes/fornecedores.routes");
const estoqueRoutes = require("./routes/estoque.routes");
const medicamentosRoutes = require("./routes/medicamentos.routes");

// Rotas agrícolas
const safrasRoutes = require("./routes/safras.routes");
const culturasRoutes = require("./routes/culturas.routes");
const talhoesRoutes = require("./routes/talhoes.routes");
const plantacoesRoutes = require("./routes/plantacoes.routes");
const aplicacoesInsumosRoutes = require("./routes/aplicacoes_insumos.routes");
const movimentacao_insumosRoutes = require("./routes/movimentacao_insumos.routes");
const insumosRoutes = require("./routes/insumos.routes");
const funcionariosRoutes = require("./routes/funcionarios.routes");
const especiesRoutes = require("./routes/especies.routes");

// Novas rotas

const producaoAnimalRoutes = require("./routes/producao_animal.routes");
const producaoVegetalRoutes = require("./routes/producao_vegetal.routes");

const pastagensRoutes = require("./routes/pastagens.routes");
const usoPastagensRoutes = require("./routes/uso_pastagens.routes");
const relatoriosRoutes = require("./routes/relatorios.routes");
const avisosRoutes = require("./routes/avisos.routes");

const mensagensRoutes = require("./routes/mensagens.routes");
const assistenteRoutes = require("./routes/assistente.routes");
const doencas_animaisRoutes = require("./routes/doencas_animais.routes");
const tratamentos_animaisRoutes = require("./routes/tratamentos_animais.routes");

const climaRoutes = require("./routes/clima.routes");
const setoresRoutes = require("./routes/setores.routes");
const relatorios1Routes = require("./routes/relatorios1");
const historicoRoutes = require("./routes/historico");
const perfilRoutes = require("./routes/perfil.routes");
const atividadesRoutes = require("./routes/atividades.routes");
const rastreioRoutes = require("./routes/rastreio.routes");
const analiseGastosRoutes = require("./routes/analiseGastos.routes");

/* ===============================
 * REGISTRO DAS ROTAS
 * =============================== */
app.use("/analiseGastos", analiseGastosRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/animais", animaisRoutes);
app.use("/pesagens", pesagensRoutes);
app.use("/vacinas_tratamentos", vacinasTratamentosRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/lotes", lotesRoutes);
app.use("/movimentacao", movimentacaoRoutes);
app.use("/gestacoes", gestacoesRoutes);
app.use("/natalidade", natalidadeRoutes);
app.use("/mortalidade", mortalidadeRoutes);
app.use("/especies", especiesRoutes);

app.use("/fornecedores", fornecedoresRoutes);
app.use("/estoque", estoqueRoutes);
app.use("/medicamentos", medicamentosRoutes);

// Rotas agrícolas
app.use("/safras", safrasRoutes);
app.use("/culturas", culturasRoutes);
app.use("/talhoes", talhoesRoutes);
app.use("/insumos", insumosRoutes);
app.use("/plantacoes", plantacoesRoutes);
app.use("/aplicacoes_insumos", aplicacoesInsumosRoutes);
app.use("/movimentacao_insumos", movimentacao_insumosRoutes);
app.use("/funcionarios", funcionariosRoutes);

// Novas rotas

app.use("/producao-animal", producaoAnimalRoutes);
app.use("/producao_vegetal", producaoVegetalRoutes);

app.use("/pastagens", pastagensRoutes);
app.use("/uso-pastagens", usoPastagensRoutes);
app.use("/relatorios", relatoriosRoutes);
app.use("/avisos", avisosRoutes);
app.use("/relatorios1", relatorios1Routes);

app.use("/mensagens", mensagensRoutes);
app.use("/assistente", assistenteRoutes);
app.use("/doencas_animais", doencas_animaisRoutes);
app.use("/tratamentos_animais", tratamentos_animaisRoutes);

app.use("/clima", climaRoutes);
app.use("/setores", setoresRoutes);
app.use("/historico", historicoRoutes);
app.use("/perfil", perfilRoutes);
app.use("/atividades", atividadesRoutes);
app.use("/rastreio", rastreioRoutes);

/* ===============================
 * SERVIÇO DE ARQUIVOS UPLOADS
 * =============================== */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===============================
 * INICIALIZAÇÃO DO SERVIDOR
 * =============================== */
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT} 🚀`);
});
