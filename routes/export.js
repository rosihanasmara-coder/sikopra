const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = require('docx');

function getShuData(db, tahun) {
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  let where = '';
  const args = [];
  if (tahun) { where = ' AND tahun_buku=?'; args.push(tahun); }

  const komponenShu = db.prepare('SELECT * FROM shu_komponen WHERE aktif=1 ORDER BY urutan, id').all();
  const totalJasa = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='jasa_pinjaman'${where}`).get(...args).t;
  const totalSimpananSemua = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan').get().t;

  const kompPeminjam = komponenShu.filter(k => k.tipe === 'anggota_peminjam');
  const kompSimpanan = komponenShu.filter(k => k.tipe === 'anggota_simpanan');

  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota ORDER BY nomor_anggota').all();

  const rows = anggotaList.map((a, i) => {
    const jasaPinjaman = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE anggota_id=? AND jenis='jasa_pinjaman'${where}`).get(a.id, ...args).t;
    const totalSimpanan = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=?').get(a.id).t;
    const tabungan = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'").get(a.id).t;

    const shuPinjaman = kompPeminjam.reduce((sum, k) => {
      const nominal = totalJasa * (k.persentase / 100);
      return sum + (totalJasa > 0 ? (jasaPinjaman / totalJasa) * nominal : 0);
    }, 0);
    const shuSimpanan = kompSimpanan.reduce((sum, k) => {
      const nominal = totalJasa * (k.persentase / 100);
      return sum + (totalSimpananSemua > 0 ? (totalSimpanan / totalSimpananSemua) * nominal : 0);
    }, 0);
    const shuDibagi = shuPinjaman + shuSimpanan;
    const shuPluTabungan = shuDibagi + tabungan;
    const pembulatan = Math.round(shuPluTabungan / 500) * 500;

    return {
      no: i + 1,
      nama: a.nama,
      jasa_pinjaman: jasaPinjaman,
      jumlah_simpanan: totalSimpanan,
      shu_pinjaman: Math.round(shuPinjaman),
      shu_simpanan: Math.round(shuSimpanan),
      shu_dibagi: Math.round(shuDibagi),
      shu_plus_tabungan: Math.round(shuPluTabungan),
      pembulatan,
    };
  });

  const total = {
    jasa_pinjaman: rows.reduce((s, r) => s + r.jasa_pinjaman, 0),
    jumlah_simpanan: rows.reduce((s, r) => s + r.jumlah_simpanan, 0),
    shu_pinjaman: rows.reduce((s, r) => s + r.shu_pinjaman, 0),
    shu_simpanan: rows.reduce((s, r) => s + r.shu_simpanan, 0),
    shu_dibagi: rows.reduce((s, r) => s + r.shu_dibagi, 0),
    shu_plus_tabungan: rows.reduce((s, r) => s + r.shu_plus_tabungan, 0),
    pembulatan: rows.reduce((s, r) => s + r.pembulatan, 0),
  };

  return { param, rows, total, tahun };
}

