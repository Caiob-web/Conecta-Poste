const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const app = express();
const port = process.env.PORT || 3000;

// ==========================================
// 1. MIDDLEWARES
// ==========================================
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 2. CONEXÃO COM O NEON
// ==========================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ==========================================
// 3. CACHE LOCAL PARA OTIMIZAR USO DO NEON
// ==========================================
let cachePostes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const app = express();
const port = process.env.PORT || 3000;

// ==========================================
// 1. MIDDLEWARES
// ==========================================
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 2. CONEXÃO COM O NEON
// ==========================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ==========================================
// 3. CACHE LOCAL PARA OTIMIZAR USO DO NEON
// ==========================================
let cachePostes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

app.get("/api/postes", async (req, res) => {
  const now = Date.now();
  if (cachePostes && now - cacheTimestamp < CACHE_TTL) {
    return res.json(cachePostes);
  }

  try {
    const { rows } = await pool.query(`
      SELECT id_poste, coordenadas, NULL AS empresa
      FROM vw_postes_com_coord
      WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
    `);

    cachePostes = rows;
    cacheTimestamp = now;
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar postes:", err);
    res.status(500).json({ error: "Erro interno ao buscar postes." });
  }
});

// ==========================================
// 4. GERAR RELATÓRIO EXCEL
// ==========================================
app.post("/api/postes/report", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Envie um array de IDs." });
    }

    const { rows } = await pool.query(
      `SELECT id_poste, coordenadas, NULL AS empresa
       FROM vw_postes_com_coord
       WHERE id_poste = ANY($1)`,
      [ids]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Relatório");

    sheet.columns = [
      { header: "ID POSTE", key: "id_poste", width: 15 },
      { header: "EMPRESAS", key: "empresa", width: 30 },
      { header: "COORDENADAS", key: "coordenadas", width: 30 },
    ];

    rows.forEach((r) => {
      sheet.addRow({
        id_poste: r.id_poste,
        empresa: r.empresa || "DISPONÍVEL",
        coordenadas: r.coordenadas,
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

// ==========================================
// 5. ROTA 404
// ==========================================
app.use((req, res) => {
  res.status(404).send("Rota não encontrada.");
});

// ==========================================
// 6. INICIAR SERVIDOR
// ==========================================
app.listen(port, () => {
  console.log(`✅ Servidor rodando na porta ${port}`);
});
