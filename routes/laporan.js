const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota ORDER BY nomor_anggota').all();
  const selectedId = req.query.anggota_id || '';

  let anggota = null, ringkasan = null, shu = null, riwayatSimpanan = [], riwayatPinjaman = [];

  if (selectedId) {
    anggota = db.prepare('SELECT * FROM anggota WHERE id=?').get(selectedId);
    if (anggota) {
      // Simpanan
      const pokok = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=? AND jenis='pokok'").get(selectedId).t;
      const wajib = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=? AND jenis='wajib'").get(selectedId).t;
      const sukarela = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'").get(selectedId).t;
      const totalSimpanan = pokok + wajib + sukarela;

      // Pinjaman
      const totalPinjaman = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE anggota_id=? AND jenis='pinjaman'").get(selectedId).t;
      const totalAngsuran = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE anggota_id=? AND jenis='angsuran_pokok'").get(selectedId).t;
      const saldoPinjaman = totalPinjaman - totalAngsuran;
      const totalJasa = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE anggota_id=? AND jenis='jasa_pinjaman'").get(selectedId).t;

      ringkasan = { pokok, wajib, sukarela, totalSimpanan, totalPinjaman, totalAngsuran, saldoPinjaman, totalJasa };

      // SHU
      const persen = {
        cadangan: parseFloat(param.persen_cadangan || 2),
        peminjam: parseFloat(param.persen_shu_peminjam || 59),
        simpanan: parseFloat(param.persen_shu_simpanan || 39)
      };
      const shuKoperasi = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='jasa_pinjaman'").get().t;
      const cadangan = shuKoperasi * (persen.cadangan / 100);
      const shuDibagi = shuKoperasi - cadangan;
      const porsiPeminjam = shuDibagi * (persen.peminjam / (persen.peminjam + persen.simpanan));
      const porsiSimpanan = shuDibagi * (persen.simpanan / (persen.peminjam + persen.simpanan));
      const totalJasaSemua = shuKoperasi;
      const totalSimpananSemua = db.prepare("SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan").get().t;
      const shuPinjaman = totalJasaSemua > 0 ? (totalJasa / totalJasaSemua) * porsiPeminjam : 0;
      const shuSimpanan = totalSimpananSemua > 0 ? (totalSimpanan / totalSimpananSemua) * porsiSimpanan : 0;
      shu = { shuPinjaman, shuSimpanan, totalShu: shuPinjaman + shuSimpanan };

      // Riwayat
      riwayatSimpanan = db.prepare('SELECT * FROM simpanan WHERE anggota_id=? ORDER BY tanggal DESC').all(selectedId);
      riwayatPinjaman = db.prepare('SELECT * FROM pinjaman WHERE anggota_id=? ORDER BY tanggal DESC').all(selectedId);
    }
  }

  res.render('laporan-anggota', {
    param, anggotaList, selectedId, anggota, ringkasan, shu, riwayatSimpanan, riwayatPinjaman,
    namaKoperasi: param.nama_koperasi || 'SiKopra',
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

module.exports = router;
