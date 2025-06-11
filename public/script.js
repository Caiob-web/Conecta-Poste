// ==============================
// Inicializa o mapa
// ==============================
const map = L.map('map').setView([-23.2, -45.9], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Cluster opcional (se estiver usando leaflet.markercluster)
// const markers = L.markerClusterGroup();
// map.addLayer(markers);

fetch("/api/postes")
  .then(res => {
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
    return res.json();
  })
  .then(data => {
    console.log("DEBUG resposta da API:", data);

    if (!Array.isArray(data)) throw new Error("Resposta não é array");

    data.forEach(poste => {
      if (!poste.coordenadas || typeof poste.coordenadas !== "string") return;

      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;

      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(`<b>ID:</b> ${poste.id_poste}<br><b>Coord:</b> ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    });

    // Se estiver usando clustering:
    // data.forEach(... L.marker(...).addTo(markers) );
  })
  .catch(err => {
    console.error("Erro ao carregar postes:", err);
    alert("Erro ao carregar os dados dos postes. Verifique o console.");
  });
