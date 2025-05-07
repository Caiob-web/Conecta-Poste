const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // Pasta onde está o index.html

// Conexões com bancos por cidade
const pools = {
  mogi: new Pool({
    connectionString: "postgresql://postgres:SFUszjwNHVODKEaFsoShHfHSOmyTmSzm@crossover.proxy.rlwy.net:28652/railway",
    ssl: { rejectUnauthorized: false },
  }),
  santabranca: new Pool({
    connectionString: "postgresql://postgres:KAjIlSvDPTBADDaKJbwJYIAGQlWwleAl@tramway.proxy.rlwy.net:37155/railway",
    ssl: { rejectUnauthorized: false },
  }),
};

// Endpoint principal que retorna TODOS os postes unificados
app.get("/api/todos_postes", async (req, res) => {
  const queries = Object.entries(pools).map(async ([cidade, pool]) => {
    try {
      const result = await pool.query(`
        SELECT 
          id_poste,
          MAX(coordenadas) AS coordenadas, -- usa uma coordenada qualquer para representar
          STRING_AGG(DISTINCT UPPER(TRIM(empresa)), ', ') AS empresas
        FROM dados_poste
        WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
        GROUP BY id_poste
      `);
      console.log(`✅ ${cidade}: ${result.rows.length} postes`);
      return result.rows;
    } catch (err) {
      console.error(`❌ Erro na cidade ${cidade}:`, err.message);
      return [];
    }
  });

  try {
    const results = await Promise.all(queries);
    const allPostes = results.flat(); // junta todos os resultados
    console.log(`🔍 Total geral: ${allPostes.length} postes`);
    res.json(allPostes); // envia pro frontend
  } catch (err) {
    console.error("❌ Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao consultar os bancos" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
