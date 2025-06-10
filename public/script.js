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
const todosPostes = new Map();

const spinner = document.getElementById("carregando");
if (spinner) spinner.style.display = "flex";

function carregarPostesPorBBOX() {
  const bounds = map.getBounds();
  const bbox = [
    bounds.getSouth(),
    bounds.getWest(),
    bounds.getNorth(),
    bounds.getEast(),
  ].map((v) => v.toFixed(6)).join(",");

  fetch(`/api/postes?bbox=${bbox}`)
    .then((res) => res.json())
    .then((data) => {
      data.forEach((poste) => {
        if (!poste.coordenadas || todosPostes.has(poste.id_poste)) return;
        const [lat, lon] = poste.coordenadas.split(",").map(Number);
        if (isNaN(lat) || isNaN(lon)) return;

        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            html: `<div style="width:14px;height:14px;border-radius:50%;background:green;border:2px solid white;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        });

        marker.bindPopup(
          `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}`
        );
        marker.bindTooltip(`ID: ${poste.id_poste}`, { direction: "top" });

        todosPostes.set(poste.id_poste, { ...poste, lat, lon });
        markers.addLayer(marker);
      });

      if (spinner) spinner.style.display = "none";
    })
    .catch((err) => {
      console.error("Erro ao carregar postes:", err);
      if (spinner) spinner.style.display = "none";
      alert("Erro ao carregar dados dos postes.");
    });
}

map.on("moveend", carregarPostesPorBBOX);
carregarPostesPorBBOX(); // inicial
