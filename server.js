const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

// 🔌 Pools de conexões para múltiplos bancos
const pools = {
  sjc: new Pool({
    connectionString: "postgresql://postgres:rbhaEXKeIrsMmfCfcVQxACBtCZcVmePc@hopper.proxy.rlwy.net:43519/railway",
    ssl: { rejectUnauthorized: false },
  }),
  mogi: new Pool({
    connectionString: "postgresql://postgres:XzHyeNIcbThuKDxEsgbZBTrdpNUTIfNz@tramway.proxy.rlwy.net:39024/railway",
    ssl: { rejectUnauthorized: false },
  }),
  ln: new Pool({
    connectionString: "postgresql://postgres:TFSZLSTrUhcRVEzdeToWmbOrxnkvWXdL@shuttle.proxy.rlwy.net:35000/railway",
    ssl: { rejectUnauthorized: false },
  }),
  guarulhos: new Pool({
    connectionString: "postgresql://postgres:CFEAhBpQDeuPwjJUmVzgjjlbBaamaUns@yamanote.proxy.rlwy.net:35807/railway",
    ssl: { rejectUnauthorized: false },
  }),
  guara: new Pool({
    connectionString: "postgresql://postgres:GoOYbaAbfzMwVkcSgNitAYkeUWKRCsrY@switchback.proxy.rlwy.net:10799/railway",
    ssl: { rejectUnauthorized: false },
  }),
  demais: new Pool({
    connectionString: "postgresql://postgres:BajshBCFTNWXlnuGQXLNOwiyfvaLhAgJ@centerbeam.proxy.rlwy.net:45633/railway",
    ssl: { rejectUnauthorized: false },
  }),
};

// ✅ Cache de dados
let cachePostes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// 🔍 Consulta unificada com cache, sem filtrar "DISPONÍVEL"
app.get("/api/postes", async (req, res) => {
  const now = Date.now();
  if (cachePostes && now - cacheTimestamp < CACHE_TTL) {
    return res.json(cachePostes);
  }

  try {
    const results = await Promise.all(
      Object.entries(pools).map(async ([cidade, pool]) => {
        const { rows } = await pool.query(`
          SELECT 
            id_poste,
            empresa,
            resumo,
            coordenadas,
            nome_municipio
          FROM dados_poste
          WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
        `);
        return rows;
      })
    );

    const todosPostes = results.flat();
    cachePostes = todosPostes;
    cacheTimestamp = now;

    res.json(todosPostes);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// 404 padrão
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// 🚀 Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
