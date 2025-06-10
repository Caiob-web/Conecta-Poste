// script.js – mapa otimizado com cache IndexedDB, cache em memória,
// BBOX-based cache key, clusterização Canvas com carregamento chunked, sampling, debounce e handlers de UI.

const dbName = "PostesCache";
const storeName = "PostesPorBbox";
const CACHE_TTL = 10 * 60 * 1000;   // 10 minutos
const MIN_ZOOM_TO_LOAD = 12;        // zoom mínimo para mostrar marcadores
const DEBOUNCE_DELAY = 600;         // ms
const MAX_POINTS = 1000;            // máximo de marcadores exibidos

let db;
const memoryCache = new Map();

// 1) IndexedDB singleton
const getDB = (() => {
  let promise;
  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = e => e.target.result.createObjectStore(storeName, { keyPath: "key" });
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
    const tx = database.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => {
      const res = req.result;
      resolve(res && Date.now() - res.timestamp < CACHE_TTL ? res.dados : null);
    };
    req.onerror = () => resolve(null);
  });
}

// 3) Gera chave fixa a partir da BBOX (lat/lon arredondados)
function boundsToKey(bounds, precision = 3) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lat.toFixed(precision)},${sw.lng.toFixed(precision)}|${ne.lat.toFixed(precision)},${ne.lng.toFixed(precision)}`;
}

// 4) Busca dados via BBOX
async function fetchDados(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const url = `/api/postes?north=${ne.lat}&south=${sw.lat}&east=${ne.lng}&west=${sw.lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 5) Cache em memória + IndexedDB
async function getDados(bounds) {
  const key = boundsToKey(bounds);
  if (memoryCache.has(key)) return memoryCache.get(key);
  let dados = await obterCache(key);
  if (!dados) {
    dados = await fetchDados(bounds);
    await salvarCache(key, dados);
  }
  memoryCache.set(key, dados);
  return dados;
}

// 6) Ícone padrão dos marcadores
const icone = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:green;border:2px solid white;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// 7) Inicializa mapa + clusters
(async () => {
  await getDB();
  const map = L.map("map").setView([-23.2, -45.9], MIN_ZOOM_TO_LOAD);
  window.map = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const markers = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 100,
    chunkDelay: 50,
    spiderfyOnMaxZoom: false,
    disableClusteringAtZoom: 17,
    renderer: L.canvas()
  });
  window.markers = markers;
  map.addLayer(markers);

  let debounceTimer, lastKey;
  map.on("moveend zoomend", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadPoints, DEBOUNCE_DELAY);
  });

  async function loadPoints() {
    if (map.getZoom() < MIN_ZOOM_TO_LOAD) {
      markers.clearLayers();
      return;
    }
    const bounds = map.getBounds();
    const key = boundsToKey(bounds);
    if (key === lastKey) return;  // mesma vista
    lastKey = key;

    const spinner = document.getElementById("carregando");
    if (spinner) spinner.style.display = "flex";

    try {
      let dados = await getDados(bounds);
      // Sampling para performance
      if (dados.length > MAX_POINTS) {
        console.warn(`Amostrando ${MAX_POINTS}/${dados.length} pontos`);
        dados = dados.slice(0, MAX_POINTS);
      }

      markers.clearLayers();
      const pontos = dados.map(item => {
        const lat = item.lat ?? parseFloat(item.coordenadas?.split(',')[0]);
        const lon = item.lon ?? parseFloat(item.coordenadas?.split(',')[1]);
        if (isNaN(lat) || isNaN(lon)) return null;
        const m = L.marker([lat, lon], { icon: icone });
        m.bindPopup(`<b>ID:</b> ${item.id_poste}`);
        return m;
      }).filter(Boolean);

      markers.addLayers(pontos);
    } catch (err) {
      console.error("Erro ao carregar postes:", err);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  // initial load
  loadPoints();
})();

// 8) UI Handlers
function localizarUsuario() {
  if (!navigator.geolocation) return alert("Geolocalização não suportada.");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      map.setView([coords.latitude, coords.longitude], 16, { animate: true });
      L.marker([coords.latitude, coords.longitude], { icon: icone })
        .addTo(markers)
        .bindPopup("Você está aqui");
    },
    () => alert("Não foi possível obter localização.")
  );
}
function buscarID()           { console.warn("buscarID não implementado"); }
function buscarCoordenada()   { console.warn("buscarCoordenada não implementado"); }
function filtrarEmpresa()     { console.warn("filtrarEmpresa não implementado"); }
function buscarPorRua()       { console.warn("buscarPorRua não implementado"); }
function consultarIDsEmMassa(){ console.warn("consultarIDsEmMassa não implementado"); }
function gerarExcel()         { console.warn("gerarExcel não implementado"); }
function limparTudo()         { console.warn("limparTudo não implementado"); }
function gerarPDFComMapa()    { console.warn("gerarPDFComMapa não implementado"); }
function resetarMapa()        { console.warn("resetarMapa não implementado"); }

// 9) Event bindings
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("togglePainel").addEventListener("click", () => {
    const p = document.getElementById("painelBusca");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });
  document.getElementById("localizacaoUsuario").addEventListener("click", localizarUsuario);
  document.querySelector('[data-action="buscar-id"]').addEventListener("click", buscarID);
  document.querySelector('[data-action="buscar-coord"]').addEventListener("click", buscarCoordenada);
  document.querySelector('[data-action="filtrar-empresa"]').addEventListener("click", filtrarEmpresa);
  document.querySelector('[data-action="buscar-rua"]').addEventListener("click", buscarPorRua);
  document.querySelector('[data-action="verificar-ids"]').addEventListener("click", consultarIDsEmMassa);
  document.getElementById("btnGerarExcel").addEventListener("click", gerarExcel);
  document.querySelector('[data-action="limpar"]').addEventListener("click", limparTudo);
  document.querySelector('[data-action="gerar-pdf"]').addEventListener("click", gerarPDFComMapa);
  document.querySelector('[data-action="resetar"]').addEventListener("click", resetarMapa);
});
