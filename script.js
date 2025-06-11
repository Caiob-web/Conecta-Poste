function carregarPostesPorBBox() {
  const bounds = map.getBounds();
  const params = new URLSearchParams({
    minLat: bounds.getSouth(),
    maxLat: bounds.getNorth(),
    minLng: bounds.getWest(),
    maxLng: bounds.getEast(),
  });

  fetch(`/api/postes?${params.toString()}`)
    .then(res => res.json())
    .then(data => {
      markers.clearLayers();
      todosPostes.length = 0;
      empresasContagem.length = 0;

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
           <b>Coordenadas:</b> ${poste.lat.toFixed(6)}, ${poste.lon.toFixed(6)}<br>
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
    })
    .catch(err => {
      console.error("Erro ao carregar postes por bbox:", err);
      alert("Erro ao carregar dados visíveis.");
    });
}
