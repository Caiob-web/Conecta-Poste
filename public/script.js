// Inicializa o mapa
const mapa = L.map("map").setView([-23.5, -46.6], 11);

// Adiciona camada base (mapa)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(mapa);

// LayerGroup para markers
const marcadores = L.layerGroup().addTo(mapa);

// Função que plota os postes no mapa
function plotarPostesNoMapa(dados) {
  marcadores.clearLayers(); // limpa marcadores anteriores

  dados.forEach((poste) => {
    if (!poste.coordenadas) return;

    const [lat, lng] = poste.coordenadas.split(",").map(Number);

    const popup = `
      <strong>ID:</strong> ${poste.id_poste}<br>
      <strong>Empresa:</strong> ${poste.empresa}<br>
      <strong>Rua:</strong> ${poste.resumo}<br>
      <strong>Cidade:</strong> ${poste.nome_municipio}
    `;

    L.marker([lat, lng]).bindPopup(popup).addTo(marcadores);
  });

  if (dados.length > 0) {
    const primeiro = dados[0].coordenadas.split(",").map(Number);
    mapa.setView(primeiro, 15);
  }
}

// 🔍 Botão de busca por rua
document.getElementById("buscarRua").addEventListener("click", async () => {
  const rua = document
    .querySelector('input[placeholder="Buscar por rua"]')
    .value.trim();

  if (!rua) {
    alert("Digite uma rua para buscar.");
    return;
  }

  try {
    const resposta = await fetch(`/api/postes`);
    const dados = await resposta.json();

    const filtrados = dados.filter(
      (p) => p.resumo && p.resumo.toLowerCase().includes(rua.toLowerCase())
    );

    if (filtrados.length === 0) {
      alert("Nenhum poste encontrado para essa rua.");
      return;
    }

    plotarPostesNoMapa(filtrados);
  } catch (erro) {
    console.error("Erro ao buscar postes por rua:", erro);
    alert("Erro ao buscar dados.");
  }
});

// Carrega todos os postes inicialmente (opcional)
(async () => {
  try {
    const resposta = await fetch("/api/postes");
    const dados = await resposta.json();
    plotarPostesNoMapa(dados);
  } catch (e) {
    console.error("Erro ao carregar dados iniciais:", e);
  }
})();
function buscarPorRua() {
  const rua = document.getElementById("busca-rua").value.trim().toLowerCase();
  if (!rua) {
    alert("Digite uma rua para buscar.");
    return;
  }

  markers.clearLayers();

  const encontrados = todosPostes.filter(p =>
    p.resumo && p.resumo.toLowerCase().includes(rua)
  );

  if (encontrados.length === 0) {
    alert("Nenhum poste encontrado para essa rua.");
    return;
  }

  encontrados.forEach((poste) => {
    const qtdEmpresas = poste.empresas.length;
    const cor = qtdEmpresas >= 5 ? "red" : "green";
    const icone = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const listaEmpresas = poste.empresas.map((e) => `<li>${e}</li>`).join("");
    const marker = L.marker([poste.lat, poste.lon], { icon: icone });
    marker.bindPopup(`<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`);
    marker.bindTooltip(`ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`, { direction: "top" });
    markers.addLayer(marker);
  });

  const primeiro = encontrados[0];
  map.setView([primeiro.lat, primeiro.lon], 15);
}
