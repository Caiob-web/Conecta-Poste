// script.js – mapa otimizado com cache IndexedDB, cache em memória,
// geohash global, clusterização Canvas e debounce.

const dbName    = "PostesCache";
const storeName = "PostesPorTile";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

let db;
const memoryCache = new Map();

// 1) Singleton IndexedDB
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

// 2) Cache no IndexedDB
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

// 3) Chave de tile via geohash (usa global ngeohash)
function bboxToGeohash(bounds, precision = 6) {
  if (typeof ngeohash === 'undefined') {
    console.error('ngeohash não encontrado. Verifique se o script foi carregado corretamente.');
    return null;
  }
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const lat = (sw.lat + ne.lat) / 2;
  const lng = (sw.lng + ne.lng) / 2;
  return ngeohash.encode(lat, lng, precision);
}

// 4) Busca dados no backend
async function fetchDados(key) {
  const res = await fetch(`/api/postes?tile=${key}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 5) Cache em memória + IndexedDB
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

// 6) Ícone padrão
const icone = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;
                   background:green;border:2px solid white;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// 7) Inicialização do mapa
(async () => {
  await getDB();

  window.map = L.map("map").setView([-23.2, -45.9], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  window.markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    maxClusterRadius: 60,
    disableClusteringAtZoom: 17,
    renderer: L.canvas()
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
      const lista = dados.map(({ id_poste, lat, lon }) => {
        const m = L.marker([lat, lon], { icon: icone });
        m.bindPopup(`<b>ID:</b> ${id_poste}`);
        m.bindTooltip(`ID: ${id_poste}`, { direction: "top" });
        return m;
      });
      markers.addLayers(lista);
    } catch (err) {
      console.error("Erro ao carregar postes:", err);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  // primeiro carregamento
  carregarPostesPorTile();
})();

// 8) Handlers globais para botões do painel
window.buscarID = () => console.warn('buscarID ainda não implementada');
window.buscarCoordenada = () => console.warn('buscarCoordenada ainda não implementada');
window.filtrarEmpresa = () => console.warn('filtrarEmpresa ainda não implementada');
window.buscarPorRua = () => console.warn('buscarPorRua ainda não implementada');
window.consultarIDsEmMassa = () => console.warn('consultarIDsEmMassa ainda não implementada');
window.gerarExcel = () => console.warn('gerarExcel ainda não implementada');
window.limparTudo = () => console.warn('limparTudo ainda não implementada');
window.gerarPDFComMapa = () => console.warn('gerarPDFComMapa ainda não implementada');
window.resetarMapa = () => console.warn('resetarMapa ainda não implementada');
