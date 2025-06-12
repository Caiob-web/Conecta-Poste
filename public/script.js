// =====================================================================
//  script.js completo com todas as funções + “Gerar Excel”
//  Atualizado: adiciona coordenadas no popup e tooltip com ID no hover
// =====================================================================

// Inicializa o mapa
const map = L.map("map").setView([-23.2, -45.9], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Configura cluster de marcadores
const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  maxClusterRadius: 60,
  disableClusteringAtZoom: 17,
});
markers.on("clusterclick", (event) => event.layer.spiderfy());

const todosPostes = [];
const empresasContagem = {};

// Overlay de carregamento
document.getElementById("carregando")?.style?.setProperty("display", "flex");

// Carrega dados e esconde spinner
fetch("/api/postes")
  .then((response) => response.json())
  .then((data) => {
    document.getElementById("carregando").style.display = "none";

    const agrupado = {};
    data.forEach((poste) => {
      if (!poste.coordenadas) return;
      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;
      const key = poste.id;

      if (!agrupado[key]) {
        agrupado[key] = {
          ...poste,
          empresas: new Set(),
          lat,
          lon,
        };
      }

      if (poste.empresa && poste.empresa.toUpperCase() !== "DISPONÍVEL") {
        agrupado[key].empresas.add(poste.empresa);
      }
    });

    Object.values(agrupado).forEach((poste) => {
      const empresasArray = [...poste.empresas];
      todosPostes.push({
        ...poste,
        empresas: empresasArray,
      });

      adicionarMarker({ ...poste, empresas: empresasArray });

      empresasArray.forEach((emp) => {
        empresasContagem[emp] = (empresasContagem[emp] || 0) + 1;
      });
    });

    map.addLayer(markers);
    preencherAutocomplete();
  })
  .catch((error) => {
    console.error("Erro ao carregar ou processar dados:", error);
    document.getElementById("carregando").style.display = "none";
    alert("Erro no aplicativo.");
  });

// =====================================================================
//  FUNÇÕES DE INTERAÇÃO COM O MAPA E FILTROS
// =====================================================================

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

function buscarID() {
  const id = document.getElementById("busca-id").value.trim();
  const resultado = todosPostes.find((p) => p.id === id);
  if (!resultado) return alert("Poste não encontrado.");

  map.setView([resultado.lat, resultado.lon], 18);
  abrirPopup(resultado);
}

function buscarCoordenada() {
  const input = document.getElementById("busca-coord").value.trim();
  const [latStr, lonStr] = input.split(",");
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (isNaN(lat) || isNaN(lon)) return alert("Use o formato: lat,lon");

  map.setView([lat, lon], 18);
  L.popup()
    .setLatLng([lat, lon])
    .setContent(`<b>Coordenada:</b> ${lat}, ${lon}`)
    .openOn(map);
}

