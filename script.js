const map = L.map('map').setView([-23.2, -45.9], 12);

// Adiciona camada de mapa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Requisição para API de postes
fetch('/api/postes')
  .then(res => res.json())
  .then(data => {
    console.log("Resposta da API:", data);

    // Verifica se o retorno da API é um array
    if (!Array.isArray(data)) {
      console.warn("A resposta da API não é um array:", data);
      alert("Formato de dados inesperado da API.");
      return;
    }

    // Itera sobre cada poste retornado
    data.forEach(poste => {
      if (poste.coordenadas) {
        const [lat, lng] = poste.coordenadas.split(',').map(Number);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Cria marcador no mapa
          L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`
              <strong>ID:</strong> ${poste.id_poste}<br>
              <strong>Bairro:</strong> ${poste.nome_bairro}<br>
              <strong>Logradouro:</strong> ${poste.nome_logradouro}<br>
              <strong>Material:</strong> ${poste.material}<br>
              <strong>Altura:</strong> ${poste.altura} m<br>
              <strong>Tensão Mecânica:</strong> ${poste.tensao_mecanica}
            `);
        }
      }
    });
  })
  .catch(err => {
    console.error("Erro ao carregar postes:", err);
    alert("Erro ao carregar os dados dos postes.");
  });
