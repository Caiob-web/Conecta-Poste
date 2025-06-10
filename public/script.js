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

const todosPostes = [];
const empresasContagem = [];

// Carregamento inicial
const spinner = document.getElementById("carregando");
if (spinner) spinner.style.display = "block";

fetch("/api/postes")
  .then(res => {
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res.json();
  })
  .then(data => {
    console.log("GET /api/postes retornou:", data);
    if (!Array.isArray(data)) {
      console.error("Esperava um array de postes, mas recebi:", data);
      return;
    }

    const agrupado = {};
    data.forEach(poste => {
      if (!poste.coordenadas) return;
      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;
      const key = poste.id_poste;
      if (!agrupado[key]) {
        agrupado[key] = { id_poste: poste.id_poste, coordenadas: poste.coordenadas, empresas: new Set(), lat, lon };
      }
      if (poste.empresa && poste.empresa.toUpperCase() !== "DISPONÍVEL") {
        agrupado[key].empresas.add(poste.empresa);
      }
    });

    Object.values(agrupado).forEach((poste) => {
      const empresasArray = [...poste.empresas];
      empresasArray.forEach((empresa) => {
        empresasContagem[empresa] = (empresasContagem[empresa] || 0) + 1;
      });

      const qtdEmpresas = empresasArray.length;
      const cor = qtdEmpresas >= 5 ? "red" : "green";
      const icone = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
        iconSize: [16,16],
        iconAnchor: [8,8]
      });

      const listaEmpresas = empresasArray.map(e => `<li>${e}</li>`).join("");
      const marker = L.marker([poste.lat, poste.lon], { icon: icone });
      marker.bindPopup(`<b>ID do Poste:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(6)}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`);
      marker.bindTooltip(`ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`, { direction: "top" });
      markers.addLayer(marker);

      todosPostes.push({ ...poste, empresas: empresasArray });
    });

    map.addLayer(markers);
    preencherAutocomplete();

    if (spinner) spinner.style.display = "none";
  })
  .catch(err => {
    console.error("Erro ao buscar postes:", err);
    if (spinner) spinner.style.display = "none";
    alert("Erro ao carregar os dados dos postes.");
  });

function preencherAutocomplete() {
  const lista = document.getElementById("lista-empresas");
  lista.innerHTML = "";
  Object.keys(empresasContagem)
    .sort()
    .forEach((empresa) => {
      const option = document.createElement("option");
      option.value = empresa;
      option.label = `${empresa} (${empresasContagem[empresa]} postes)`;
      lista.appendChild(option);
    });
}
