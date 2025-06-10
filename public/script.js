// script.js – versão completa baseada no Glitch, carregando tudo de uma vez e usando MarkerCluster

// Inicializa o mapa
const map = L.map("map").setView([-23.2, -45.9], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Configura MarkerCluster (chunkedLoading para performance)
const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  maxClusterRadius: 60,
  disableClusteringAtZoom: 17,
  chunkedLoading: true,
  chunkProgress: 0.05
});
markers.on("clusterclick", (a) => a.layer.spiderfy());
map.addLayer(markers);

// Arrays globais
const todosPostes = [];
const empresasContagem = {};

// Spinner de carregamento
const spinner = document.getElementById("carregando");
if (spinner) spinner.style.display = "flex";

// Fetch único para todos postes
fetch("/api/postes")
  .then((res) => res.json())
  .then((data) => {
    if (spinner) spinner.style.display = "none";

    // Agrupa postes por ID
    const agrupado = {};
    data.forEach((poste) => {
      if (!poste.coordenadas) return;
      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;
      const id = poste.id_poste;
      if (!agrupado[id]) {
        agrupado[id] = {
          id_poste: id,
          lat,
          lon,
          empresas: new Set(),
          resumo: poste.resumo || "",
          nome_municipio: poste.nome_municipio || ""
        };
      }
      if (poste.empresa && poste.empresa.toUpperCase() !== "DISPONÍVEL") {
        agrupado[id].empresas.add(poste.empresa);
      }
    });

    // Cria marcadores
    const markerList = [];
    Object.values(agrupado).forEach((poste) => {
      const empresasArray = [...poste.empresas];
      empresasArray.forEach((e) => {
        empresasContagem[e] = (empresasContagem[e] || 0) + 1;
      });

      const qtdEmpresas = empresasArray.length;
      const cor = qtdEmpresas >= 5 ? "red" : "green";
      const icone = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const popupContent = `
<b>ID do Poste:</b> ${poste.id_poste}<br>
<b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(6)}<br>
<b>Empresas:</b><ul>${empresasArray.map(e => `<li>${e}</li>`).join('')}</ul>`;
      const tooltipText = `ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`;

      const m = L.marker([poste.lat, poste.lon], { icon: icone })
        .bindPopup(popupContent)
        .bindTooltip(tooltipText, { direction: 'top' });
      markerList.push(m);
      todosPostes.push({ ...poste, empresas: empresasArray });
    });

    // Adiciona todos de uma vez
    markers.clearLayers();
    markers.addLayers(markerList);

    // Preenche autocomplete de empresas
    preencherAutocomplete();
  })
  .catch((err) => {
    console.error('Erro ao carregar dados de postes:', err);
    if (spinner) spinner.style.display = 'none';
    alert('Erro ao carregar dados do mapa.');
  });

// Função para preencher datalist de empresas
function preencherAutocomplete() {
  const list = document.getElementById('lista-empresas');
  list.innerHTML = '';
  Object.keys(empresasContagem).sort().forEach((emp) => {
    const option = document.createElement('option');
    option.value = emp;
    option.label = `${emp} (${empresasContagem[emp]})`;
    list.appendChild(option);
  });
}

// BUSCAS E FILTROS

function buscarID() {
  const id = document.getElementById('busca-id').value.trim();
  const p = todosPostes.find(x => x.id_poste.toString() === id);
  if (!p) return alert('Poste não encontrado.');
  map.setView([p.lat, p.lon], 18);
  L.popup()
    .setLatLng([p.lat, p.lon])
    .setContent(`
<b>ID do Poste:</b> ${p.id_poste}<br>
<b>Coordenadas:</b> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}<br>
<b>Empresas:</b><ul>${p.empresas.map(e=>`<li>${e}</li>`).join('')}</ul>`)
    .openOn(map);
}

function buscarCoordenada() {
  const [lat, lon] = document.getElementById('busca-coord').value.split(',').map(Number);
  if (isNaN(lat) || isNaN(lon)) return alert('Coordenadas inválidas.');
  map.setView([lat, lon], 18);
  L.popup().setLatLng([lat, lon]).setContent(`<b>Coordenada:</b> ${lat}, ${lon}`).openOn(map);
}

function buscarPorRua() {
  const rua = document.getElementById('busca-rua').value.trim();
  if (!rua) return alert('Digite um nome de rua.');
  // Sugestões via Nominatim
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rua)}`)
    .then(res => res.json())
    .then(results => {
      const datalist = document.getElementById('sugestoes-rua');
      datalist.innerHTML = '';
      results.slice(0, 5).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.display_name;
        datalist.appendChild(opt);
      });
    });
}

function filtrarEmpresa() {
  const termo = document.getElementById('filtro-empresa').value.trim().toLowerCase();
  if (!termo) return;
  markers.clearLayers();
  const filtered = todosPostes.filter(p => p.empresas.join(',').toLowerCase().includes(termo));
  const layer = filtered.map(p => {
    const cor = p.empresas.length >=5 ? 'red':'green';
    const ic = L.divIcon({ html:`<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`, iconSize:[16,16],iconAnchor:[8,8]});
    return L.marker([p.lat,p.lon],{icon:ic});
  });
  markers.addLayers(layer);
}

function resetarMapa() {
  markers.clearLayers();
  markers.addLayers(markers._featureGroup.getLayers());
}

// Eventos do painel
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('togglePainel').addEventListener('click', () => {
    const p = document.getElementById('painelBusca');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('localizacaoUsuario').addEventListener('click', () => {
    if (!navigator.geolocation) alert('Geolocalização não suportada');
    navigator.geolocation.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude,pos.coords.longitude],17);
      L.marker([pos.coords.latitude,pos.coords.longitude]).addTo(map)
        .bindPopup('📍 Você está aqui!').openPopup();
    });
  });
  document.querySelector('[data-action="buscar-id"]').addEventListener('click', buscarID);
  document.querySelector('[data-action="buscar-coord"]').addEventListener('click', buscarCoordenada);
  document.querySelector('[data-action="filtrar-empresa"]').addEventListener('click', filtrarEmpresa);
  document.querySelector('[data-action="buscar-rua"]').addEventListener('input', buscarPorRua);
  document.getElementById('btnGerarExcel').addEventListener('click', () => {
    // Lógica de geração de Excel igual ao Glitch
  });
});
