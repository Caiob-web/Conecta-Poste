// script.js

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

const todosPostes = [];

const spinner = document.getElementById("carregando");
if (spinner) spinner.style.display = "block";

function carregarPostesPorBBOX() {
  const bounds = map.getBounds();
  const bbox = {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };

  if (spinner) spinner.style.display = "block";
  fetch(`/api/postes?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}`)
    .then(res => {
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res.json();
    })
    .then(data => {
      markers.clearLayers();
      todosPostes.length = 0;

      data.forEach(poste => {
        if (!poste.coordenadas) return;
        const [lat, lon] = poste.coordenadas.split(",").map(Number);
        if (isNaN(lat) || isNaN(lon)) return;

        const cor = "green";
        const icone = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const marker = L.marker([lat, lon], { icon: icone });
        marker.bindPopup(`<b>ID do Poste:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        marker.bindTooltip(`ID: ${poste.id_poste}`, { direction: "top" });
        markers.addLayer(marker);

        todosPostes.push({ id_poste: poste.id_poste, lat, lon });
      });

      map.addLayer(markers);
      if (spinner) spinner.style.display = "none";
    })
    .catch(err => {
      console.error("Erro ao buscar postes:", err);
      if (spinner) spinner.style.display = "none";
      alert("Erro ao carregar os dados dos postes.");
    });
}

map.on("moveend", carregarPostesPorBBOX);
carregarPostesPorBBOX();
