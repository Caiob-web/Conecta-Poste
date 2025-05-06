const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // onde está o index.html

// 🔌 Conexão com o banco (Railway)
const pool = new Pool({
  connectionString: "postgresql://postgres:PqaBAbgwBoKAIEnyIDNKeorFOgMELWNI@ballast.proxy.rlwy.net:58816/railway",
  ssl: { rejectUnauthorized: false },
});

// 🔍 Endpoint para carregar apenas postes dentro do BBOX e cidade
app.get("/api/postes_bbox", async (req, res) => {
  try {
    const { bbox, nome_municipio } = req.query;

    if (!bbox) return res.status(400).json({ error: "Parâmetro 'bbox' ausente" });

    const [south, west, north, east] = bbox.split(",").map(Number);
    if ([south, west, north, east].some((n) => isNaN(n))) {
      return res.status(400).json({ error: "Parâmetro 'bbox' inválido" });
    }

    const query = `
      SELECT id_poste, empresa, coordenadas
      FROM dados_poste
      WHERE coordenadas IS NOT NULL
        AND TRIM(coordenadas) <> ''
        AND split_part(coordenadas, ',', 1)::float BETWEEN $1 AND $3
        AND split_part(coordenadas, ',', 2)::float BETWEEN $2 AND $4
        ${nome_municipio ? "AND nome_municipio = $5" : ""}
    `;

    const params = nome_municipio
      ? [south, west, north, east, nome_municipio]
      : [south, west, north, east];

    const { rows } = await pool.query(query, params);
    console.log(`🔍 ${rows.length} postes enviados via BBOX ${nome_municipio ? `para ${nome_municipio}` : ""}`);
    res.json(rows);
  } catch (err) {
    console.error("Erro na consulta por BBOX:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// 🧭 Fallback
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// 🚀 Inicializa servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
