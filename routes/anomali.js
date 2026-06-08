const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  // 1. Anggota tanpa simpanan pokok
  const tanpaPokokAnggota = db.prepare(`
    SELECT a.* FROM anggota a
    WHERE a.id NOT IN (SELECT DISTINCT anggota_id FROM simpanan WHERE jenis='pokok')
    ORDER BY a.nomor_anggota
  `).all();

  // 2. Transaksi nilai 0 atau negatif
  const simpananAbnormal = db.prepare(`
    SELECT 'simpanan' as tabel, s.jenis, s.jumlah, s.tanggal, a.nama
    FROM simpanan s JOIN anggota a ON s.anggota_id = a.id
    WHERE s.jumlah <= 0
  `).all();
  const pinjamanAbnormal = db.prepare(`
    SELECT 'pinjaman' as tabel, p.jenis, p.jumlah, p.tanggal, a.nama
    FROM pinjaman p JOIN anggota a ON p.anggota_id = a.id
    WHERE p.jumlah <= 0
  `).all();
  const transaksiAbnormal = [...simpananAbnormal, ...pinjamanAbnormal];

  // 3. Pinjaman tanpa angsuran sama sekali (saldo > 0 tapi 0 angsuran)
  const pinjamanTanpaAngsuran = db.prepare(`
    SELECT a.id, a.nomor_anggota, a.nama,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) as total_pinjaman,
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as total_angsuran,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) -
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as saldo
    FROM anggota a
    LEFT JOIN pinjaman p ON p.anggota_id = a.id
    GROUP BY a.id
    HAVING total_pinjaman > 0 AND total_angsuran = 0
    ORDER BY a.nomor_anggota
  `).all();

  // 4. Saldo pinjaman negatif
  const saldoNegatif = db.prepare(`
    SELECT a.id, a.nomor_anggota, a.nama,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) -
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as saldo
    FROM anggota a
    LEFT JOIN pinjaman p ON p.anggota_id = a.id
    GROUP BY a.id
    HAVING saldo < 0
    ORDER BY saldo ASC
  `).all();

  // 5. Anggota nonaktif dengan transaksi terbaru
  const nonaktifSimpanan = db.prepare(`
    SELECT a.nomor_anggota, a.nama, 'simpanan' as tabel, MAX(s.tanggal) as tanggal_terakhir
    FROM anggota a JOIN simpanan s ON s.anggota_id = a.id
    WHERE a.status='nonaktif'
    GROUP BY a.id
  `).all();
  const nonaktifPinjaman = db.prepare(`
    SELECT a.nomor_anggota, a.nama, 'pinjaman' as tabel, MAX(p.tanggal) as tanggal_terakhir
    FROM anggota a JOIN pinjaman p ON p.anggota_id = a.id
    WHERE a.status='nonaktif'
    GROUP BY a.id
  `).all();
  const nonaktifDenganTransaksi = [...nonaktifSimpanan, ...nonaktifPinjaman];

  res.render('anomali', {
    param,
    tanpaPokokAnggota,
    transaksiAbnormal,
    pinjamanTanpaAngsuran,
    saldoNegatif,
    nonaktifDenganTransaksi,
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

module.exports = router;