// ─── XLSX Export ─────────────────────────────────────────────────────────────
router.get('/shu/xlsx', (req, res) => {
  const db = req.app.locals.db;
  const tahun = req.query.tahun || '';
  const { param, rows, total } = getShuData(db, tahun);
  const namaKoperasi = param.nama_koperasi || 'Koperasi Warga RT 05';

  const wb = XLSX.utils.book_new();
  const wsData = [];

  // Header
  wsData.push([namaKoperasi]);
  wsData.push(['Perhitungan Distribusi SHU' + (tahun ? ` Tahun ${tahun}` : '')]);
  wsData.push([]);
  wsData.push([
    'No.', 'Nama Anggota', 'Jasa Pinjaman',
    'Jumlah Simpanan\n(Pokok+Wajib+Tabungan)',
    'SHU Atas\nJasa Pinjaman', 'SHU Atas\nJasa Simpanan',
    'SHU di\nBagikan', 'SHU +\nTabungan', 'Pembulatan', 'TTD'
  ]);

  // Data rows
  rows.forEach(r => {
    wsData.push([
      r.no, r.nama,
      r.jasa_pinjaman || '-',
      r.jumlah_simpanan,
      r.shu_pinjaman || '-',
      r.shu_simpanan,
      r.shu_dibagi,
      r.shu_plus_tabungan,
      r.pembulatan,
      ''
    ]);
  });

  // Total
  wsData.push([]);
  wsData.push([
    '', 'TOTAL',
    total.jasa_pinjaman,
    total.jumlah_simpanan,
    total.shu_pinjaman,
    total.shu_simpanan,
    total.shu_dibagi,
    total.shu_plus_tabungan,
    total.pembulatan,
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 22 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 8 }
  ];

  // Merge title rows
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Laporan SHU');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `Laporan_SHU${tahun ? '_' + tahun : ''}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ─── DOCX Export ─────────────────────────────────────────────────────────────
router.get('/shu/docx', async (req, res) => {
  const db = req.app.locals.db;
  const tahun = req.query.tahun || '';
  const { param, rows, total } = getShuData(db, tahun);
  const namaKoperasi = param.nama_koperasi || 'Koperasi Warga RT 05';

  const fmt = n => n ? n.toLocaleString('id-ID') : '-';

  const headers = [
    'No.', 'Nama Anggota', 'Jasa Pinjaman',
    'Jumlah Simpanan', 'SHU Jasa Pinjaman', 'SHU Jasa Simpanan',
    'SHU Dibagikan', 'SHU + Tabungan', 'Pembulatan', 'TTD'
  ];

  function makeCell(text, bold = false, width = 10) {
    return new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(text), bold, size: 18 })]
      })],
    });
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        shading: { fill: '1a237e' },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18 })]
        })]
      })
    )
  });

  const dataRows = rows.map(r => new TableRow({
    children: [
      makeCell(r.no), makeCell(r.nama, false, 15),
      makeCell(r.jasa_pinjaman ? fmt(r.jasa_pinjaman) : '-'),
      makeCell(fmt(r.jumlah_simpanan)),
      makeCell(r.shu_pinjaman ? fmt(r.shu_pinjaman) : '-'),
      makeCell(fmt(r.shu_simpanan)),
      makeCell(fmt(r.shu_dibagi)),
      makeCell(fmt(r.shu_plus_tabungan)),
      makeCell(fmt(r.pembulatan)),
      makeCell(''),
    ]
  }));

  const totalRow = new TableRow({
    children: [
      makeCell('', true), makeCell('TOTAL', true, 15),
      makeCell(fmt(total.jasa_pinjaman), true),
      makeCell(fmt(total.jumlah_simpanan), true),
      makeCell(fmt(total.shu_pinjaman), true),
      makeCell(fmt(total.shu_simpanan), true),
      makeCell(fmt(total.shu_dibagi), true),
      makeCell(fmt(total.shu_plus_tabungan), true),
      makeCell(fmt(total.pembulatan), true),
      makeCell('', true),
    ]
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: namaKoperasi, bold: true, size: 28 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Perhitungan Distribusi SHU' + (tahun ? ` Tahun ${tahun}` : ''), bold: true, size: 24 })]
        }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows, totalRow]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Dicetak: ${new Date().toLocaleDateString('id-ID')}`, size: 18, italics: true })]
        }),
      ]
    }]
  });

  const buf = await Packer.toBuffer(doc);
  const filename = `Laporan_SHU${tahun ? '_' + tahun : ''}.docx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.send(buf);
});

// ─── Print View ──────────────────────────────────────────────────────────────
router.get('/shu/print', (req, res) => {
  const db = req.app.locals.db;
  const tahun = req.query.tahun || '';
  const { param, rows, total } = getShuData(db, tahun);
  res.render('laporan-shu-print', { param, rows, total, tahun });
});

module.exports = router;
