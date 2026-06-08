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
  if (filterTahun) {
    whereClause = ' AND p.tahun_buku=?';
    args.push(filterTahun);
  }

  const persen = {
    cadangan: parseFloat(param.persen_cadangan || 2),
    peminjam: parseFloat(param.persen_shu_peminjam || 59),
    simpanan: parseFloat(param.persen_shu_simpanan || 39)
  };

  const shuKoperasi = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman p WHERE jenis='jasa_pinjaman'${whereClause}`).get(...args).t;
  const cadangan = shuKoperasi * (persen.cadangan / 100);
  const shuDibagi = shuKoperasi - cadangan;
  const porsiPeminjam = shuDibagi * (persen.peminjam / (persen.peminjam + persen.simpanan));
  const porsiSimpanan = shuDibagi * (persen.simpanan / (persen.peminjam + persen.simpanan));

  const totalJasaSemua = shuKoperasi;
  const totalSimpananSemua = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan`).get().t;

  const anggota = db.prepare('SELECT id, nomor_anggota, nama FROM anggota ORDER BY nomor_anggota').all();
  const shuAnggota = anggota.map(a => {
    const jasaPinjaman = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE anggota_id=? AND jenis='jasa_pinjaman'${whereClause}`).get(a.id, ...args).t;
    const totalSimpanan = db.prepare(`SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan WHERE anggota_id=?`).get(a.id).t;

    const shuPinjaman = totalJasaSemua > 0 ? (jasaPinjaman / totalJasaSemua) * porsiPeminjam : 0;
    const shuSimpananVal = totalSimpananSemua > 0 ? (totalSimpanan / totalSimpananSemua) * porsiSimpanan : 0;
    const totalShu = shuPinjaman + shuSimpananVal;

    return {
      ...a,
      jasa_pinjaman: jasaPinjaman,
      total_simpanan: totalSimpanan,
      shu_pinjaman: shuPinjaman,
      shu_simpanan: shuSimpananVal,
      total_shu: totalShu
    };
  });

  res.render('shu', {
    param, tahunList, filterTahun,
    shuKoperasi, cadangan, shuDibagi, porsiPeminjam, porsiSimpanan,
    totalSimpananSemua, persen, shuAnggota,
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

module.exports = router;
