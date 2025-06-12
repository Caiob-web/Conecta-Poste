const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configura pool único
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_CIxXZ6mF9Oud@ep-blue-heart-a8qoih6k-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

// Cache para GET /api/postes
let cachePostes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

// =====================================================================
//  GET /api/postes
// =====================================================================
app.get("/api/postes", async (req, res) => {
  const now = Date.now();
  if (cachePostes && now - cacheTimestamp < CACHE_TTL) {
    return res.json(cachePostes);
  }

  const sql = `
    SELECT
      d.id,
      d.nome_municipio,
      d.nome_bairro,
      d.nome_logradouro,
      d.material,
      d.altura,
      d.tensao_mecanica,
      d.coordenadas,
      ep.empresa
    FROM dados_poste AS d
    LEFT JOIN empresa_poste AS ep
      ON d.id::text = ep.id_poste
    WHERE d.coordenadas IS NOT NULL
      AND TRIM(d.coordenadas) <> ''
  `;

  try {
    const { rows } = await pool.query(sql);
    cachePostes = rows;
    cacheTimestamp = now;
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar dados em /api/postes:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// =====================================================================
//  POST /api/postes/report
// =====================================================================
app.post("/api/postes/report", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Envie um array de IDs no corpo da requisição." });
  }

  const idsClean = ids.map((x) => String(x).trim()).filter((id) => id);
  if (!idsClean.length) {
    return res.status(400).json({ error: "Nenhum ID válido encontrado." });
  }

  const sql = `
    SELECT
      d.id,
      d.nome_municipio,
      d.nome_bairro,
      d.nome_logradouro,
      d.material,
      d.altura,
      d.tensao_mecanica,
      d.coordenadas,
      ep.empresa
    FROM dados_poste AS d
    LEFT JOIN empresa_poste AS ep
      ON d.id::text = ep.id_poste
    WHERE d.coordenadas IS NOT NULL
      AND TRIM(d.coordenadas) <> ''
      AND d.id::text = ANY($1)
  `;

  try {
    const { rows } = await pool.query(sql, [idsClean]);
    if (!rows.length) {
      return res.status(404).json({ error: "Nenhum poste encontrado para esses IDs." });
    }

    const mapPostes = {};
    rows.forEach((r) => {
      if (!mapPostes[r.id]) mapPostes[r.id] = { ...r, empresas: new Set() };
      if (r.empresa) mapPostes[r.id].empresas.add(r.empresa);
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Relatório de Postes");
    sheet.columns = [
      { header: "ID POSTE", key: "id", width: 15 },
      { header: "MUNICÍPIO", key: "nome_municipio", width: 20 },
      { header: "BAIRRO", key: "nome_bairro", width: 25 },
      { header: "LOGRADOURO", key: "nome_logradouro", width: 30 },
      { header: "MATERIAL", key: "material", width: 15 },
      { header: "ALTURA", key: "altura", width: 10 },
      { header: "TENSÃO MECÂNICA", key: "tensao_mecanica", width: 18 },
      { header: "COORDENADAS", key: "coordenadas", width: 30 },
      { header: "EMPRESAS", key: "empresas", width: 40 },
    ];

    Object.values(mapPostes).forEach((info) => {
      sheet.addRow({
        id: info.id,
        nome_municipio: info.nome_municipio,
        nome_bairro: info.nome_bairro,
        nome_logradouro: info.nome_logradouro,
        material: info.material,
        altura: info.altura,
        tensao_mecanica: info.tensao_mecanica,
        coordenadas: info.coordenadas,
        empresas: [...info.empresas].join(", "),
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
  } catch (err) {
    console.error("Erro ao gerar relatório:", err);
    res.status(500).json({ error: "Erro interno ao gerar relatório." });
  }
});

// Coringa
app.use((req, res) => res.status(404).send("Rota não encontrada"));

// Start
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
