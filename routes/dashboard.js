const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  const tahunList = db.prepare('SELECT tahun FROM tahun_buku ORDER BY tahun DESC').all().map(r => r.tahun);
  const filterTahun = req.query.tahun ? parseInt(req.query.tahun) : null;

  const whereS = filterTahun ? `WHERE tahun_buku = ${filterTahun}` : '';
  const whereP = filterTahun ? `WHERE tahun_buku = ${filterTahun}` : '';
  const wherePA = filterTahun ? `AND tahun_buku = ${filterTahun}` : '';

  const totalAnggota = db.prepare("SELECT COUNT(*) as c FROM anggota WHERE status='aktif'").get().c;
  const totalSimpanan = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan ${whereS}`).get().t;
  const totalPokok = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE jenis='pokok' ${filterTahun ? `AND tahun_buku=${filterTahun}` : ''}`).get().t;
  const totalWajib = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE jenis='wajib' ${filterTahun ? `AND tahun_buku=${filterTahun}` : ''}`).get().t;
  const totalSukarela = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE jenis='sukarela' ${filterTahun ? `AND tahun_buku=${filterTahun}` : ''}`).get().t;
  const totalPinjaman = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='pinjaman' ${filterTahun ? `AND tahun_buku=${filterTahun}` : ''}`).get().t;
  const totalAngsuranPokok = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='angsuran_pokok' ${filterTahun ? `AND tahun_buku=${filterTahun}` : ''}`).get().t;
  const totalSaldoPinjaman = totalPinjaman - totalAngsuranPokok;
  const totalJasaPinjaman = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis='jasa_pinjaman' ${filterTahun ? `AND tahun_buku=${filterTahun}` : ''}`).get().t;

  // SHU
  const pCadangan = parseFloat(param.persen_cadangan || 2) / 100;
  const shuKoperasi = totalJasaPinjaman;
  const cadangan = shuKoperasi * pCadangan;
  const shuAnggota = shuKoperasi * (1 - pCadangan);

  // Chart data per anggota
  const tahunCond = filterTahun ? `AND s.tahun_buku = ${filterTahun}` : '';
  const tahunCondP = filterTahun ? `AND p.tahun_buku = ${filterTahun}` : '';
  const chartData = db.prepare(`
    SELECT a.nama,
      COALESCE((SELECT SUM(s.jumlah) FROM simpanan s WHERE s.anggota_id = a.id ${tahunCond}),0) as total_simpanan,
      COALESCE((SELECT SUM(p.jumlah) FROM pinjaman p WHERE p.anggota_id = a.id AND p.jenis='pinjaman' ${tahunCondP}),0) -
      COALESCE((SELECT SUM(p.jumlah) FROM pinjaman p WHERE p.anggota_id = a.id AND p.jenis='angsuran_pokok' ${tahunCondP}),0) as saldo_pinjaman
    FROM anggota a WHERE a.status='aktif'
    ORDER BY a.nomor_anggota
  `).all();

  res.render('dashboard', {
    param,
    tahunList,
    filterTahun,
    totalAnggota,
    totalSimpanan,
    totalPokok,
    totalWajib,
    totalSukarela,
    totalPinjaman,
    totalAngsuranPokok,
    totalSaldoPinjaman,
    totalJasaPinjaman,
    shuKoperasi,
    cadangan,
    shuAnggota,
    chartData,
    msg: req.query.msg || '',
    msgType: req.query.msgType || ''
  });
});

module.exports = router;
