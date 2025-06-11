const map = L.map('map').setView([-23.2, -45.9], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

fetch('/api/postes')
  .then(res => res.json())
  .then(data => {
    console.log("Resposta da API:", data);  // <-- Verifique o que está vindo da API

    if (!Array.isArray(data)) {
      console.warn("A resposta da API não é um array. Verifique o backend.");
      return;  // Evita tentar iterar sobre algo que não é um array
    }

    data.forEach(poste => {
      if (poste.coordenadas) {
        const [lat, lng] = poste.coordenadas.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          L.marker([lat, lng]).addTo(map)
            .bindPopup(`ID: ${poste.id_poste}`);
        }
      }
    });
  })
  .catch(err => {
    console.error("Erro ao carregar postes:", err);
    alert("Erro ao carregar os dados dos postes.");
  });
