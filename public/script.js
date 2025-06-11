// (inicializa o mapa)
// ==============================
const map = L.map('map').setView([-23.2, -45.9], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

fetch('/api/postes')
  .then(res => res.json())
  .then(data => {
    data.forEach(p => {
      if (!p.coordenadas) return;
      const [lat, lon] = p.coordenadas.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        L.marker([lat, lon]).addTo(map).bindPopup(`ID: ${p.id_poste}`);
      }
    });
  });
