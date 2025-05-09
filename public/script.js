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
const empresasContagem = {};

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
      agrupado[key].empresas.add(poste.empresa);
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
        `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
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
        `<b>ID:</b> ${resultado.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
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
      `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
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
      `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
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

// Botão de localização
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
          `<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b><ul>${listaEmpresas}</ul>`
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
