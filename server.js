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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===========================================================
// 2) CONEXÃO COM NEON (via variável DATABASE_URL)
// ===========================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===========================================================
// 3) CACHE PARA CONSULTAS DE POSTES
// ===========================================================
let cachePostes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

app.get("/api/postes", async (req, res) => {
  const agora = Date.now();
  if (cachePostes && agora - cacheTimestamp < CACHE_TTL) {
    return res.json(cachePostes);
  }

  try {
    const { rows } = await pool.query(`
      SELECT id_poste, coordenadas
      FROM vw_postes_com_coord
      WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
    `);

    cachePostes = rows;
    cacheTimestamp = agora;
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar postes:", err);
    res.status(500).json({ error: "Erro interno ao buscar postes." });
  }
});

// ===========================================================
// 4) GERADOR DE EXCEL COM DADOS DE POSTES
// ===========================================================
app.post("/api/postes/report", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Envie um array de IDs." });
    }

    const idsSanitizados = ids.filter((id) => /^\d+$/.test(id));
    if (idsSanitizados.length === 0) {
      return res.status(400).json({ error: "Nenhum ID válido." });
    }

    const { rows } = await pool.query(
      `SELECT id_poste, coordenadas FROM vw_postes_com_coord WHERE id_poste = ANY($1)`,
      [idsSanitizados]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Relatório de Postes");

    sheet.columns = [
      { header: "ID POSTE", key: "id_poste", width: 20 },
      { header: "COORDENADAS", key: "coordenadas", width: 30 },
    ];

    rows.forEach((poste) => {
      sheet.addRow(poste);
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=relatorio_postes.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    res.status(500).json({ error: "Erro interno ao gerar relatório." });
  }
});

// ===========================================================
// 5) ROTA Fallback
// ===========================================================
app.use((req, res) => {
  res.status(404).send("Rota não encontrada.");
});

// ===========================================================
// 6) INICIAR SERVIDOR
// ===========================================================
app.listen(port, () => {
  console.log(`✅ API rodando na porta ${port}`);
});
