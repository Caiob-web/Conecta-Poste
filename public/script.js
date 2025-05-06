window.addEventListener("DOMContentLoaded", () => {
  const map = L.map("map", { preferCanvas: true }).setView([-23.2, -45.9], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    maxClusterRadius: 60,
    disableClusteringAtZoom: 17,
  });

  const todosPostes = [];
  const empresasContagem = {};

  function carregarPostesVisiveis() {
    const bounds = map.getBounds();
    const bbox = [
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast()
    ].map(coord => coord.toFixed(8)).join(",");

    const cidade = document.getElementById("nome_municipio").value;
    const url = `/api/postes_bbox?bbox=${bbox}&nome_municipio=${encodeURIComponent(cidade)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        markers.clearLayers();
        todosPostes.length = 0;
        Object.keys(empresasContagem).forEach((k) => delete empresasContagem[k]);

        const agrupado = {};
        data.forEach((poste) => {
          if (!poste.coordenadas) return;
          const [lat, lon] = poste.coordenadas.split(",").map(Number);
          if (isNaN(lat) || isNaN(lon)) return;

          const key = poste.id_poste + poste.coordenadas;
          if (!agrupado[key]) {
            agrupado[key] = {
              id_poste: poste.id_poste,
              coordenadas: poste.coordenadas,
              empresas: new Set(),
            };
          }
          agrupado[key].empresas.add(poste.empresa);
        });

        Object.values(agrupado).forEach((poste) => {
          const [lat, lon] = poste.coordenadas.split(",").map(Number);
          const empresas = Array.from(poste.empresas);
          const qtdEmpresas = empresas.length;
          const cor = qtdEmpresas >= 5 ? "red" : "green";

          empresas.forEach((empresa) => {
            if (!empresasContagem[empresa]) empresasContagem[empresa] = 0;
            empresasContagem[empresa]++;
          });

          const icone = L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          const marker = L.marker([lat, lon], { icon: icone });
          marker.bindPopup(
            `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b> ${empresas.join(", ")}`
          );
          marker.bindTooltip(
            `ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`,
            { direction: "top" }
          );

          markers.addLayer(marker);
          todosPostes.push({ ...poste, lat, lon });
        });

        map.eachLayer((layer) => {
          if (layer instanceof L.MarkerClusterGroup) map.removeLayer(layer);
        });

        map.addLayer(markers);
      })
      .catch((err) => {
        console.error("Erro ao carregar postes:", err);
      });
  }

  // Eventos
  map.on("moveend", carregarPostesVisiveis);

  document.getElementById("nome_municipio").addEventListener("change", carregarPostesVisiveis);

  // Inicializa
  carregarPostesVisiveis();
});
