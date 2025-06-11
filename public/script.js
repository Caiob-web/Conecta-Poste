// Inicializa o mapa com Leaflet
const map = L.map("map").setView([-23.2, -45.9], 12);

// Camada base do mapa (OpenStreetMap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Busca os dados da API e adiciona os marcadores
fetch("/api/postes")
  .then((res) => res.json())
  .then((data) => {
    console.log("DEBUG resposta da API:", data);

    if (!Array.isArray(data)) throw new Error("Resposta da API não é um array");

    data.forEach((poste) => {
      if (!poste.coordenadas || typeof poste.coordenadas !== "string") return;

      const [lat, lon] = poste.coordenadas.split(",").map(Number);
      if (isNaN(lat) || isNaN(lon)) return;

      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(
        `<b>ID:</b> ${poste.id_poste}<br><b>Coordenadas:</b> ${lat.toFixed(
          6
        )}, ${lon.toFixed(6)}`
      );
    });
  })
  .catch((err) => {
    console.error("Erro ao carregar postes:", err);
    alert("Erro ao carregar os dados dos postes.");
  });
