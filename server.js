const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // frontend estático

// 🔌 Conexões com os bancos de dados
const poolA = new Pool({
  connectionString: process.env.DATABASE_CIDADE_A,
  ssl: { rejectUnauthorized: false },
});

const poolB = new Pool({
  connectionString: process.env.DATABASE_CIDADE_B,
  ssl: { rejectUnauthorized: false },
});

// 🔍 Rota dinâmica para buscar todos os postes por cidade
app.get("/api/postes/:cidade", async (req, res) => {
  const cidade = req.params.cidade.toLowerCase();
  const pool =
    cidade === "cidade-a" ? poolA : cidade === "cidade-b" ? poolB : null;

  if (!pool) return res.status(400).json({ error: "Cidade inválida" });

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

    console.log(`📍 ${rows.length} postes carregados de ${cidade}`);
    res.json(rows);
  } catch (err) {
    console.error(`Erro na consulta de postes (${cidade}):`, err.stack);
    res.status(500).json({ error: `Erro no servidor - ${cidade}` });
  }
});

// 🔍 Rota dinâmica para buscar postes por BBOX e cidade
app.get("/api/postes_bbox/:cidade", async (req, res) => {
  const { cidade } = req.params;
  const { bbox } = req.query;

  if (!bbox) return res.status(400).json({ error: "Parâmetro 'bbox' ausente" });

  const [south, west, north, east] = bbox.split(",").map(Number);
  if ([south, west, north, east].some((n) => isNaN(n))) {
    return res.status(400).json({ error: "Parâmetro 'bbox' inválido" });
  }

  const pool =
    cidade.toLowerCase() === "cidade-a"
      ? poolA
      : cidade.toLowerCase() === "cidade-b"
      ? poolB
      : null;

  if (!pool) return res.status(400).json({ error: "Cidade inválida" });

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
    console.error(`Erro na consulta BBOX (${cidade}):`, err);
    res.status(500).json({ error: `Erro interno do servidor - ${cidade}` });
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
