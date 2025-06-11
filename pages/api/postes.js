import { Pool } from 'pg';

// Pool de conexão com o PostgreSQL (usa variável de ambiente segura)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  try {
    const result = await pool.query(`
  SELECT 
    id,
    nome_bairro,
    nome_logradouro,
    material,
    altura,
    tensao_mecanica,
    coordenadas
  FROM dados_poste
  WHERE coordenadas IS NOT NULL AND TRIM(coordenadas) <> ''
`);


    if (!Array.isArray(result.rows)) {
      console.error("Dados não retornaram como array:", result.rows);
      return res.status(500).json({ error: 'Formato inválido dos dados.' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro na API /api/postes:", err);
    res.status(500).json({ error: 'Erro interno ao buscar dados dos postes.' });
  }
}