function buscarPorRua() {
  const rua = document.getElementById("busca-rua").value.trim();
  if (!rua) return alert("Digite um nome de rua.");

  fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      rua
    )}`
  )
    .then((res) => res.json())
    .then((locais) => {
      if (!locais.length) return alert("Endereço não encontrado.");
      const { lat, lon } = locais[0];
      const proximos = todosPostes.filter(
        (p) => Math.hypot(p.lat - lat, p.lon - lon) < 0.001
      );
      if (!proximos.length) return alert("Nenhum poste próximo.");

      markers.clearLayers();
      proximos.forEach(adicionarMarker);
      map.setView([lat, lon], 16);
    })
    .catch(() => alert("Erro ao buscar rua."));
}

function filtrarEmpresa() {
  const termo = document.getElementById("filtro-empresa").value.trim().toLowerCase();
  if (!termo) return;

  markers.clearLayers();
  todosPostes.forEach((p) => {
    if (p.empresas.join(", ").toLowerCase().includes(termo)) {
      adicionarMarker(p);
    }
  });
}

function resetarMapa() {
  markers.clearLayers();
  todosPostes.forEach(adicionarMarker);
}

function adicionarMarker(poste) {
  const cor = poste.empresas.length >= 5 ? "red" : "green";
  const circle = L.circleMarker([poste.lat, poste.lon], {
    radius: 6,
    fillColor: cor,
    color: "#fff",
    weight: 2,
    fillOpacity: 0.8,
  });

  // Tooltip aparece ao passar o mouse
   circle.bindTooltip(
  `ID: ${poste.id} — ${poste.empresas.length} ${poste.empresas.length === 1 ? 'empresa' : 'empresas'}`,
  { direction: 'top', sticky: true }
);
  circle.addTo(markers).on("click", () => abrirPopup(poste));
}

function abrirPopup(poste) {
  // Adiciona coordenadas no conteúdo do popup
  const listaEmpresas = poste.empresas.map((e) => `<li>${e}</li>`).join("");
  const html = `
    <b>ID do Poste:</b> ${poste.id}<br>
    <b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(6)}<br>
    <b>Município:</b> ${poste.nome_municipio}<br>
    <b>Bairro:</b> ${poste.nome_bairro}<br>
    <b>Logradouro:</b> ${poste.nome_logradouro}<br>
    <b>Material:</b> ${poste.material}<br>
    <b>Altura:</b> ${poste.altura}<br>
    <b>Tensão Mecânica:</b> ${poste.tensao_mecanica}<br>
    <b>Empresas:</b><ul>${listaEmpresas}</ul>
  `;

  L.popup().setLatLng([poste.lat, poste.lon]).setContent(html).openOn(map);
}
// Botões de UI
document.getElementById("togglePainel").addEventListener("click", () => {
  const painel = document.getElementById("painelBusca");
  const escondido = painel.style.display === "none";
  painel.style.display = escondido ? "block" : "none";
  document.getElementById("togglePainel").textContent = escondido
    ? "🙈 Esconder Painel"
    : "👁️ Mostrar Painel";
});

document.getElementById("localizacaoUsuario").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Geolocalização não suportada.");

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      map.setView([coords.latitude, coords.longitude], 17);
      L.marker([coords.latitude, coords.longitude])
        .addTo(map)
        .bindPopup("📍 Você está aqui!")
        .openPopup();
    },
    () => alert("Erro ao obter localização.")
  );
});

// =====================================================================
//  Hora e previsão do tempo
// =====================================================================

function mostrarHoraLocal() {
  const now = new Date();
  document.getElementById("hora").textContent =
    "🕒 " +
    now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
setInterval(mostrarHoraLocal, 60000);
mostrarHoraLocal();

function obterPrevisaoDoTempo(lat, lon) {
  const API_KEY = "b93c96ebf4fef0c26a0caaacdd063ee0";
  fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&lang=pt_br&units=metric&appid=${API_KEY}`
  )
    .then((response) => response.json())
    .then((data) => {
      const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
      document.getElementById(
        "tempo"
      ).innerHTML = `<img src="${iconUrl}" alt="${
        data.weather[0].description
      }"/> ${data.weather[0].description}, ${data.main.temp.toFixed(
        1
      )}°C<br>📍 ${data.name}`;
    })
    .catch(() => {
      document.getElementById("tempo").textContent = "Erro ao obter clima.";
    });
}

navigator.geolocation.getCurrentPosition(
  ({ coords }) => obterPrevisaoDoTempo(coords.latitude, coords.longitude),
  () => {}
);

setInterval(() => {
  navigator.geolocation.getCurrentPosition(({ coords }) =>
    obterPrevisaoDoTempo(coords.latitude, coords.longitude)
  );
}, 600000);

// =====================================================================
//  Consulta massiva e geração de relatório Excel
// =====================================================================

