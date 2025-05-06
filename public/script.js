// 🗺️ MAPA DE POSTES COM FILTRO POR CIDADE (Leaflet + MarkerCluster)

const map = L.map("map", { preferCanvas: true }).setView([-23.2, -45.9], 12);
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
const empresasContagem = {};

function carregarPostesPorCidade(cidade) {
  fetch(`/api/postes?nome_municipio=${encodeURIComponent(cidade)}`)
    .then((res) => res.json())
    .then((data) => {
      // Limpa marcadores e arrays
      markers.clearLayers();
      todosPostes.length = 0;
      Object.keys(empresasContagem).forEach((k) => delete empresasContagem[k]);

      data.forEach((poste) => {
        if (!poste.coordenadas) return;
        const [lat, lon] = poste.coordenadas.split(",").map(Number);
        if (isNaN(lat) || isNaN(lon)) return;

        const empresas = poste.empresas.split(",").map((e) => e.trim());
        empresas.forEach((empresa) => {
          if (!empresasContagem[empresa]) empresasContagem[empresa] = 0;
          empresasContagem[empresa]++;
        });

        const qtdEmpresas = empresas.length;
        const cor = qtdEmpresas >= 5 ? "red" : "green";

        const icone = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([lat, lon], { icon: icone });
        marker.bindPopup(
          `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b> ${poste.empresas}`
        );
        marker.bindTooltip(
          `ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`,
          { direction: "top" }
        );
        markers.addLayer(marker);
        todosPostes.push({ ...poste, lat, lon });
      });

      map.addLayer(markers);
      preencherAutocomplete();
    })
    .catch((err) => {
      console.error("Erro ao carregar postes:", err);
    });
}

// Inicializa com a cidade selecionada no dropdown
carregarPostesPorCidade(document.getElementById("nome_municipio").value);

document.getElementById("nome_municipio").addEventListener("change", function () {
  carregarPostesPorCidade(this.value);
});
