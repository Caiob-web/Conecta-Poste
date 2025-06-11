// (opcional: gerar Excel com base em IDs)
// ==============================
import ExcelJS from 'exceljs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { ids } = req.body;
    const { rows } = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM dados_poste WHERE id_poste = ANY($1)`,
      [ids]
    );

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Relatório');
    sheet.columns = [
      { header: 'ID', key: 'id_poste', width: 10 },
      { header: 'Empresa', key: 'empresa', width: 30 },
      { header: 'Coordenadas', key: 'coordenadas', width: 30 },
    ];
    rows.forEach(r => sheet.addRow(r));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
}