function consultarIDsEmMassa() {
  const entrada = document.getElementById("ids-multiplos").value;
  const ids = entrada.split(/[^0-9]+/).filter(Boolean);
  if (!ids.length) return alert("Nenhum ID fornecido.");

  markers.clearLayers();
  window.tracadoMassivo && map.removeLayer(window.tracadoMassivo);
  window.intermediarios?.forEach((m) => map.removeLayer(m));
  window.numeroMarkers = [];

  const encontrados = ids
    .map((id) => todosPostes.find((p) => p.id === id))
    .filter(Boolean);
  const linhaCoords = encontrados.map((p) => [p.lat, p.lon]);

  if (!encontrados.length) return alert("Nenhum poste encontrado.");

  encontrados.forEach((poste, index) => adicionarNumerado(poste, index + 1));

  window.intermediarios = [];
  encontrados.slice(0, -1).forEach((a, i) => {
    const b = encontrados[i + 1];
    const dist = getDistanciaMetros(a.lat, a.lon, b.lat, b.lon);

    if (dist > 50) {
      todosPostes
        .filter((p) => !ids.includes(p.id))
        .filter(
          (p) =>
            getDistanciaMetros(a.lat, a.lon, p.lat, p.lon) +
              getDistanciaMetros(b.lat, b.lon, p.lat, p.lon) <=
            dist + 20
        )
        .forEach((poste) => {
          L.circleMarker([poste.lat, poste.lon], {
            radius: 6,
            color: "gold",
            fillColor: "yellow",
            fillOpacity: 0.8,
          }).addTo(map);
        });
    }
  });

  map.addLayer(markers);

  if (linhaCoords.length >= 2) {
    window.tracadoMassivo = L.polyline(linhaCoords, {
      color: "blue",
      weight: 3,
      dashArray: "4,6",
    }).addTo(map);
    map.fitBounds(L.latLngBounds(linhaCoords));
  } else {
    map.setView(linhaCoords[0], 18);
  }

  window.ultimoResumoPostes = {
    total: ids.length,
    disponiveis: encontrados.filter((p) => p.empresas.length <= 4).length,
    ocupados: encontrados.filter((p) => p.empresas.length >= 5).length,
    naoEncontrados: ids.filter((id) => !todosPostes.some((p) => p.id === id)),
    intermediarios: window.intermediarios.length,
  };
}

function adicionarNumerado(poste, num) {
  const cor = poste.empresas.length >= 5 ? "red" : "green";
  const iconHtml = `<div style="background:${cor};color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;">${num}</div>`;
  const marker = L.marker([poste.lat, poste.lon], {
    icon: L.divIcon({ html: iconHtml }),
  });
  marker.addTo(markers).bindPopup(`
    <b>ID do Poste:</b> ${poste.id}<br>
    <b>Município:</b> ${poste.nome_municipio}<br>
    <b>Logradouro:</b> ${poste.nome_logradouro}<br>
    <b>Material:</b> ${poste.material}<br>
    <b>Altura:</b> ${poste.altura}<br>
    <b>Tensão Mecânica:</b> ${poste.tensao_mecanica}<br>
    <b>Empresas:</b><ul>${poste.empresas
      .map((e) => `<li>${e}</li>`)
      .join("")}</ul>
  `);
  window.numeroMarkers.push(marker);
}

function gerarPDFComMapa() {
  if (!window.tracadoMassivo) return alert("Gere primeiro um traçado.");

  leafletImage(map, (err, canvas) => {
    if (err) return alert("Erro ao capturar imagem.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10, 270, 120);
    const resumo = window.ultimoResumoPostes || {
      disponiveis: 0,
      ocupados: 0,
      naoEncontrados: [],
      intermediarios: 0,
    };
    let y = 140;
    doc.setFontSize(12);
    doc.text(`Resumo da Verificação:`, 10, y);
    doc.text(`✔️ Disponíveis: ${resumo.disponiveis}`, 10, y + 10);
    doc.text(`❌ Indisponíveis: ${resumo.ocupados}`, 10, y + 20);
    doc.text(`⚠️ Não encontrados: ${resumo.naoEncontrados.length}`, 10, y + 30);
    doc.text(`🟡 Intermediários: ${resumo.intermediarios}`, 10, y + 40);
    doc.save("tracado_postes.pdf");
  });
}

function getDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function limparTudo() {
  if (window.tracadoMassivo) {
    map.removeLayer(window.tracadoMassivo);
    window.tracadoMassivo = null;
  }
  window.intermediarios?.forEach((m) => map.removeLayer(m));
  [
    "ids-multiplos",
    "busca-id",
    "busca-coord",
    "filtro-empresa",
    "busca-rua",
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });
  resetarMapa();
}

// Botão Gerar Excel
document.getElementById("btnGerarExcel").addEventListener("click", () => {
  const ids = document
    .getElementById("ids-multiplos")
    .value.split(/[^0-9]+/)
    .filter(Boolean);
  if (!ids.length) return alert("Informe ao menos um ID.");

  fetch("/api/postes/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })
    .then((response) => response.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio_postes.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch((err) => console.error("Erro Excel:", err));
});
