// api/postes.js

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL) {
    return res.status(200).json(cache);
  }

  try {
    const { rows } = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM vw_postes_com_coord
       WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''`
    );

    cache = rows;
    cacheTimestamp = now;
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar postes:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
