// =====================================================================
//  script.js completo com todas as funções + “Gerar Excel”
// =====================================================================

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

// Adiciona o controle do spinner de carregamento
const spinner = document.getElementById("carregando");
if (spinner) spinner.style.display = "block"; // mostra o spinner

// Primeira requisição para carregar dados (você já tinha isso)
fetch("/api/postes")
  .then((res) => res.json())
  .then((data) => {
    // ... (lógica original que você já usava)
    // Ao fim, esconde o spinner
    if (spinner) spinner.style.display = "none";
  })
  .catch((err) => {
    console.error("Aguarde o Carregamento do Aplicativo:", err);
    if (spinner) spinner.style.display = "none";
    alert("Aguarde o Carregamento do Aplicativo.");
  });

// Segunda requisição (agrupa empresas e cria os marcadores)
fetch("/api/postes")
  .then((res) => res.json())
  .then((data) => {
    const agrupado = {};
    data.forEach((poste) => {
      if (!poste.coordenadas) return;
      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;
      const key = poste.id_poste;
      if (!agrupado[key]) {
        agrupado[key] = {
          id_poste: poste.id_poste,
          resumo: poste.resumo,
          nome_municipio: poste.nome_municipio,
          coordenadas: poste.coordenadas,
          empresas: new Set(),
          lat,
          lon,
        };
      }

      // Só adiciona se não for "DISPONÍVEL"
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
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const listaEmpresas = empresasArray.map((e) => `<li>${e}</li>`).join("");
      const marker = L.marker([poste.lat, poste.lon], { icon: icone });
      marker.bindPopup(
        `<b>ID do Poste:</b> ${poste.id_poste}<br>
         <b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(
          6
        )}<br>
         <b>Empresas:</b><ul>${listaEmpresas}</ul>`
      );
      marker.bindTooltip(`ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`, {
        direction: "top",
      });

      markers.addLayer(marker);
      todosPostes.push({ ...poste, empresas: empresasArray });
    });

    map.addLayer(markers);
    preencherAutocomplete();
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
  const resultado = todosPostes.find((p) => p.id_poste.toString() === id);
  if (resultado) {
    map.setView([resultado.lat, resultado.lon], 18);
    const listaEmpresas = resultado.empresas
      .map((e) => `<li>${e}</li>`)
      .join("");
    L.popup()
      .setLatLng([resultado.lat, resultado.lon])
      .setContent(
        `<b>ID do Poste:</b> ${resultado.id_poste}<br>
         <b>Coordenadas:</b> ${resultado.lat.toFixed(
           6
         )}, ${resultado.lon.toFixed(6)}<br>
         <b>Empresas:</b><ul>${listaEmpresas}</ul>`
      )
      .openOn(map);
  } else {
    alert("Poste não encontrado.");
  }
}

function buscarCoordenada() {
  const coordInput = document.getElementById("busca-coord").value.trim();
  const partes = coordInput.split(",");
  if (partes.length !== 2) return alert("Use o formato: lat,lon");
  const lat = parseFloat(partes[0]);
  const lon = parseFloat(partes[1]);
  if (isNaN(lat) || isNaN(lon)) return alert("Coordenadas inválidas.");

  map.setView([lat, lon], 18);
  L.popup()
    .setLatLng([lat, lon])
    .setContent(`<b>Coordenada:</b><br>${lat}, ${lon}`)
    .openOn(map);
}

function buscarPorRua() {
  const rua = document.getElementById("busca-rua").value.trim();
  if (!rua) return alert("Digite um nome de rua.");

  const apiKey = "AIzaSyAGrt7qjnB52KoEmi3tKvOer9fmQ_vMY9Q";
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    rua
  )}&key=${apiKey}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (!data.results || !data.results.length) {
        alert("Endereço não encontrado.");
        return;
      }

      const { lat, lng } = data.results[0].geometry.location;

      const encontrados = todosPostes.filter((p) => {
        if (!p.lat || !p.lon) return false;
        const dx = p.lat - lat;
        const dy = p.lon - lng;
        return Math.sqrt(dx * dx + dy * dy) < 0.001; // ~100m de raio
      });

      if (encontrados.length === 0) {
        alert("Nenhum poste encontrado próximo à rua informada.");
        return;
      }

      markers.clearLayers();

      encontrados.forEach((poste) => {
        const qtdEmpresas = poste.empresas.length;
        const cor = qtdEmpresas >= 5 ? "red" : "green";
        const icone = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const listaEmpresas = poste.empresas
          .map((e) => `<li>${e}</li>`)
          .join("");
        const marker = L.marker([poste.lat, poste.lon], { icon: icone });
        marker.bindPopup(
          `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
        );
        marker.bindTooltip(
          `ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`,
          { direction: "top" }
        );
        markers.addLayer(marker);
      });

      map.setView([lat, lng], 16);
    })
    .catch((err) => {
      console.error("Erro na busca por rua:", err);
      alert("Erro ao buscar rua no Google Maps.");
    });
}

function filtrarEmpresa() {
  const termo = document
    .getElementById("filtro-empresa")
    .value.trim()
    .toLowerCase();
  if (!termo) return;

  markers.clearLayers();

  todosPostes.forEach((poste) => {
    const empresasString = poste.empresas.join(", ").toLowerCase();
    if (!empresasString.includes(termo)) return;

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
    marker.bindPopup(
      `<b>ID do Poste:</b> ${poste.id_poste}<br>
         <b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(
        6
      )}<br>
         <b>Empresas:</b><ul>${listaEmpresas}</ul>`
    );
    marker.bindTooltip(`ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`, {
      direction: "top",
    });
    markers.addLayer(marker);
  });
}

function resetarMapa() {
  markers.clearLayers();
  todosPostes.forEach((poste) => {
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
    marker.bindPopup(
      `<b>ID do Poste:</b> ${poste.id_poste}<br>
         <b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(
        6
      )}<br>
         <b>Empresas:</b><ul>${listaEmpresas}</ul>`
    );
    marker.bindTooltip(`ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`, {
      direction: "top",
    });
    markers.addLayer(marker);
  });
}

// Botão de esconder painel
document.getElementById("togglePainel").addEventListener("click", () => {
  const painel = document.getElementById("painelBusca");
  if (painel.style.display === "none") {
    painel.style.display = "block";
    document.getElementById("togglePainel").textContent = "🙈 Esconder Painel";
  } else {
    painel.style.display = "none";
    document.getElementById("togglePainel").textContent = "👁️ Mostrar Painel";
  }
});

// Botão de localização do usuário
document.getElementById("localizacaoUsuario").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocalização não suportada pelo navegador.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 17);
      L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("📍 Você está aqui!")
        .openPopup();
    },
    (err) => {
      alert("Erro ao buscar localização: " + err.message);
    }
  );
});

// Autocomplete de ruas via Nominatim
document
  .getElementById("busca-rua")
  .addEventListener("input", async function () {
    const termo = this.value.trim();
    if (termo.length < 4) return;

    try {
      const resposta = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          termo
        )}`
      );
      const resultados = await resposta.json();

      const datalist = document.getElementById("sugestoes-rua");
      datalist.innerHTML = "";

      resultados.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.display_name;
        datalist.appendChild(option);
      });
    } catch (erro) {
      console.error("Erro ao sugerir ruas:", erro);
    }
  });

