// script.js - otimizando mapa com cache IndexedDB + limite de marcadores

// 1. Inicializa o IndexedDB
let db;
const dbName = "PostesCache";
const storeName = "PostesPorBbox";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject("Erro ao abrir IndexedDB");
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
    request.onupgradeneeded = (e) => {
      db = e.target.result;
      db.createObjectStore(storeName, { keyPath: "key" });
    };
  });
};

const salvarCache = (key, data) => {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.put({ key, timestamp: Date.now(), dados: data });
};

const obterCache = (key) => {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => {
      const resultado = req.result;
      if (resultado && Date.now() - resultado.timestamp < CACHE_TTL) {
        resolve(resultado.dados);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
};

// 2. Utiliza o cache e a BBOX atual para buscar postes
const carregarPostesPorBbox = async (map, markers, todosPostes) => {
  const bounds = map.getBounds();
  const bboxKey = `${bounds.getSouthWest().lat.toFixed(4)},${bounds.getSouthWest().lng.toFixed(4)}|${bounds.getNorthEast().lat.toFixed(4)},${bounds.getNorthEast().lng.toFixed(4)}`;

  const spinner = document.getElementById("carregando");
  if (spinner) spinner.style.display = "flex";

  await openDB();
  let dados = await obterCache(bboxKey);

  if (!dados) {
    const url = `/api/postes?bbox=${bboxKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    dados = await res.json();
    salvarCache(bboxKey, dados);
  }

  markers.clearLayers();
  todosPostes.length = 0;

  const agrupado = {};
  dados.forEach((poste) => {
    if (!poste.coordenadas) return;
    const [lat, lon] = poste.coordenadas.split(",").map(Number);
    if (isNaN(lat) || isNaN(lon)) return;
    agrupado[poste.id_poste] = { id_poste: poste.id_poste, coordenadas: poste.coordenadas, lat, lon };
  });

  let contador = 0;
  for (const poste of Object.values(agrupado)) {
    if (++contador > 1000) break;
    const cor = "green";
    const icone = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    const marker = L.marker([poste.lat, poste.lon], { icon: icone });
    marker.bindPopup(`<b>ID:</b> ${poste.id_poste}`);
    marker.bindTooltip(`ID: ${poste.id_poste}`, { direction: "top" });
    markers.addLayer(marker);
    todosPostes.push(poste);
  }

  map.addLayer(markers);
  if (spinner) spinner.classList.add("esconder");
};

// 3. Inicializa o mapa com cluster e eventos de movimentação
(async () => {
  await openDB();

  const map = L.map("map").setView([-23.2, -45.9], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    maxClusterRadius: 60,
    disableClusteringAtZoom: 17,
  });

  const todosPostes = [];
  map.on("moveend", () => carregarPostesPorBbox(map, markers, todosPostes));

  carregarPostesPorBbox(map, markers, todosPostes);
})();
