
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  const { minLat, maxLat, minLng, maxLng } = req.query;

  if (!minLat || !maxLat || !minLng || !maxLng) {
    return res.status(400).json({ error: "Parâmetros minLat, maxLat, minLng e maxLng são obrigatórios." });
  }

  try {
    const result = await pool.query(`
      SELECT id AS id_poste, resumo, nome_municipio, coordenadas, empresa
      FROM dados_poste
      WHERE coordenadas IS NOT NULL AND coordenadas <> ''
    `);

    const postes = result.rows.filter(p => {
      if (!p.coordenadas.includes(',')) return false;
      const [lat, lng] = p.coordenadas.split(',').map(Number);
      return (
        lat >= parseFloat(minLat) &&
        lat <= parseFloat(maxLat) &&
        lng >= parseFloat(minLng) &&
        lng <= parseFloat(maxLng)
      );
    });

    res.status(200).json(postes);
  } catch (err) {
    console.error("Erro na API /api/postes:", err);
    res.status(500).json({ error: "Erro interno ao buscar dados dos postes." });
  }
}
