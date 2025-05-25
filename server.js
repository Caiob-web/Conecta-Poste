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
    connectionString:
      "postgresql://postgres:rbhaEXKeIrsMmfCfcVQxACBtCZcVmePc@hopper.proxy.rlwy.net:43519/railway",
    ssl: { rejectUnauthorized: false },
  }),
  mogi: new Pool({
    connectionString:
      "postgresql://postgres:XzHyeNIcbThuKDxEsgbZBTrdpNUTIfNz@tramway.proxy.rlwy.net:39024/railway",
    ssl: { rejectUnauthorized: false },
  }),
  ln: new Pool({
    connectionString:
      "postgresql://postgres:TFSZLSTrUhcRVEzdeToWmbOrxnkvWXdL@shuttle.proxy.rlwy.net:35000/railway",
    ssl: { rejectUnauthorized: false },
  }),
  guarulhos: new Pool({
    connectionString:
      "postgresql://postgres:CFEAhBpQDeuPwjJUmVzgjjlbBaamaUns@yamanote.proxy.rlwy.net:35807/railway",
    ssl: { rejectUnauthorized: false },
  }),
  guara: new Pool({
    connectionString:
      "postgresql://postgres:GoOYbaAbfzMwVkcSgNitAYkeUWKRCsrY@switchback.proxy.rlwy.net:10799/railway",
    ssl: { rejectUnauthorized: false },
  }),
  demais: new Pool({
    connectionString:
      "postgresql://postgres:BajshBCFTNWXlnuGQXLNOwiyfvaLhAgJ@centerbeam.proxy.rlwy.net:45633/railway",
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

// 🔎 Consulta por múltiplos IDs de postes em todas as cidades
app.get("/api/postes-multiplos", async (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) {
    return res.status(400).json({ error: "Envie o parâmetro 'ids'" });
  }

  // Suporta vírgula ou quebra de linha
  const ids = idsParam
    .split(/[\n,]+/)
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({ error: "Nenhum ID fornecido" });
  }

  try {
    // Consulta cada banco separadamente (paralelo)
    const results = await Promise.all(
      Object.entries(pools).map(async ([cidade, pool]) => {
        const { rows } = await pool.query(
          `SELECT 
            id_poste,
            empresa,
            resumo,
            coordenadas,
            nome_municipio
           FROM dados_poste
           WHERE id_poste = ANY($1)`,
          [ids]
        );
        return rows;
      })
    );
    const postesEncontrados = results.flat();

    res.json({
      encontrados: postesEncontrados,
      ids_consultados: ids,
      ids_nao_encontrados: ids.filter(
        (id) =>
          !postesEncontrados.find((p) => String(p.id_poste) === String(id))
      ),
    });
  } catch (err) {
    console.error("Erro na busca de múltiplos IDs:", err);
    res.status(500).json({ error: "Erro ao consultar múltiplos IDs" });
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
