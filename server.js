const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // frontend estático

// 🔌 Conexão com o banco (Railway)
const pool = new Pool({
  connectionString:
    "postgresql://postgres:PqaBAbgwBoKAIEnyIDNKeorFOgMELWNI@ballast.proxy.rlwy.net:58816/railway",
  ssl: { rejectUnauthorized: false },
});

// 🔍 Endpoint para buscar os postes
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

// 🧭 Rota fallback
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// 🚀 Inicializa servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
function alternarPainel() {
  const painel = document.querySelector('.painel-busca');
  painel.classList.toggle('hidden');
}