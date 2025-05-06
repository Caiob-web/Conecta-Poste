const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // frontend estático

// 🔌 Conexão com o banco (Railway)
const pool = new Pool({
  connectionString: "postgresql://postgres:PqaBAbgwBoKAIEnyIDNKeorFOgMELWNI@ballast.proxy.rlwy.net:58816/railway",
  ssl: { rejectUnauthorized: false },
});

// 🔍 Endpoint para buscar todos os postes
app.get("/api/postes", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id_poste,
        STRING_AGG(DISTINCT UPPER(TRIM(empresa)), ', ') AS empresas,
        coordenadas
      FROM dados_poste
      WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
      GROUP BY id_poste, coordenadas
    `);

    console.log(`🔍 ${rows.length} postes consultados do banco`);
    res.json(rows);

  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// 🔍 Endpoint para buscar todos os postes OU por cidade
app.get("/api/postes", async (req, res) => {
  try {
    const { cidade } = req.query;

    const query = `
      SELECT 
        id_poste,
        STRING_AGG(DISTINCT UPPER(TRIM(empresa)), ', ') AS empresas,
        coordenadas
      FROM dados_poste
      WHERE coordenadas IS NOT NULL 
        AND TRIM(coordenadas) <> ''
        ${cidade ? "AND nome_municipio = $1" : ""}
      GROUP BY id_poste, coordenadas
    `;

    const params = cidade ? [cidade] : [];
    const { rows } = await pool.query(query, params);

    console.log(`🔍 ${rows.length} postes encontrados ${cidade ? "para " + cidade : ""}`);
    res.json(rows);

  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});
// 🧭 Rota fallback
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// 🚀 Inicializa servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});

// 🛠️ Função para alternar o painel (não deveria estar aqui, mas mantive conforme seu pedido)
function alternarPainel() {
  const painel = document.querySelector(".painel-busca");
  if (painel) {
    painel.classList.toggle("hidden");
  } else {
    console.warn("🔍 Painel não encontrado no DOM");
  }
}
