// server.js

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const app = express();
const port = process.env.PORT || 3000;

// ===========================================================
// 1) MIDDLEWARES
// ===========================================================
// Desabilita ETag e força no-cache
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  next();
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Serve arquivos estáticos em /public
app.use(express.static(path.join(__dirname, "public")));

// ===========================================================
// 2) CONFIGURAÇÃO DOS POOLS PARA CADA CIDADE VIA ENV VARS
// ===========================================================
const pools = {
  sjc: new Pool({ connectionString: process.env.DB_URL_SJC, ssl: { rejectUnauthorized: false } }),
  mogi: new Pool({ connectionString: process.env.DB_URL_MOGI, ssl: { rejectUnauthorized: false } }),
  ln: new Pool({ connectionString: process.env.DB_URL_LN, ssl: { rejectUnauthorized: false } }),
  guarulhos: new Pool({ connectionString: process.env.DB_URL_GUARULHOS, ssl: { rejectUnauthorized: false } }),
  guara: new Pool({ connectionString: process.env.DB_URL_GUARA, ssl: { rejectUnauthorized: false } }),
  demais: new Pool({ connectionString: process.env.DB_URL_DEMAIS, ssl: { rejectUnauthorized: false } }),
};

// ===========================================================
// 3) CACHE PARA /api/postes (GET)
// ===========================================================
let cachePostes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

app.get("/api/postes", async (req, res) => {
  const now = Date.now();
  if (cachePostes && now - cacheTimestamp < CACHE_TTL) {
    return res.json(cachePostes);
  }

  try {
    const results = await Promise.all(
      Object.values(pools).map(pool =>
        pool.query(
          `SELECT id_poste, empresa, resumo, coordenadas, nome_municipio
           FROM dados_poste
           WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''`
        ).then(r => r.rows)
      )
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

// ===========================================================
// 4) ROTA: POST /api/postes/report → GERA O EXCEL
// ===========================================================
app.post("/api/postes/report", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: "Envie um array de IDs no corpo da requisição." });
    }

    const idsNum = ids.map(x => parseInt(x, 10)).filter(n => !isNaN(n));
    if (!idsNum.length) {
      return res.status(400).json({ error: "Nenhum ID válido encontrado." });
    }

    const registros = await Promise.all(
      Object.values(pools).map(pool =>
        pool.query(
          `SELECT id_poste, empresa, coordenadas
           FROM dados_poste
           WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
             AND id_poste = ANY($1)`,
          [idsNum]
        ).then(r => r.rows)
      )
    );

    const todosRegistros = registros.flat();
    if (!todosRegistros.length) {
      return res.status(404).json({ error: "Nenhum poste encontrado para esses IDs." });
    }

    const mapPorPoste = {};
    todosRegistros.forEach(({ id_poste, empresa, coordenadas }) => {
      if (!mapPorPoste[id_poste]) {
        mapPorPoste[id_poste] = { coordenadas, empresas: new Set() };
      }
      if (empresa && empresa.toUpperCase() !== "DISPONÍVEL") {
        mapPorPoste[id_poste].empresas.add(empresa);
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Relatório de Postes");
    sheet.columns = [
      { header: "ID POSTE", key: "id_poste", width: 15 },
      { header: "EMPRESAS", key: "empresas", width: 40 },
      { header: "COORDENADA", key: "coordenadas", width: 25 },
    ];

    Object.entries(mapPorPoste).forEach(([id, info]) => {
      sheet.addRow({
        id_poste: parseInt(id, 10),
        empresas: [...info.empresas].join(", "),
        coordenadas: info.coordenadas,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=relatorio_postes.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    res.status(500).json({ error: "Erro interno ao gerar relatório." });
  }
});

// ===========================================================
// 5) ROTA CORINGA (404)
// ===========================================================
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// ===========================================================
// 6) INICIA O SERVIDOR
// ===========================================================
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
