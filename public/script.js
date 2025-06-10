const map = L.map("map").setView([-23.2, -45.9], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  maxClusterRadius: 60,
  disableClusteringAtZoom: 17,
});
map.addLayer(markers);

let todosPostes = [];
let bboxAnterior = null;
let carregando = document.getElementById("carregando");

function obterBBOXChave(bounds) {
  return [
    bounds.getSouthWest().lat.toFixed(4),
    bounds.getSouthWest().lng.toFixed(4),
    bounds.getNorthEast().lat.toFixed(4),
    bounds.getNorthEast().lng.toFixed(4),
  ].join(",");
}

async function carregarPostesPorBBOX() {
  const bounds = map.getBounds();
  const bbox = obterBBOXChave(bounds);

  if (bbox === bboxAnterior || map.getZoom() < 14) return; // só carrega se mudou E tiver zoom suficiente

  bboxAnterior = bbox;
  if (carregando) carregando.style.display = "flex";

  try {
    const url = `/api/postes?bbox=${bounds.toBBoxString()}`;
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
    const postes = await resposta.json();

    markers.clearLayers();
    todosPostes = [];

    postes.forEach((poste) => {
      if (!poste.coordenadas) return;
      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;

      const icone = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:green;border:2px solid white;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([lat, lon], { icon: icone });
      marker.bindPopup(
        `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}`
      );
      marker.bindTooltip(`ID: ${poste.id_poste}`, { direction: "top" });
      markers.addLayer(marker);

      todosPostes.push({ ...poste, lat, lon });
    });
  } catch (erro) {
    console.error("Erro ao carregar postes por BBOX:", erro);
  } finally {
    if (carregando) carregando.style.display = "none";
  }
}

// Chamada ao iniciar
map.whenReady(() => {
  carregarPostesPorBBOX();
});

// Chamada ao mover ou aplicar zoom
map.on("moveend", () => {
  carregarPostesPorBBOX();
});
