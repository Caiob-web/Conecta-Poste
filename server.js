const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // frontend estático

// 🔄 NOVA CONEXÃO COM O RAILWAY
const pool = new Pool({
  connectionString: "postgresql://postgres:SFUszjwNHVODKEaFsoShHfHSOmyTmSzm@crossover.proxy.rlwy.net:28652/railway




",
  ssl: { rejectUnauthorized: false },
});

// 🔍 ENDPOINT PARA BUSCAR OS POSTES
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
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});