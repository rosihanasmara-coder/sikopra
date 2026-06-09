const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');

// Dashboard anggota — tampilkan laporan diri sendiri
router.get('/dashboard', requireLogin, (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;
  const anggota_id = user.anggota_id;

  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  if (!anggota_id) {
    req.session.destroy();
    return res.render('login', { error: 'Akun ini tidak terhubung ke data anggota. Hubungi admin.', msg: '' });
  }

  const anggota = db.prepare('SELECT * FROM anggota WHERE id=?').get(anggota_id);
  if (!anggota) {
    req.session.destroy();
    return res.render('login', { error: 'Data anggota tidak ditemukan. Hubungi admin.', msg: '' });
  }

  const simpanan = db.prepare(`SELECT * FROM simpanan WHERE anggota_id=? ORDER BY tanggal DESC`).all(anggota_id);
  const pinjaman = db.prepare(`SELECT * FROM pinjaman WHERE anggota_id=? ORDER BY tanggal DESC`).all(anggota_id);

  const totalPokok    = simpanan.filter(s=>s.jenis==='pokok').reduce((a,s)=>a+s.jumlah,0);
  const totalWajib    = simpanan.filter(s=>s.jenis==='wajib').reduce((a,s)=>a+s.jumlah,0);
  const totalSukarela = simpanan.filter(s=>s.jenis==='sukarela').reduce((a,s)=>a+s.jumlah,0);
  const totalSimpanan = totalPokok + totalWajib + totalSukarela;

  const totalPinjaman  = pinjaman.filter(p=>p.jenis==='pinjaman').reduce((a,p)=>a+p.jumlah,0);
  const totalAngsuran  = pinjaman.filter(p=>p.jenis==='angsuran_pokok').reduce((a,p)=>a+p.jumlah,0);
  const totalJasa      = pinjaman.filter(p=>p.jenis==='jasa_pinjaman').reduce((a,p)=>a+p.jumlah,0);
  const saldoPinjaman  = totalPinjaman - totalAngsuran;

  // Hitung SHU anggota ini
  const komponenShu = db.prepare('SELECT * FROM shu_komponen WHERE aktif=1 ORDER BY urutan').all();
  const totalJasaSemua = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='jasa_pinjaman'").get().t;
  const totalSimpananSemua = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan').get().t;

  const kompPeminjam = komponenShu.filter(k=>k.tipe==='anggota_peminjam');
  const kompSimpanan = komponenShu.filter(k=>k.tipe==='anggota_simpanan');

  const shuPinjaman = kompPeminjam.reduce((sum,k) => {
    const nominal = totalJasaSemua * (k.persentase/100);
    return sum + (totalJasaSemua > 0 ? (totalJasa/totalJasaSemua)*nominal : 0);
  }, 0);
  const shuSimpananVal = kompSimpanan.reduce((sum,k) => {
    const nominal = totalJasaSemua * (k.persentase/100);
    return sum + (totalSimpananSemua > 0 ? (totalSimpanan/totalSimpananSemua)*nominal : 0);
  }, 0);
  const totalShu = Math.round(shuPinjaman + shuSimpananVal);
  const shuPlusTabungan = totalShu + totalSukarela;
  const pembulatan = Math.round(shuPlusTabungan/500)*500;

  res.render('member-dashboard', {
    param, user, anggota,
    simpanan, pinjaman,
    totalPokok, totalWajib, totalSukarela, totalSimpanan,
    totalPinjaman, totalAngsuran, totalJasa, saldoPinjaman,
    totalShu, shuPlusTabungan, pembulatan,
    msg: req.query.msg || '',
    msgType: req.query.msgType || ''
  });
});

module.exports = router;
