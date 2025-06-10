// server.js – Express API otimizado para Neon + Vercel

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const ngeohash = require('ngeohash');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
    east: parseFloat(east),
    west: parseFloat(west),
  };
}

module.exports = async (req, res) => {
  try {
    const { north, south, east, west } = parseBboxOrTile(req.query);

    const { rows } = await pool.query(
      `SELECT
         id_poste,
         ROUND((split_part(coordenadas, ',', 1)::numeric), 5) AS lat,
         ROUND((split_part(coordenadas, ',', 2)::numeric), 5) AS lon,
         empresa,
         nome_municipio
       FROM empresa_poste
       WHERE coordenadas IS NOT NULL
         AND split_part(coordenadas, ',', 1)::numeric BETWEEN $1 AND $2
         AND split_part(coordenadas, ',', 2)::numeric BETWEEN $3 AND $4
       LIMIT 5000;`,
      [south, north, west, east]
    );

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar empresas' });
  }
};


