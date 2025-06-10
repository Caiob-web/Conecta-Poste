// server.js

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");
const { NeonApiClient } = require("@neondatabase/api-client");

const app = express();
const port = process.env.PORT || 3000;

// ===========================================================
// 1) MIDDLEWARES
// ===========================================================
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===========================================================
// 2) CONEXÃO AO BANCO DE DADOS (UM ÚNICO POOL)
// ===========================================================
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_CIxXZ6mF9Oud@ep-dawn-boat-a8zaanby-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

// ===========================================================
// 3) CACHE EM MEMÓRIA PARA /api/postes (GET)
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
    const result = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM vw_postes_com_coord WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''`
    );

    cachePostes = result.rows;
    cacheTimestamp = now;
    res.json(result.rows);
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

    const { rows } = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM vw_postes_com_coord WHERE id_poste = ANY($1)`,
      [idsNum]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Nenhum poste encontrado para esses IDs." });
    }

    const mapPorPoste = {};
    rows.forEach(({ id_poste, empresa, coordenadas }) => {
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

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=relatorio_postes.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    res.status(500).json({ error: "Erro interno ao gerar relatório." });
  }
});

// ===========================================================
// 5) ROTA /api/neon/status → CONSULTA DADOS DO PROJETO NEON
// ===========================================================
const neon = new NeonApiClient("napi_6avglq4ox3f2lj4l2m7048cdrsts50pn6wq3xxh8xfjg7lncdxif6v1jym4gy6ob");

app.get("/api/neon/status", async (req, res) => {
  try {
    const projetos = await neon.projects.list();
    if (!projetos.projects.length) return res.status(404).json({ error: "Nenhum projeto encontrado." });

    const projeto = projetos.projects[0];
    const detalhes = await neon.projects.retrieve(projeto.id);

    res.json({
      nome: detalhes.name,
      id: detalhes.id,
      region: detalhes.region_id,
      created_at: detalhes.created_at,
      status: detalhes.provisioner_state,
      branch: detalhes.production_branch?.name || "não informado",
      usage: detalhes.usage_model,
      storage_limit_mb: detalhes.storage_limit_mb,
      store_mb: detalhes.store_mb,
    });
  } catch (err) {
    console.error("Erro ao consultar Neon:", err.message);
    res.status(500).json({ error: "Erro ao consultar dados do Neon." });
  }
});

// ===========================================================
// 6) ROTA CORINGA (404)
// ===========================================================
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// ===========================================================
// 7) INICIA O SERVIDOR
// ===========================================================
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
