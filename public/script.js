// script.js

// Inicializa o mapa
const map = L.map("map").setView([-23.2, -45.9], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  maxClusterRadius: 60,
  disableClusteringAtZoom: 17,
});
markers.on("clusterclick", (a) => a.layer.spiderfy());

map.addLayer(markers);

const todosPostes = [];
let carregando = false;
let cacheCoordenadas = new Set();

const spinner = document.getElementById("carregando");

map.on("moveend", carregarPostesVisiveis);

carregarPostesVisiveis(); // carregar ao iniciar

function carregarPostesVisiveis() {
  if (carregando) return;
  carregando = true;
  if (spinner) spinner.style.display = "flex";

  const bounds = map.getBounds();
  const bbox = [
    bounds.getSouth(),
    bounds.getWest(),
    bounds.getNorth(),
    bounds.getEast()
  ].map(coord => coord.toFixed(6)).join(",");

  fetch(`/api/postes?bbox=${bbox}`)
    .then(res => {
      if (!res.ok) throw new Error(`Erro: ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log("Postes visíveis:", data.length);

      data.forEach(poste => {
        if (!poste.coordenadas) return;
        if (cacheCoordenadas.has(poste.id_poste)) return; // já adicionado

        const [lat, lon] = poste.coordenadas.split(",").map(Number);
        if (isNaN(lat) || isNaN(lon)) return;

        const icone = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:green;border:2px solid white;"></div>`,
          iconSize: [16,16],
          iconAnchor: [8,8]
        });

        const marker = L.marker([lat, lon], { icon: icone });
        marker.bindPopup(`<b>ID do Poste:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        marker.bindTooltip(`ID: ${poste.id_poste}`, { direction: "top" });

        markers.addLayer(marker);
        cacheCoordenadas.add(poste.id_poste);
        todosPostes.push({ id_poste: poste.id_poste, coordenadas: poste.coordenadas });
      });

      if (spinner) spinner.style.display = "none";
      carregando = false;
    })
    .catch(err => {
      console.error("Erro ao carregar postes visíveis:", err);
      if (spinner) spinner.style.display = "none";
      carregando = false;
    });
}
