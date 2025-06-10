// script.js (versão com carregamento BBOX e debug)

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

let todosPostes = [];
const spinner = document.getElementById("carregando");

function carregarPostesPorBBOX() {
  if (spinner) spinner.style.display = "flex";

  const bounds = map.getBounds();
  const url = `/api/postes/bbox?minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLon=${bounds.getWest()}&maxLon=${bounds.getEast()}`;

  console.log("🔍 Carregando BBOX:", url);

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      return res.json();
    })
    .then((data) => {
      console.log("✅ Postes carregados:", data.length);

      markers.clearLayers();
      todosPostes = [];

      const agrupado = {};
      data.forEach((poste) => {
        if (!poste.coordenadas) return;
        const [lat, lon] = poste.coordenadas.split(",").map(Number);
        if (isNaN(lat) || isNaN(lon)) return;
        const key = poste.id_poste;
        if (!agrupado[key]) {
          agrupado[key] = { id_poste: poste.id_poste, coordenadas: poste.coordenadas, lat, lon };
        }
      });

      Object.values(agrupado).forEach((poste) => {
        const cor = "green";
        const icone = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([poste.lat, poste.lon], { icon: icone });
        marker.bindPopup(
          `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(6)}`
        );
        marker.bindTooltip(`ID: ${poste.id_poste}`, { direction: "top" });
        markers.addLayer(marker);

        todosPostes.push(poste);
      });

      map.addLayer(markers);
    })
    .catch((err) => {
      console.error("❌ Erro ao buscar postes:", err);
      alert("Erro ao carregar os dados dos postes.");
    })
    .finally(() => {
      if (spinner) spinner.style.display = "none";
    });
}

map.on("moveend", carregarPostesPorBBOX);

// Carregamento inicial
carregarPostesPorBBOX();
