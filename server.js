const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public")); // frontend estático

// 🔄 Conexão com o Railway
const pool = new Pool({
  connectionString: "postgresql://postgres:quPrARMqWOJYkhbijfypWvulavftgRzQ@hopper.proxy.rlwy.net:22492/railway",
  ssl: { rejectUnauthorized: false },
});

// ✅ Consulta direta à tabela dados_poste
app.get("/api/postes", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM dados_poste");
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// 404 padrão
app.use((req, res) => {
  res.status(404).send("Rota não encontrada");
});

// 🚀 Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