function buscarPorRua() {
  const rua = document.getElementById("busca-rua").value.trim();
  if (!rua) return alert("Digite um nome de rua.");

  fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      rua
    )}`
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.length) {
        alert("Endereço não encontrado.");
        return;
      }

      const { lat, lon } = data[0];

      const encontrados = todosPostes.filter((p) => {
        if (!p.lat || !p.lon) return false;
        const dx = p.lat - lat;
        const dy = p.lon - lon;
        return Math.sqrt(dx * dx + dy * dy) < 0.001; // ~100m de raio
      });

      if (encontrados.length === 0) {
        alert("Nenhum poste encontrado próximo à rua informada.");
        return;
      }

      markers.clearLayers();

      encontrados.forEach((poste) => {
        const qtdEmpresas = poste.empresas.length;
        const cor = qtdEmpresas >= 5 ? "red" : "green";
        const icone = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const listaEmpresas = poste.empresas
          .map((e) => `<li>${e}</li>`)
          .join("");
        const marker = L.marker([poste.lat, poste.lon], { icon: icone });
        marker.bindPopup(
          `<b>ID do Poste:</b> ${poste.id_poste}<br>
           <b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(
            6
          )}<br>
           <b>Empresas:</b><ul>${listaEmpresas}</ul>`
        );
        marker.bindTooltip(
          `ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`,
          { direction: "top" }
        );
        markers.addLayer(marker);
      });

      map.setView([lat, lon], 16);
    })
    .catch((err) => {
      console.error("Erro ao buscar rua:", err);
      alert("Erro na busca de rua.");
    });
}

// Inicia busca por localização e exibe hora e clima
navigator.geolocation.getCurrentPosition(success, error);

function success(position) {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  obterPrevisaoDoTempo(latitude, longitude);
  mostrarHoraLocal();
}

function error(err) {
  console.error("Erro ao obter localização:", err);
}

// Exibe a hora local do dispositivo
function mostrarHoraLocal() {
  const now = new Date();
  const hora = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("hora").textContent = `🕒 ${hora}`;
}

// Atualiza a hora a cada 1 minuto
setInterval(mostrarHoraLocal, 60000);

// Busca previsão do tempo pela API OpenWeather
function obterPrevisaoDoTempo(lat, lon) {
  const API_KEY = "b93c96ebf4fef0c26a0caaacdd063ee0"; // Substitua pela sua chave real
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&lang=pt_br&units=metric&appid=${API_KEY}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const cidade = data.name;
      const temp = data.main.temp.toFixed(1);
      const descricao = data.weather[0].description;
      const icone = data.weather[0].icon;
      const imgIcone = `<img src="https://openweathermap.org/img/wn/${icone}@2x.png" alt="${descricao}" />`;

      document.getElementById(
        "tempo"
      ).innerHTML = `${imgIcone} ${descricao}, ${temp}°C<br>📍 ${cidade}`;
    })
    .catch((err) => {
      console.error("Erro ao buscar clima:", err);
      document.getElementById("tempo").textContent = "Erro ao obter clima.";
    });
}

// Atualiza clima a cada 10 minutos automaticamente
setInterval(() => {
  navigator.geolocation.getCurrentPosition(success, error);
}, 600000); // ✅ agora está correto

// Função principal para consultar múltiplos IDs e traçar no mapa
function consultarIDsEmMassa() {
  const entrada = document.getElementById("ids-multiplos").value;
  const ids = entrada
    .split(/[\s,;]+/)
    .map((id) => id.trim())
    .filter((id) => id);
  if (!ids.length) return alert("Nenhum ID fornecido.");

  markers.clearLayers();
  if (window.tracadoMassivo) map.removeLayer(window.tracadoMassivo);
  if (window.intermediarios) {
    window.intermediarios.forEach((m) => map.removeLayer(m));
    window.intermediarios = [];
  }
  if (window.numeroMarkers) {
    window.numeroMarkers.forEach((m) => map.removeLayer(m));
    window.numeroMarkers = [];
  }

  const encontrados = [];
  const linhaCoords = [];

  ids.forEach((id) => {
    const poste = todosPostes.find((p) => p.id_poste.toString() === id);
    if (poste) encontrados.push(poste);
  });

  if (!encontrados.length)
    return alert("Nenhum poste encontrado com os IDs fornecidos.");

  // Adiciona marcadores numerados para cada poste encontrado
  window.numeroMarkers = [];

  encontrados.forEach((poste, i) => {
    const qtdEmpresas = poste.empresas.length;
    const cor = qtdEmpresas >= 5 ? "red" : "green";

    const icone = L.divIcon({
      className: "",
      html: `<div style="background:${cor};color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;">${
        i + 1
      }</div>`,
    });

    const listaEmpresas = poste.empresas.map((e) => `<li>${e}</li>`).join("");

    const marker = L.marker([poste.lat, poste.lon], { icon: icone });
    marker.bindPopup(
      `<b>ID do Poste:</b> ${
        poste.id_poste
      }<br><b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(
        6
      )}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
    );
    marker.bindTooltip(
      `ID: ${poste.id_poste} • ${
        qtdEmpresas === 0 ? "DISPONÍVEL" : `${qtdEmpresas} ocupações`
      }`,
      { direction: "top" }
    );

    markers.addLayer(marker);
    linhaCoords.push([poste.lat, poste.lon]);
    window.numeroMarkers.push(marker);
  });

  // Postes intermediários (esquecidos)
  window.intermediarios = [];

  for (let i = 0; i < encontrados.length - 1; i++) {
    const a = encontrados[i];
    const b = encontrados[i + 1];
    const distAB = getDistanciaMetros(a.lat, a.lon, b.lat, b.lon);

    if (distAB > 50) {
      const esquecidos = todosPostes.filter((p) => {
        if (!p.lat || !p.lon || ids.includes(p.id_poste.toString()))
          return false;
        const distA = getDistanciaMetros(a.lat, a.lon, p.lat, p.lon);
        const distB = getDistanciaMetros(b.lat, b.lon, p.lat, p.lon);
        return distA + distB <= distAB + 20;
      });

      esquecidos.forEach((poste) => {
        const marker = L.circleMarker([poste.lat, poste.lon], {
          radius: 6,
          color: "gold",
          fillColor: "yellow",
          fillOpacity: 0.8,
        })
          .bindPopup(
            `<b>Poste Intermediário:</b><br>ID: ${poste.id_poste}<br><b>Coordenadas:</b><br>${poste.lat}, ${poste.lon}`
          )
          .addTo(map);
        window.intermediarios.push(marker);
      });
    }
  }

  map.addLayer(markers);
  if (linhaCoords.length >= 2) {
    window.tracadoMassivo = L.polyline(linhaCoords, {
      color: "blue",
      weight: 3,
      dashArray: "4,6",
    }).addTo(map);
    map.fitBounds(L.latLngBounds(linhaCoords));
  } else {
    map.setView([linhaCoords[0][0], linhaCoords[0][1]], 18);
  }

  window.ultimoResumoPostes = {
    total: ids.length,
    disponiveis: encontrados.filter((p) => p.empresas.length <= 4).length,
    ocupados: encontrados.filter((p) => p.empresas.length >= 5).length,
    naoEncontrados: ids.filter(
      (id) => !todosPostes.some((p) => p.id_poste.toString() === id)
    ),
    intermediarios: (window.intermediarios || []).length,
  };
}

