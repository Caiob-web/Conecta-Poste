const map = L.map('map').setView([-23.2, -45.9], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

fetch('/api/postes')
  .then(res => res.json())
  .then(data => {
    data.forEach(poste => {
      if (poste.coordenadas) {
        const [lat, lng] = poste.coordenadas.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          L.marker([lat, lng]).addTo(map)
            .bindPopup(\`
              <strong>ID:</strong> \${poste.id_poste}<br>
              <strong>Bairro:</strong> \${poste.nome_bairro}<br>
              <strong>Logradouro:</strong> \${poste.nome_logradouro}<br>
              <strong>Material:</strong> \${poste.material}<br>
              <strong>Altura:</strong> \${poste.altura} m<br>
              <strong>Tensão Mecânica:</strong> \${poste.tensao_mecanica}
            \`);
        }
      }
    });
  })
  .catch(err => {
    console.error("Erro ao carregar postes:", err);
    alert("Erro ao carregar os dados dos postes.");
  });
