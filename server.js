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
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===========================================================
// 2) POOL ÚNICO PARA O NEON (via variável de ambiente DATABASE_URL)
// ===========================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===========================================================
// 3) CACHE LOCAL PARA REDUZIR USO DO NEON
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
    const { rows } = await pool.query(`
      SELECT id_poste, empresa, coordenadas
      FROM vw_postes_com_coord
      WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
    `);

    cachePostes = rows;
    cacheTimestamp = now;
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ===========================================================
// 4) ROTA DE RELATÓRIO EXCEL
// ===========================================================
app.post("/api/postes/report", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Envie um array de IDs." });
    }

    const idsNum = ids.map(x => parseInt(x)).filter(n => !isNaN(n));

    const { rows } = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM vw_postes_com_coord WHERE id_poste = ANY($1)`,
      [idsNum]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Nenhum poste encontrado." });
    }

    const map = {};
    rows.forEach(({ id_poste, empresa, coordenadas }) => {
      if (!map[id_poste]) {
        map[id_poste] = { coordenadas, empresas: new Set() };
      }
      if (empresa && empresa.toUpperCase() !== "DISPONÍVEL") {
        map[id_poste].empresas.add(empresa);
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Relatório de Postes");
    sheet.columns = [
      { header: "ID POSTE", key: "id_poste", width: 15 },
      { header: "EMPRESAS", key: "empresas", width: 40 },
      { header: "COORDENADA", key: "coordenadas", width: 25 },
    ];

    Object.entries(map).forEach(([id, info]) => {
      sheet.addRow({
        id_poste: parseInt(id),
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
// 5) ROTA CORINGA 404
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
