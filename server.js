// server.js – Express API otimizado para Neon + Vercel

const express = require('express');
const cors = require('cors');
const path = require('path');
import { Pool } from 'pg';
import ngeohash from 'ngeohash';

// Reuso de pool entre invocações serverless
let pool;
if (!global._neonPool) {
  global._neonPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}
pool = global._neonPool;

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

export default async function handler(req, res) {
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
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Erro Neon (empresas):', err);
    return res.status(500).json({ error: err.message });
  }
}


// File: /api/postes.js
import { Pool } from 'pg';

// Reuso de pool entre invocações serverless
let pool;
if (!global._neonPool) {
  global._neonPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}
pool = global._neonPool;

export default async function handler(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         id_poste,
         ROUND((split_part(coordenadas, ',', 1)::numeric), 6) AS lat,
         ROUND((split_part(coordenadas, ',', 2)::numeric), 6) AS lon,
         empresa,
         nome_municipio
       FROM empresa_poste
       WHERE coordenadas IS NOT NULL
       LIMIT 20000;`
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Erro Neon (postes):', err);
    return res.status(500).json({ error: err.message });
  }
}


// File: script.js – front-end atualizado
// Inicializa o mapa
const map = L.map("map").setView([-23.2, -45.9], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Configura MarkerCluster
const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  maxClusterRadius: 60,
  disableClusteringAtZoom: 17,
  chunkedLoading: true,
  chunkInterval: 200,
  chunkDelay: 50
});
markers.on("clusterclick", (a) => a.layer.spiderfy());
map.addLayer(markers);

// Variáveis globais
const todosPostes = [];
let empresasContagem = {};
const spinner = document.getElementById("carregando");
if (spinner) spinner.style.display = "flex";

// Carregamento inicial de todos os postes
fetch("/api/postes")
  .then(res => {
    if (!res.ok) throw new Error(`Status ${res.status}: ${res.statusText}`);
    return res.json();
  })
  .then(data => {
    if (spinner) spinner.style.display = 'none';
    processarDadosPostes(data);
    preencherAutocomplete();
  })
  .catch(err => {
    console.error('Erro ao carregar dados de postes:', err);
    if (spinner) spinner.style.display = 'none';
    alert('Erro ao carregar dados do mapa.');
  });

// Processa dados (usado no inicial e no moveend)
function processarDadosPostes(data) {
  const agrupado = {};
  data.forEach(poste => {
    if (poste.lat == null || poste.lon == null) return;
    const id = poste.id_poste;
    if (!agrupado[id]) {
      agrupado[id] = { ...poste, empresas: new Set() };
    }
    if (poste.empresa && poste.empresa.toUpperCase() !== 'DISPONÍVEL') {
      agrupado[id].empresas.add(poste.empresa);
    }
  });

  const markerList = [];
  Object.values(agrupado).forEach(poste => {
    const empresasArray = [...poste.empresas];
    empresasArray.forEach(e => {
      empresasContagem[e] = (empresasContagem[e] || 0) + 1;
    });
    const cor = empresasArray.length >= 5 ? 'red' : 'green';
    const icone = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8]
    });
    const popup = `
<b>ID do Poste:</b> ${poste.id_poste}<br>
<b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(6)}<br>
<b>Empresas:</b><ul>${empresasArray.map(e=>`<li>${e}</li>`).join('')}</ul>`;
    const m = L.marker([poste.lat, poste.lon], { icon: icone })
      .bindPopup(popup)
      .bindTooltip(`ID: ${poste.id_poste} • ${empresasArray.length} empresa(s)`, { direction: 'top' });
    markerList.push(m);
    todosPostes.push({ ...poste, empresas: empresasArray });
  });
  markers.clearLayers();
  markers.addLayers(markerList);
}

// Atualiza dados ao mover o mapa
map.on("moveend", () => {
  const b = map.getBounds();
  const url = `/api/empresas?north=${b.getNorth()}&south=${b.getSouth()}&east=${b.getEast()}&west=${b.getWest()}`;
  fetch(url)
    .then(res => {
      if (!res.ok) return res.text().then(txt => { throw new Error(`Erro ${res.status}: ${txt}`); });
      return res.json();
    })
    .then(data => {
      empresasContagem = {};
      todosPostes.length = 0;
      processarDadosPostes(data);
      preencherAutocomplete();
    })
    .catch(err => {
      console.error('Erro ao buscar empresas:', err);
      alert('Não foi possível carregar dados das empresas.');
    });
});

// Preenche autocomplete de empresas
function preencherAutocomplete() {
  const list = document.getElementById('lista-empresas');
  if (!list) return;
  list.innerHTML = '';
  Object.keys(empresasContagem).sort().forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp;
    opt.label = `${emp} (${empresasContagem[emp]})`;
    list.appendChild(opt);
  });
}

// Buscas, filtros e eventos de DOM permanecem iguais…
