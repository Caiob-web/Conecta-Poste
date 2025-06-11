// (inicializa o mapa)
// ==============================
const map = L.map('map').setView([-23.2, -45.9], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

fetch("/api/postes")
  .then(res => res.json())
  .then(data => {
    console.log("DEBUG resposta da API:", data); // <--- adiciona isso
    if (!Array.isArray(data)) throw new Error("Resposta não é array");
    data.forEach(poste => { ... });
  })
  .catch(err => {
    console.error("Erro ao carregar postes:", err);
    alert("Erro ao carregar os dados dos postes.");
  });
