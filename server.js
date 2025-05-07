const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

// Bancos por cidade
const pools = {
  Mogi: new Pool({
    connectionString: "postgresql://postgres:SFUszjwNHVODKEaFsoShHfHSOmyTmSzm@crossover.proxy.rlwy.net:28652/railway",
    ssl: { rejectUnauthorized: false },
  }),
  SANTABRANCA: new Pool({
    connectionString: "postgresql://postgres:KAjIlSvDPTBADDaKJbwJYIAGQlWwleAl@tramway.proxy.rlwy.net:37155/railway",
    ssl: { rejectUnauthorized: false },
  }),
  jacarei: new Pool({
    connectionString: "postgresql://usuario:senha@host3:porta3/railway",
    ssl: { rejectUnauthorized: false },
  }),
};

// Endpoint com seleção de banco por cidade
app.get("/api/postes_bbox", async (req, res) => {
  const { bbox, cidade } = req.query;

  if (!bbox || !cidade || !pools[cidade]) {
    return res.status(400).json({ error: "Parâmetros 'bbox' ou 'cidade' inválidos" });
  }

  const [south, west, north, east] = bbox.split(",").map(Number);
  if ([south, west, north, east].some((n) => isNaN(n))) {
    return res.status(400).json({ error: "Parâmetro 'bbox' inválido" });
  }

  try {
    const { rows } = await pools[cidade].query(`
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
    `, [south, west, north, east]);

    res.json(rows);
  } catch (err) {
    console.error("Erro na consulta por BBox:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
