const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  const checks = [];

  // Check 1: Total simpanan dari jurnal vs rekap per anggota
  const totalSimpananJurnal = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan").get().t;
  const totalSimpananRekap = db.prepare(`
    SELECT COALESCE(SUM(s),0) as t FROM (
      SELECT SUM(jumlah) as s FROM simpanan GROUP BY anggota_id
    )
  `).get().t;
  checks.push({
    title: 'Kesesuaian Total Simpanan',
    detail: `Jurnal: Rp ${totalSimpananJurnal.toLocaleString('id-ID')} | Rekap: Rp ${totalSimpananRekap.toLocaleString('id-ID')}`,
    status: Math.abs(totalSimpananJurnal - totalSimpananRekap) < 0.01 ? 'ok' : 'error'
  });

  // Check 2: Total pinjaman
  const totalPinjamanJurnal = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='pinjaman'").get().t;
  const totalPinjamanRekap = db.prepare(`
    SELECT COALESCE(SUM(s),0) as t FROM (
      SELECT SUM(jumlah) as s FROM pinjaman WHERE jenis='pinjaman' GROUP BY anggota_id
    )
  `).get().t;
  checks.push({
    title: 'Kesesuaian Total Pinjaman',
    detail: `Jurnal: Rp ${totalPinjamanJurnal.toLocaleString('id-ID')} | Rekap: Rp ${totalPinjamanRekap.toLocaleString('id-ID')}`,
    status: Math.abs(totalPinjamanJurnal - totalPinjamanRekap) < 0.01 ? 'ok' : 'error'
  });

  // Check 3: Saldo pinjaman >= 0
  const saldoNegatif = db.prepare(`
    SELECT a.id, a.nomor_anggota, a.nama,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) as total_pinjaman,
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as total_angsuran,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) -
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as saldo
    FROM anggota a
    LEFT JOIN pinjaman p ON p.anggota_id = a.id
    GROUP BY a.id
    HAVING saldo < 0
  `).all();
  checks.push({
    title: 'Saldo Pinjaman Tidak Negatif',
    detail: saldoNegatif.length === 0 ? 'Semua saldo pinjaman >= 0' : `${saldoNegatif.length} anggota dengan saldo negatif`,
    status: saldoNegatif.length === 0 ? 'ok' : 'error'
  });

  // Check 4: SHU anggota vs SHU yang dibagikan
  const persen = {
    cadangan: parseFloat(param.persen_cadangan || 2),
    peminjam: parseFloat(param.persen_shu_peminjam || 59),
    simpanan: parseFloat(param.persen_shu_simpanan || 39)
  };
  const shuKoperasi = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='jasa_pinjaman'").get().t;
  const cadangan = shuKoperasi * (persen.cadangan / 100);
  const shuDibagi = shuKoperasi - cadangan;
  const porsiTotal = (shuDibagi * persen.peminjam / (persen.peminjam + persen.simpanan)) +
                     (shuDibagi * persen.simpanan / (persen.peminjam + persen.simpanan));
  checks.push({
    title: 'Kesesuaian SHU Dibagi',
    detail: `SHU Dibagi: Rp ${shuDibagi.toLocaleString('id-ID')} | Porsi: Rp ${Math.round(porsiTotal).toLocaleString('id-ID')}`,
    status: Math.abs(shuDibagi - porsiTotal) < 1 ? 'ok' : 'error'
  });

  res.render('rekonsiliasi', {
    param, checks, saldoNegatif,
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

module.exports = router;
