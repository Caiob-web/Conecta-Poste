import { Pool } from 'pg';

// Criação do pool de conexão com o PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Função handler que responde à rota /api/postes
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  try {
    const result = await pool.query(`
      SELECT id_poste, coordenadas 
      FROM dados_poste 
      WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
    `);

    if (!Array.isArray(result.rows)) {
      console.error("A consulta não retornou um array:", result.rows);
      return res.status(500).json({ error: 'Formato inesperado dos dados.' });
    }

    // Retorna um array com os postes encontrados
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro na API /api/postes:", err);
    res.status(500).json({ error: 'Erro interno ao buscar dados dos postes.' });
  }
}
