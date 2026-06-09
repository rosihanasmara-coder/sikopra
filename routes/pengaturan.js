const express = require('express');
const router = express.Router();

function logPerubahan(db, jenis, tabel, record_id, data_lama, data_baru, keterangan) {
  db.prepare(`INSERT INTO log_perubahan (jenis, tabel, record_id, data_lama, data_baru, keterangan) VALUES (?,?,?,?,?,?)`)
    .run(jenis, tabel, record_id, JSON.stringify(data_lama), JSON.stringify(data_baru), keterangan);
}

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);
  res.render('pengaturan', { param, msg: req.query.msg || '', msgType: req.query.msgType || '' });
});

router.post('/simpan', (req, res) => {
  const db = req.app.locals.db;
  const fields = ['nama_koperasi', 'tahun_aktif', 'persen_cadangan', 'persen_shu_peminjam', 'persen_shu_simpanan', 'jasa_pinjaman_default'];
  const old = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => old[p.kunci] = p.nilai);

  const update = db.prepare('INSERT OR REPLACE INTO parameter (kunci, nilai) VALUES (?, ?)');
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      update.run(f, req.body[f]);
    }
  });
  logPerubahan(db, 'edit', 'parameter', null, old, req.body, 'Update pengaturan sistem');
  res.redirect('/pengaturan?msgType=success&msg=Pengaturan berhasil disimpan');
});

router.post('/simpan-shu', (req, res) => {
  const db = req.app.locals.db;
  const { persen_cadangan, persen_shu_peminjam, persen_shu_simpanan } = req.body;
  const c = parseFloat(persen_cadangan) || 0;
  const p = parseFloat(persen_shu_peminjam) || 0;
  const s = parseFloat(persen_shu_simpanan) || 0;
  const total = c + p + s;

  if (Math.abs(total - 100) >= 0.1) {
    return res.redirect('/pengaturan?msgType=error&msg=Total persentase SHU harus 100%. Saat ini: ' + total.toFixed(1) + '%');
  }

  const old = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => old[p.kunci] = p.nilai);

  const update = db.prepare('INSERT OR REPLACE INTO parameter (kunci, nilai) VALUES (?, ?)');
  update.run('persen_cadangan', String(c));
  update.run('persen_shu_peminjam', String(p));
  update.run('persen_shu_simpanan', String(s));

  logPerubahan(db, 'edit', 'parameter', null, old, { persen_cadangan: c, persen_shu_peminjam: p, persen_shu_simpanan: s }, 'Update pembagian persentase SHU');
  res.redirect('/pengaturan?msgType=success&msg=Pembagian persentase SHU berhasil disimpan');
});

module.exports = router;
