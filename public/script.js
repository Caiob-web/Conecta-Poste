// Inicializa o mapa
const mapa = L.map("map").setView([-23.5, -46.6], 11);

// Camada base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(mapa);

// Layer para marcadores
const marcadores = L.layerGroup().addTo(mapa);

// Array para armazenar todos os postes
let todosPostes = [];

// Distância entre 2 coordenadas (Haversine)
function getDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const φ1 = lat1 * rad;
  const φ2 = lat2 * rad;
  const Δφ = (lat2 - lat1) * rad;
  const Δλ = (lon2 - lon1) * rad;

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Plota postes no mapa
function plotarPostesNoMapa(dados) {
  marcadores.clearLayers();

  dados.forEach((poste) => {
    if (!poste.coordenadas) return;
    const [lat, lng] = poste.coordenadas.split(",").map(Number);

    const popup = `
      <strong>ID:</strong> ${poste.id_poste}<br>
      <strong>Empresa:</strong> ${poste.empresa}<br>
      <strong>Cidade:</strong> ${poste.nome_municipio}
    `;

    L.marker([lat, lng]).bindPopup(popup).addTo(marcadores);
  });

  if (dados.length > 0) {
    const [lat, lng] = dados[0].coordenadas.split(",").map(Number);
    mapa.setView([lat, lng], 15);
  }
}

// Busca por rua via Nominatim + filtro por distância
async function buscarPorRua() {
  const ruaBusca = document.getElementById("busca-rua").value.trim();
  if (!ruaBusca) {
    alert("Digite uma rua.");
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ruaBusca)}`;
  const resposta = await fetch(url);
  const resultados = await resposta.json();

  if (!resultados.length) {
    alert("Rua não encontrada.");
    return;
  }

  const { lat, lon } = resultados[0];

  const encontrados = todosPostes.filter(p => {
    if (!p.coordenadas) return false;
    const [plat, plon] = p.coordenadas.split(",").map(Number);
    const distancia = getDistanciaMetros(lat, lon, plat, plon);
    return distancia <= 100; // até 100 metros
  });

  if (encontrados.length === 0) {
    alert("Nenhum poste encontrado próximo a essa rua.");
    return;
  }

  marcadores.clearLayers();

  encontrados.forEach((poste) => {
    const [plat, plon] = poste.coordenadas.split(",").map(Number);
    const icone = L.divIcon({
      className: "",
      html: `<div style="
