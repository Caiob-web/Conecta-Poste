// 🗺️ MAPA DE POSTES COM FILTRO POR CIDADE (Leaflet + MarkerCluster)

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
          todosPostes.push({ ...poste, lat, lon, empresas: new Set(empresas) });
        });

        map.eachLayer((layer) => {
          if (layer instanceof L.MarkerClusterGroup) map.removeLayer(layer);
        });

        map.addLayer(markers);
        preencherAutocomplete();
      })
      .catch((err) => {
        console.error("Erro ao carregar postes:", err);
      });
  }

  map.on("moveend", carregarPostesVisiveis);
  document.getElementById("nome_municipio").addEventListener("change", carregarPostesVisiveis);
  carregarPostesVisiveis();

  window.buscarID = function () {
    const id = document.getElementById("busca-id").value.trim();
    const resultado = todosPostes.find((p) => p.id_poste.toString() === id);
    if (resultado) {
      map.setView([resultado.lat, resultado.lon], 18);
      L.popup()
        .setLatLng([resultado.lat, resultado.lon])
        .setContent(`<b>ID:</b> ${resultado.id_poste}<br><b>Empresas:</b> ${[...resultado.empresas].join(", ")}`)
        .openOn(map);
    } else {
      alert("Poste não encontrado.");
    }
  }

  window.buscarCoordenada = function () {
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

  window.filtrarEmpresa = function () {
    const termo = document.getElementById("filtro-empresa").value.trim().toLowerCase();
    if (!termo) return;
    markers.clearLayers();

    todosPostes.forEach((poste) => {
      const empresas = Array.from(poste.empresas).map((e) => e.toLowerCase());
      if (!empresas.some((e) => e.includes(termo))) return;

      const qtdEmpresas = empresas.length;
      const cor = qtdEmpresas >= 5 ? "red" : "green";

      const icone = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;"></div>`
      });

      const marker = L.marker([poste.lat, poste.lon], { icon: icone });
      marker.bindPopup(`<b>ID do Poste:</b> ${poste.id_poste}<br><b>Empresas:</b> ${Array.from(poste.empresas).join(", ")}`);
      marker.bindTooltip(`ID: ${poste.id_poste} • ${qtdEmpresas} empresa(s)`, { direction: "top" });
      markers.addLayer(marker);
    });
  }

  window.buscarPorRua = async function () {
    const rua = document.getElementById("busca-rua").value.trim();
    const resumoDiv = document.getElementById("resumo-rua");
    resumoDiv.innerHTML = "";

    if (!rua) {
      resumoDiv.innerHTML = "<span style='color:red;'>Digite o nome da rua.</span>";
      return;
    }

    try {
      const cidade = document.getElementById("nome_municipio").value;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rua)}, ${cidade}, Brasil&limit=1`,
        { headers: { "User-Agent": "poste-mapa-app" } }
      );
      const resultados = await response.json();

      if (!resultados.length) {
        resumoDiv.innerHTML = `<span style='color:red;'>Rua não encontrada: <b>${rua}</b></span>`;
        return;
      }

      const { lat, lon, display_name } = resultados[0];
      map.setView([parseFloat(lat), parseFloat(lon)], 17);

      resumoDiv.innerHTML = `
        <b>Centralizado na rua:</b> ${display_name}<br>
        Coordenadas: ${lat}, ${lon}
      `;
    } catch (error) {
      console.error("Erro ao buscar rua:", error);
      resumoDiv.innerHTML = "<span style='color:red;'>Erro ao buscar rua.</span>";
    }
  }

  window.resetarMapa = function () {
    carregarPostesVisiveis();
  }

  window.limparBusca = function () {
    document.getElementById("busca-id").value = "";
    document.getElementById("busca-coord").value = "";
    document.getElementById("filtro-empresa").value = "";
    document.getElementById("busca-rua").value = "";
    document.getElementById("resumo-rua").innerHTML = "";
    resetarMapa();
  }

  function preencherAutocomplete() {
    const lista = document.getElementById("lista-empresas");
    lista.innerHTML = "";
    Object.entries(empresasContagem).sort().forEach(([empresa, count]) => {
      const option = document.createElement("option");
      option.value = empresa;
      option.label = `${empresa} (${count} postes)`;
      lista.appendChild(option);
    });
  }
});