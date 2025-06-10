// script.js – mapa otimizado com cache IndexedDB, cache em memória,
// geohash global, clusterização Canvas, debounce e handlers de UI.

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
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = e => {
          e.target.result.createObjectStore(storeName, { keyPath: "key" });
        };
      });
    }
    return promise;
  };
})();

// 2) Funções de cache
async function salvarCache(key, dados) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put({ key, timestamp: Date.now(), dados });
}
async function obterCache(key) {
  const db = await getDB();
  return new Promise(resolve => {
    const tx  = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => {
      const r = req.result;
      resolve(r && Date.now() - r.timestamp < CACHE_TTL ? r.dados : null);
    };
    req.onerror = () => resolve(null);
  });
}

// 3) Geohash tile (usa global ngeohash)
function bboxToGeohash(bounds, precision = 6) {
  if (typeof ngeohash === "undefined") {
    console.error("ngeohash não encontrado – verifique o <script>.");
    return null;
  }
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return ngeohash.encode(
    (sw.lat + ne.lat) / 2,
    (sw.lng + ne.lng) / 2,
    precision
  );
}

// 4) Busca ao backend
async function fetchDados(key) {
  const res = await fetch(`/api/postes?tile=${key}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 5) Cache em memória + IndexedDB
async function getDadosParaTile(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
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

// 7) Inicializa mapa e clusters
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
    renderer: L.canvas(),
  });
  map.addLayer(markers);

  let debounceTimer;
  map.on("moveend", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(carregarPostesPorTile, 200);
  });

  async function carregarPostesPorTile() {
    const key = bboxToGeohash(map.getBounds());
    if (!key) return;
    const spinner = document.getElementById("carregando");
    if (spinner) spinner.style.display = "flex";

    try {
      const dados = await getDadosParaTile(key);
      markers.clearLayers();
      const points = dados.map(({ id_poste, lat, lon }) => {
        const m = L.marker([lat, lon], { icon: icone });
        m.bindPopup(`<b>ID:</b> ${id_poste}`);
        return m;
      });
      markers.addLayers(points);
    } catch (e) {
      console.error("Erro ao carregar postes:", e);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  // primeiro carregamento
  carregarPostesPorTile();
})();

// 8) Handlers globais de UI
function localizarUsuario() {
  if (!navigator.geolocation) {
    return alert("Geolocalização não suportada.");
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      map.setView([coords.latitude, coords.longitude], 16, { animate: true });
      L.marker([coords.latitude, coords.longitude], { icon: icone })
        .addTo(markers)
        .bindPopup("Você está aqui")
        .openPopup();
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

// 9) Registra eventos do painel
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("togglePainel")
          .addEventListener("click", () => {
    const p = document.getElementById("painelBusca");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });
  document.getElementById("localizacaoUsuario")
          .addEventListener("click", localizarUsuario);
  document.querySelector('[data-action="buscar-id"]')
          .addEventListener("click", buscarID);
  document.querySelector('[data-action="buscar-coord"]')
          .addEventListener("click", buscarCoordenada);
  document.querySelector('[data-action="filtrar-empresa"]')
          .addEventListener("click", filtrarEmpresa);
  document.querySelector('[data-action="buscar-rua"]')
          .addEventListener("click", buscarPorRua);
  document.querySelector('[data-action="verificar-ids"]')
          .addEventListener("click", consultarIDsEmMassa);
  document.getElementById("btnGerarExcel")
          .addEventListener("click", gerarExcel);
  document.querySelector('[data-action="limpar"]')
          .addEventListener("click", limparTudo);
  document.querySelector('[data-action="gerar-pdf"]')
          .addEventListener("click", gerarPDFComMapa);
  document.querySelector('[data-action="resetar"]')
          .addEventListener("click", resetarMapa);
});
