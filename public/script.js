// script.js – mapa otimizado com markercluster + Canvas CircleMarkers

// Configurações
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos
const DEBOUNCE_DELAY = 500;       // ms
const MIN_ZOOM_TO_LOAD = 12;
const MAX_POINTS = 5000;           // limite de pontos por BBOX

let dbKey = 'PostesCache';
const memoryCache = new Map();

// Helpers de cache simples (opcional IndexDB)
async function getCached(key, fetcher) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  const data = await fetcher();
  memoryCache.set(key, data);
  return data;
}

// Gera chave string para BBOX (4 casas)
function boundsKey(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [sw.lat, sw.lng, ne.lat, ne.lng]
    .map(v => v.toFixed(4))
    .join(',');
}

// Busca dados da API para a BBOX
async function fetchPosts(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const url = `/api/postes?north=${ne.lat}&south=${sw.lat}&east=${ne.lng}&west=${sw.lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

// Cria marcador em Canvas usando CircleMarker
function createMarker(lat, lon, id) {
  return L.circleMarker([lat, lon], {
    radius: 4,
    fillColor: 'green',
    fillOpacity: 1,
    stroke: false,
    renderer: L.canvas()
  }).bindPopup(`<b>ID:</b> ${id}`);
}

// Inicialização
(async () => {
  // Mapa
  const map = L.map('map', { preferCanvas: true })
    .setView([-23.2, -45.9], MIN_ZOOM_TO_LOAD);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // MarkerCluster com CanvasMarkers e chunked loading
  const markers = L.markerClusterGroup({
    chunkedLoading: true,
    chunkedLoadingDelay: 50,
    spiderfyOnMaxZoom: false,
    disableClusteringAtZoom: 17,
  });
  map.addLayer(markers);

  let lastKey;
  let timer;

  async function updateMarkers() {
    if (map.getZoom() < MIN_ZOOM_TO_LOAD) {
      markers.clearLayers();
      return;
    }
    const key = boundsKey(map.getBounds());
    if (key === lastKey) return;
    lastKey = key;

    markers.clearLayers();
    const spinner = document.getElementById('carregando');
    if (spinner) spinner.style.display = 'flex';

    try {
      let posts = await getCached(key, () => fetchPosts(map.getBounds()));
      if (posts.length > MAX_POINTS) {
        console.warn(`Limite ${MAX_POINTS}/${posts.length}`);
        posts = posts.slice(0, MAX_POINTS);
      }
      const layerList = posts.map(p => {
        let lat, lon;
        if (p.lat && p.lon) {
          lat = p.lat; lon = p.lon;
        } else if (p.coordenadas) {
          [lat, lon] = p.coordenadas.split(',').map(Number);
        }
        if (isNaN(lat) || isNaN(lon)) return null;
        return createMarker(lat, lon, p.id_poste);
      }).filter(x => x);
      markers.addLayers(layerList);
    } catch (err) {
      console.error('Erro ao carregar posts:', err);
    } finally {
      if (spinner) spinner.style.display = 'none';
    }
  }

  map.on('moveend zoomend', () => {
    clearTimeout(timer);
    timer = setTimeout(updateMarkers, DEBOUNCE_DELAY);
  });

  // Carregar na inicialização
  updateMarkers();
})();

// Handlers UI (igual anterior)
function localizarUsuario() { /*...*/ }
function buscarID() { /*...*/ }
function buscarCoordenada() { /*...*/ }
function filtrarEmpresa() { /*...*/ }
function buscarPorRua() { /*...*/ }
function consultarIDsEmMassa() { /*...*/ }
function gerarExcel() { /*...*/ }
function limparTudo() { /*...*/ }
function gerarPDFComMapa() { /*...*/ }
function resetarMapa() { /*...*/ }

// Registrar UI events...
