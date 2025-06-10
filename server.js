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
app.use(cors());
app.use(express.json());

// Serve arquivos estáticos em /public (index.html, script.js, etc.)
app.use(express.static(path.join(__dirname, "public")));

// ===========================================================
// 2) CONFIGURAÇÃO DOS POOLS PARA CADA CIDADE
// ===========================================================
const pools = {
  dados_poste: new Pool({
    connectionString:
      process.env.DATABASE_URL || "postgresql://neondb_owner:npg_CIxXZ6mF9Oud@ep-dawn-boat-a8zaanby-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false },
  })
};

// ===========================================================
// 3) CACHE PARA /api/postes (GET) – JÁ EXISTENTE
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

// ===========================================================
// 4) NOVA ROTA: POST /api/postes/report → GERA O EXCEL
// ===========================================================
app.post("/api/postes/report", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "Envie um array de IDs no corpo da requisição." });
    }

    const idsNum = ids
      .map((x) => parseInt(x, 10))
      .filter((n) => !isNaN(n));

    if (idsNum.length === 0) {
      return res
        .status(400)
        .json({ error: "Nenhum ID válido encontrado." });
    }

    const resultados = await Promise.all(
      Object.entries(pools).map(async ([cidade, pool]) => {
        const { rows } = await pool.query(
          `
          SELECT
            id_poste,
            empresa,
            coordenadas
          FROM dados_poste
          WHERE coordenadas IS NOT NULL
            AND TRIM(coordenadas) <> ''
            AND id_poste = ANY($1)
        `,
          [idsNum]
        );
        return rows;
      })
    );

    const todosRegistros = resultados.flat();

    if (todosRegistros.length === 0) {
      return res
        .status(404)
        .json({ error: "Nenhum poste encontrado para esses IDs." });
    }

    const mapPorPoste = {};
    todosRegistros.forEach((row) => {
      const { id_poste, empresa, coordenadas } = row;
      if (!mapPorPoste[id_poste]) {
        mapPorPoste[id_poste] = {
          coordenadas,
          empresas: new Set(),
        };
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
      const listaEmpresas = [...info.empresas].join(", ");
      sheet.addRow({
        id_poste: parseInt(id, 10),
        empresas: listaEmpresas,
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
