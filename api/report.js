import { Pool } from 'pg';
import ExcelJS from 'exceljs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método não permitido');
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).send('IDs inválidos');

  try {
    const { rows } = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM dados_poste WHERE id_poste = ANY($1)`,
      [ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n))]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Postes');
    sheet.columns = [
      { header: 'ID', key: 'id_poste', width: 10 },
      { header: 'Empresa', key: 'empresa', width: 30 },
      { header: 'Coordenada', key: 'coordenadas', width: 30 },
    ];
    sheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
}
