// api/postes/report.js

import { Pool } from 'pg';
import ExcelJS from 'exceljs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Envie um array de IDs.' });
    }

    const idsNum = ids.map((x) => parseInt(x)).filter((n) => !isNaN(n));

    const { rows } = await pool.query(
      `SELECT id_poste, empresa, coordenadas FROM vw_postes_com_coord WHERE id_poste = ANY($1)`,
      [idsNum]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum poste encontrado.' });
    }

    const map = {};
    rows.forEach(({ id_poste, empresa, coordenadas }) => {
      if (!map[id_poste]) {
        map[id_poste] = { coordenadas, empresas: new Set() };
      }
      if (empresa && empresa.toUpperCase() !== 'DISPONÍVEL') {
        map[id_poste].empresas.add(empresa);
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório de Postes');
    sheet.columns = [
      { header: 'ID POSTE', key: 'id_poste', width: 15 },
      { header: 'EMPRESAS', key: 'empresas', width: 40 },
      { header: 'COORDENADA', key: 'coordenadas', width: 25 },
    ];

    Object.entries(map).forEach(([id, info]) => {
      sheet.addRow({
        id_poste: parseInt(id),
        empresas: [...info.empresas].join(', '),
        coordenadas: info.coordenadas,
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=relatorio_postes.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno ao gerar relatório.' });
  }
}
