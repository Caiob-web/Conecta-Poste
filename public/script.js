const map = L.map('map').setView([-23.2, -45.9], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const markers = L.markerClusterGroup();
map.addLayer(markers);

function carregarPostes() {
  const bounds = map.getBounds();
  const url = `/api/postes?minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLng=${bounds.getWest()}&maxLng=${bounds.getEast()}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
      return res.json();
    })
    .then(data => {
      markers.clearLayers();

      data.forEach(poste => {
        if (!poste.coordenadas) return;
        const [lat, lng] = poste.coordenadas.split(',').map(coord => parseFloat(coord));
        if (isNaN(lat) || isNaN(lng)) return;

        const marker = L.marker([lat, lng]);
        marker.bindPopup(`
          <strong>ID:</strong> ${poste.id_poste}<br>
          <strong>Logradouro:</strong> ${poste.nome_logradouro}<br>
          <strong>Bairro:</strong> ${poste.nome_bairro}<br>
          <strong>Material:</strong> ${poste.material}<br>
          <strong>Altura:</strong> ${poste.altura} m<br>
          <strong>Tensão Mecânica:</strong> ${poste.tensao_mecanica}
        `);

        markers.addLayer(marker);
      });
    })
    .catch(err => {
      console.error("Erro ao carregar postes:", err);
      alert("Erro ao carregar os dados dos postes.");
    });
}

// Carrega inicialmente
map.on('load', carregarPostes);
map.on('moveend', carregarPostes);
map.fire('load');
