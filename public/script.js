// script.js – versão otimizada baseada no código do Glitch

// 1) Inicialização do mapa e cluster
const map = L.map('map', { preferCanvas: true }).setView([-23.2, -45.9], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  maxClusterRadius: 60,
  disableClusteringAtZoom: 17,
  chunkedLoading: true,
  chunkProgress: 0.1
});
markers.on('clusterclick', e => e.layer.spiderfy());
map.addLayer(markers);

// 2) Variáveis globais
const todosPostes = [];
const empresasContagem = {};
const spinner = document.getElementById('carregando');
if (spinner) spinner.style.display = 'flex';

// 3) Fetch único de dados de postes
fetch('/api/postes')
  .then(res => res.json())
  .then(data => {
    if (spinner) spinner.style.display = 'none';
    const agrupado = {};
    data.forEach(poste => {
      if (!poste.coordenadas) return;
      const [lat, lon] = poste.coordenadas.split(',').map(Number);
      if (isNaN(lat) || isNaN(lon)) return;
      const id = poste.id_poste;
      if (!agrupado[id]) {
        agrupado[id] = { ...poste, lat, lon, empresas: new Set() };
      }
      if (poste.empresa && poste.empresa.toUpperCase() !== 'DISPONÍVEL') {
        agrupado[id].empresas.add(poste.empresa);
      }
    });

    // Construção de marcadores em lote
    const markerList = [];
    Object.values(agrupado).forEach(poste => {
      const empresasArray = Array.from(poste.empresas);
      empresasArray.forEach(e => {
        empresasContagem[e] = (empresasContagem[e] || 0) + 1;
      });

      const qtd = empresasArray.length;
      const cor = qtd >= 5 ? 'red' : 'green';
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>\`,
        iconSize: [16,16], iconAnchor: [8,8]
      });

      const popup = `
<b>ID do Poste:</b> ${poste.id_poste}<br>
<b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>
<b>Empresas:</b><ul>${empresasArray.map(e=>`<li>${e}</li>`).join('')}</ul>`;
      const tooltip = `ID: ${poste.id_poste} • ${qtd} empresa(s)`;

      const m = L.marker([poste.lat, poste.lon], { icon })
        .bindPopup(popup)
        .bindTooltip(tooltip, { direction: 'top' });
      markerList.push(m);
      todosPostes.push({ ...poste, empresas: empresasArray });
    });

    markers.clearLayers();
    markers.addLayers(markerList);
    preencherAutocomplete();
  })
  .catch(err => {
    console.error('Erro ao carregar dados de postes:', err);
    if (spinner) spinner.style.display = 'none';
    alert('Erro ao carregar dados do mapa.');
  });

// 4) Preencher autocomplete de empresas
function preencherAutocomplete() {
  const datalist = document.getElementById('lista-empresas');
  datalist.innerHTML = '';
  Object.keys(empresasContagem).sort().forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp;
    opt.label = `${emp} (${empresasContagem[emp]})`;
    datalist.appendChild(opt);
  });
}

// 5) Funções de busca e filtros
function buscarID() {
  const id = document.getElementById('busca-id').value.trim();
  const p = todosPostes.find(x=>x.id_poste.toString()===id);
  if (!p) return alert('Poste não encontrado.');
  map.setView([p.lat,p.lon],18);
  L.popup()
    .setLatLng([p.lat,p.lon])
    .setContent(`<b>ID do Poste:</b> ${p.id_poste}<br>
<b>Coordenadas:</b> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}<br>
<b>Empresas:</b><ul>${p.empresas.map(e=>`<li>${e}</li>`).join('')}</ul>`)
    .openOn(map);
}

function buscarCoordenada() {
  const [lat,lon] = document.getElementById('busca-coord').value.split(',').map(Number);
  if (isNaN(lat)||isNaN(lon)) return alert('Coordenadas inválidas.');
  map.setView([lat,lon],18);
  L.popup().setLatLng([lat,lon]).setContent(`<b>Coordenada:</b> ${lat},${lon}`).openOn(map);
}

function filtrarEmpresa() {
  const termo = document.getElementById('filtro-empresa').value.trim().toLowerCase();
  if (!termo) return;
  markers.clearLayers();
  const list = todosPostes.filter(p=>p.empresas.join(',').toLowerCase().includes(termo));
  const mList = list.map(p=> L.marker([p.lat,p.lon],{icon:markers.options.iconCreateFunction?.()}));
  markers.addLayers(mList);
}

function resetarMapa() {
  markers.clearLayers();
  markers.addLayers(markers._featureGroup.getLayers());
}

// 6) Botões extras (ID em massa, PDF, Excel, localização, autocomplete de rua, tempo/hora)
// ... implementar conforme Glitch original (sem alterações significativas) ...

// Registrar eventos do painel
window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('togglePainel').addEventListener('click',()=>{
    const p=document.getElementById('painelBusca');
    p.style.display=p.style.display==='none'?'block':'none';
  });
  document.getElementById('localizacaoUsuario').addEventListener('click',()=>{
    if (!navigator.geolocation) return alert('Não suportado');
    navigator.geolocation.getCurrentPosition(pos=>{
      map.setView([pos.coords.latitude,pos.coords.longitude],17);
      L.marker([pos.coords.latitude,pos.coords.longitude]).addTo(map).bindPopup('📍 Você está aqui!').openPopup();
    });
  });
  document.querySelector('[data-action="buscar-id"]').addEventListener('click',buscarID);
  document.querySelector('[data-action="buscar-coord"]').addEventListener('click',buscarCoordenada);
  document.querySelector('[data-action="filtrar-empresa"]').addEventListener('click',filtrarEmpresa);
  document.getElementById('btnGerarExcel').addEventListener('click',()=>{/* Excel logic */});
});
