import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { minLat, maxLat, minLng, maxLng } = req.query;

  // Se coordenadas não forem passadas, retorna erro
  if (!minLat || !maxLat || !minLng || !maxLng) {
    return res.status(400).json({ error: "Parâmetros de coordenadas inválidos." });
  }

  try {
    const result = await pool.query(
      `SELECT 
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
       WHERE 
         coordenadas IS NOT NULL AND coordenadas <> ''
         AND (string_to_array(coordenadas, ',')[1])::float BETWEEN $1 AND $2
         AND (string_to_array(coordenadas, ',')[2])::float BETWEEN $3 AND $4
       LIMIT 1000`, // limite por bbox
      [minLat, maxLat, minLng, maxLng]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro na API /api/postes:", err);
    res.status(500).json({ error: "Erro interno ao buscar dados dos postes." });
  }
}
