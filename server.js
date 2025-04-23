const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const NodeCache = require("node-cache");

const app = express();
const port = process.env.PORT || 3000;

const cache = new NodeCache({ stdTTL: 600 }); // 600 segundos = 10 minutos

app.use(cors());
app.use(express.static("public"));

// Conexão com o Railway
const pool = new Pool({
  connectionString:
    "postgresql://postgres:PqaBAbgwBoKAIEnyIDNKeorFOgMELWNI@ballast.proxy.rlwy.net:58816/railway",
  ssl: { rejectUnauthorized: false },
});

// Endpoint com cache
app.get("/api/postes", async (req, res) => {
  const cacheKey = "postes";
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log("🔄 Dados servidos do cache");
    console.log("📦 Conteúdo do cache:", cached.slice(0, 3)); // mostra os 3 primeiros postes
    return res.json(cached);
  }

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
    cache.set(cacheKey, rows); // salva no cache
    res.json(rows);
  } catch (err) {
    console.error("❌ Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Rota 404
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// Inicializa o servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
