// script.js – Mapa otimizado com cache em IndexedDB, cache em memória, geohash,
// clusterização com Canvas, debounce e payload reduzido.

// **Pré-requisitos**: instale a lib de geohash no seu projeto:
//   npm install ngeohash
// e certifique-se de que seu bundler suporte ES Modules ou inclua via CDN.

import ngeohash from 'ngeohash';

const dbName     = "PostesCache";
const storeName  = "PostesPorTile";
const CACHE_TTL  = 10 * 60 * 1000; // 10 minutos

let db;
const memoryCache = new Map();

// 1. Singleton para abrir o IndexedDB apenas uma vez
const getDB = (() => {
  let promise;
  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          db = req.result;
          resolve(db);
        };
        req.onupgradeneeded = e => {
          const _db = e.target.result;
          _db.createObjectStore(storeName, { keyPath: "key" });
        };
      });
    }
    return promise;
  };
})();

// 2. Funções de cache no IndexedDB
async function salvarCache(key, dados) {
  const database = await getDB();
  const tx = database.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put({ key, timestamp: Date.now(), dados });
}

async function obterCache(key) {
  const database = await getDB();
  return new Promise(resolve => {
    const tx  = database.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => {
      const res = req.result;
      if (res && Date.now() - res.timestamp < CACHE_TTL) {
        resolve(res.dados);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

// 3. Gera chave fixa de tile via geohash (precisão 6)
function bboxToGeohash(bounds, precision = 6) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const lat = (sw.lat + ne.lat) / 2;
  const lng = (sw.lng + ne.lng) / 2;
  return ngeohash.encode(lat, lng, precision);
}

// 4. Busca dados da API (assumindo JSON [{id_poste, lat, lon}, …])
async function fetchDados(key) {
  const res = await fetch(`/api/postes?tile=${key}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 5. Cache em memória + IndexedDB
async function getDadosParaTile(key) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  let dados = await obterCache(key);
  if (!dados) {
    dados = await fetchDados(key);
    await salvarCache(key, dados);
  }
  memoryCache.set(key, dados);
  return dados;
}

// 6. Ícone único (pode parametrizar cor futuramente)
const icone = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;
                   background:green;border:2px solid white;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// 7. Inicialização do mapa e lógica de carregamento
(async () => {
  await getDB();  // abre o IndexedDB

  const map = L.map("map").setView([-23.2, -45.9], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    maxClusterRadius: 60,
    disableClusteringAtZoom: 17,
    renderer: L.canvas()  // Canvas para performance
  });
  map.addLayer(markers);

  let debounceTimeout;
  map.on("moveend", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(carregarPostesPorTile, 200);
  });

  async function carregarPostesPorTile() {
    const bounds = map.getBounds();
    const key    = bboxToGeohash(bounds, 6);
    const spinner = document.getElementById("carregando");
    if (spinner) spinner.style.display = "flex";

    try {
      const dados = await getDadosParaTile(key);
      markers.clearLayers();
      const camada = dados.map(({ id_poste, lat, lon }) => {
        const m = L.marker([lat, lon], { icon: icone });
        m.bindPopup(`<b>ID:</b> ${id_poste}`);
        m.bindTooltip(`ID: ${id_poste}`, { direction: "top" });
        return m;
      });
      markers.addLayers(camada);
    } catch (err) {
      console.error("Erro ao carregar postes:", err);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  // primeiro carregamento
  carregarPostesPorTile();
})();
