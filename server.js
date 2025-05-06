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

// 🔍 Endpoint para buscar postes com ou sem filtro por cidade
app.get("/api/postes", async (req, res) => {
  try {
    const { nome_municipio } = req.query;

    const query = `
      SELECT 
        id_poste,
        STRING_AGG(DISTINCT UPPER(TRIM(empresa)), ', ') AS empresas,
        coordenadas
      FROM dados_poste
      WHERE coordenadas IS NOT NULL 
        AND TRIM(coordenadas) <> ''
        ${nome_municipio ? "AND nome_municipio = $1" : ""}
      GROUP BY id_poste, coordenadas
    `;

    const params = nome_municipio ? [nome_municipio] : [];
    const { rows } = await pool.query(query, params);

    console.log(`🔍 ${rows.length} postes encontrados ${nome_municipio ? "para " + nome_municipio : ""}`);
    res.json(rows);

  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// 🔍 Endpoint opcional: busca por BBOX (se já estiver usando no frontend)
app.get("/api/postes_bbox", async (req, res) => {
  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: "Parâmetro 'bbox' ausente" });

  const [south, west, north, east] = bbox.split(",").map(Number);
  if ([south, west, north, east].some((n) => isNaN(n))) {
    return res.status(400).json({ error: "Parâmetro 'bbox' inválido" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        id_poste,
        STRING_AGG(DISTINCT UPPER(TRIM(empresa)), ', ') AS empresas,
        coordenadas
      FROM dados_poste
      WHERE coordenadas IS NOT NULL
        AND TRIM(coordenadas) <> ''
        AND split_part(coordenadas, ',', 1)::float BETWEEN $1 AND $3
        AND split_part(coordenadas, ',', 2)::float BETWEEN $2 AND $4
      GROUP BY id_poste, coordenadas
      `,
      [south, west, north, east]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro na consulta por BBox:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
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