// Geração de PDF com resumo e imagem
function gerarPDFComMapa() {
  if (!window.tracadoMassivo) {
    return alert(
      "Você precisa primeiro verificar múltiplos IDs e gerar um traçado."
    );
  }

  leafletImage(map, function (err, canvas) {
    if (err) {
      alert("Erro ao capturar imagem do mapa.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    const imgData = canvas.toDataURL("image/png");

    doc.addImage(imgData, "PNG", 10, 10, 270, 120);

    const resumo = window.ultimoResumoPostes || {
      total: 0,
      disponiveis: 0,
      ocupados: 0,
      naoEncontrados: [],
      intermediarios: 0,
    };

    let y = 140;
    doc.setFontSize(12);
    doc.text(`Resumo da Verificação:`, 10, y);
    doc.text(
      `✔️ Postes Disponíveis (até 4 empresas): ${resumo.disponiveis}`,
      10,
      y + 10
    );
    doc.text(
      `❌ Postes Indisponíveis (5 ou mais empresas): ${resumo.ocupados}`,
      10,
      y + 20
    );
    doc.text(
      `⚠️ IDs não encontrados: ${resumo.naoEncontrados.length}`,
      10,
      y + 30
    );
    doc.text(
      `🟡 Postes intermediários (esquecidos): ${resumo.intermediarios}`,
      10,
      y + 40
    );

    if (resumo.naoEncontrados.length > 0) {
      doc.text(`IDs não encontrados (máx 50):`, 10, y + 55);
      resumo.naoEncontrados.slice(0, 50).forEach((id, i) => {
        doc.text(`- ${id}`, 15, y + 65 + i * 6);
      });
    }

    doc.save("tracado_postes.pdf");
  });
}

// Função para calcular distância em metros entre duas coordenadas
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
  // Limpa marcadores do traçado e intermediários
  if (window.tracadoMassivo) {
    map.removeLayer(window.tracadoMassivo);
    window.tracadoMassivo = null;
  }
  if (window.intermediarios) {
    window.intermediarios.forEach((m) => map.removeLayer(m));
    window.intermediarios = [];
  }

  // Limpa os campos de filtro
  document.getElementById("ids-multiplos").value = "";
  document.getElementById("busca-id").value = "";
  document.getElementById("busca-coord").value = "";
  document.getElementById("filtro-empresa").value = "";
  document.getElementById("busca-rua").value = "";

  // Restaura todos os postes no mapa
  resetarMapa();
}

// =====================================================================
//  BOTÃO “Gerar Excel”
// =====================================================================
document.getElementById("btnGerarExcel").addEventListener("click", () => {
  // 1) Pegar o texto do campo #ids-multiplos
  const entrada = document.getElementById("ids-multiplos").value.trim();
  if (!entrada) {
    alert("Por favor, informe ao menos um ID de poste para gerar o relatório.");
    return;
  }

  // 2) Quebrar o texto em array (por vírgula, espaço ou quebra de linha)
  const idsArray = entrada
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");

  if (idsArray.length === 0) {
    alert("Não foi possível extrair nenhum ID válido.");
    return;
  }

  // 3) Montar payload JSON
  const payload = { ids: idsArray };

  // 4) Fazer requisição ao backend para gerar o XLSX
  fetch("/api/postes/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Se você precisar de algum token de autenticação, insira aqui, por exemplo:
      // "Authorization": "Bearer <seu-token>"
    },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao gerar relatório no servidor.");
      return res.blob();
    })
    .then((blob) => {
      // 5) Criar URL temporária e forçar download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio_postes.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      console.error("Erro ao tentar baixar Excel:", err);
      alert(
        "Ocorreu um erro ao gerar o Excel. Verifique o console para mais detalhes."
      );
    });
});
