const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const result = await pool.query(`
      SELECT 
        id AS id_poste,
        nome_municipio,
        nome_bairro,
        nome_logradouro,
        material,
        altura,
        tensao_mecanica,
        coordenadas,
        empresa,
        resumo
      FROM dados_poste 
      WHERE coordenadas IS NOT NULL AND coordenadas <> ''
    `);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro na API /api/postes:", err);
    res.status(500).json({ error: "Erro interno ao buscar dados dos postes." });
  }
};
