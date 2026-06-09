const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  const filterTahun = req.query.tahun || '';
  const tahunList = db.prepare('SELECT * FROM tahun_buku ORDER BY tahun DESC').all();

  let whereClause = '';
  const args = [];
  if (filterTahun) { whereClause = ' AND p.tahun_buku=?'; args.push(filterTahun); }

  // Ambil komponen SHU dinamis
  const komponenShu = db.prepare('SELECT * FROM shu_komponen WHERE aktif=1 ORDER BY urutan, id').all();
  const totalShuKoperasi = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman p WHERE jenis='jasa_pinjaman'${whereClause}`).get(...args).t;
  const totalSimpananSemua = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan').get().t;
  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota ORDER BY nomor_anggota').all();

  // Hitung nominal per komponen
  const komponenHasil = komponenShu.map(k => ({
    ...k,
    nominal: totalShuKoperasi * (k.persentase / 100)
  }));

  // Komponen khusus anggota (peminjam dan simpanan) untuk distribusi
  const kompPeminjam = komponenShu.filter(k => k.tipe === 'anggota_peminjam');
  const kompSimpanan = komponenShu.filter(k => k.tipe === 'anggota_simpanan');
  const totalPorsiBagi = kompPeminjam.reduce((s,k)=>s+k.persentase,0) + kompSimpanan.reduce((s,k)=>s+k.persentase,0);

  // SHU per anggota
  const shuAnggota = anggotaList.map(a => {
    const jasaPinjaman = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE anggota_id=? AND jenis='jasa_pinjaman'${whereClause}`).get(a.id, ...args).t;
    const totalSimpanan = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=?').get(a.id).t;

    // SHU dari semua komponen peminjam
    const shuPinjaman = kompPeminjam.reduce((sum, k) => {
      const nominal = totalShuKoperasi * (k.persentase / 100);
      return sum + (totalShuKoperasi > 0 ? (jasaPinjaman / totalShuKoperasi) * nominal : 0);
    }, 0);

    // SHU dari semua komponen simpanan
    const shuSimpanan = kompSimpanan.reduce((sum, k) => {
      const nominal = totalShuKoperasi * (k.persentase / 100);
      return sum + (totalSimpananSemua > 0 ? (totalSimpanan / totalSimpananSemua) * nominal : 0);
    }, 0);

    return {
      ...a,
      jasa_pinjaman: jasaPinjaman,
      total_simpanan: totalSimpanan,
      shu_pinjaman: shuPinjaman,
      shu_simpanan: shuSimpanan,
      total_shu: shuPinjaman + shuSimpanan
    };
  });

  // Ringkasan
  const totalCadangan = komponenShu.filter(k=>k.tipe==='cadangan').reduce((s,k)=>s+totalShuKoperasi*(k.persentase/100),0);
  const shuDibagi = shuAnggota.reduce((s,a)=>s+a.total_shu,0);

  res.render('shu', {
    param, tahunList, filterTahun,
    shuKoperasi: totalShuKoperasi,
    cadangan: totalCadangan,
    shuDibagi,
    totalSimpananSemua,
    komponenShu, komponenHasil,
    kompPeminjam, kompSimpanan,
    shuAnggota,
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

module.exports = router;
