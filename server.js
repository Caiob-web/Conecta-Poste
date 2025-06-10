// server.js – Express API otimizado para Neon + Vercel

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const ngeohash = require('ngeohash');

const app = express();
const port = process.env.PORT || 3000;

// 1. MIDDLEWARES
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. POOL NEON
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool.on('error', err => console.error('Pool error', err));

// 3. UTIL: decodifica geohash tile ou usa BBOX direta
function parseBboxOrTile(query) {
  let { north, south, east, west, tile } = query;
  if (tile) {
    const [minLat, minLng, maxLat, maxLng] = ngeohash.decode_bbox(tile);
    south = minLat;
    west = minLng;
    north = maxLat;
    east = maxLng;
  }
  if ([north, south, east, west].some(v => v == null)) {
    throw new Error('BBOX ou tile inválido');
  }
  return {
    north: parseFloat(north),
    south: parseFloat(south),
    east:  parseFloat(east),
    west:  parseFloat(west),
  };
}

// 4. GET /api/postes – aceita ?tile=geohash ou ?north&south&east&west
app.get('/api/postes', async (req, res) => {
  try {
    const { north, south, east, west } = parseBboxOrTile(req.query);
    const { rows } = await pool.query(
      `SELECT
         id_poste,
         ROUND((split_part(coordenadas, ',', 1)::numeric), 5) AS lat,
         ROUND((split_part(coordenadas, ',', 2)::numeric), 5) AS lon
       FROM vw_postes_com_coord
       WHERE coordenadas IS NOT NULL
         AND split_part(coordenadas, ',', 1)::numeric BETWEEN $1 AND $2
         AND split_part(coordenadas, ',', 2)::numeric BETWEEN $3 AND $4
       LIMIT 5000;`,
      [south, north, west, east]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar postes:', err);
    res.status(400).json({ error: err.message });
  }
});

// 5. POST /api/postes/report – gera planilha Excel com id_poste, lat, lon e empresa
app.post('/api/postes/report', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Envie um array de IDs válido.' });
    }

    const { rows } = await pool.query(
      `SELECT
         id_poste,
         ROUND((split_part(coordenadas, ',', 1)::numeric), 5) AS lat,
         ROUND((split_part(coordenadas, ',', 2)::numeric), 5) AS lon,
         COALESCE(empresa, 'DISPONÍVEL') AS empresa
       FROM vw_postes_com_coord
       WHERE id_poste = ANY($1);`,
      [ids]
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ConectaPosteApp';
    const sheet = workbook.addWorksheet('Relatório de Postes');
    sheet.columns = [
      { header: 'ID POSTE',   key: 'id_poste', width: 15 },
      { header: 'EMPRESAS',    key: 'empresa',  width: 30 },
      { header: 'LATITUDE',    key: 'lat',      width: 15 },
      { header: 'LONGITUDE',   key: 'lon',      width: 15 },
    ];
    rows.forEach(r => sheet.addRow(r));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="relatorio_postes.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno ao gerar relatório.' });
  }
});

// 6. Handler 404
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// 7. Inicia o servidor e encerra pool ao sair
app.listen(port, () => console.log(`✅ Servidor rodando na porta ${port}`));
process.on('SIGINT', () => pool.end(() => process.exit()));
process.on('SIGTERM', () => pool.end(() => process.exit()));
