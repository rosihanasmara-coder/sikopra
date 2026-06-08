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
  const tahunList = db.prepare('SELECT * FROM tahun_buku ORDER BY tahun DESC').all();
  res.render('tahun-buku', { param, tahunList, msg: req.query.msg || '', msgType: req.query.msgType || '' });
});

router.post('/tambah', (req, res) => {
  const db = req.app.locals.db;
  const { tahun, keterangan } = req.body;
  try {
    const r = db.prepare('INSERT INTO tahun_buku (tahun, status, keterangan) VALUES (?, ?, ?)').run(tahun, 'aktif', keterangan);
    logPerubahan(db, 'tambah', 'tahun_buku', r.lastInsertRowid, null, { tahun }, `Tambah tahun buku ${tahun}`);
    res.redirect('/tahun-buku?msgType=success&msg=Tahun+buku+berhasil+ditambahkan');
  } catch (e) {
    res.redirect('/tahun-buku?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/kunci', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const old = db.prepare('SELECT * FROM tahun_buku WHERE id=?').get(id);
  const now = new Date().toISOString().split('T')[0];
  db.prepare("UPDATE tahun_buku SET status='terkunci', tanggal_kunci=? WHERE id=?").run(now, id);
  logPerubahan(db, 'edit', 'tahun_buku', id, old, { status: 'terkunci' }, `Kunci tahun buku ${old.tahun}`);
  res.redirect('/tahun-buku?msgType=success&msg=Tahun+buku+berhasil+dikunci');
});

router.post('/buka', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const old = db.prepare('SELECT * FROM tahun_buku WHERE id=?').get(id);
  db.prepare("UPDATE tahun_buku SET status='aktif', tanggal_kunci=NULL WHERE id=?").run(id);
  logPerubahan(db, 'edit', 'tahun_buku', id, old, { status: 'aktif' }, `Buka kunci tahun buku ${old.tahun}`);
  res.redirect('/tahun-buku?msgType=success&msg=Tahun+buku+berhasil+dibuka+kuncinya');
});

router.post('/hapus', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const old = db.prepare('SELECT * FROM tahun_buku WHERE id=?').get(id);
  // Check if has transactions
  const countS = db.prepare('SELECT COUNT(*) as c FROM simpanan WHERE tahun_buku=?').get(old.tahun).c;
  const countP = db.prepare('SELECT COUNT(*) as c FROM pinjaman WHERE tahun_buku=?').get(old.tahun).c;
  if (countS > 0 || countP > 0) {
    return res.redirect('/tahun-buku?msgType=error&msg=Tidak+dapat+menghapus+tahun+buku+yang+memiliki+transaksi');
  }
  db.prepare('DELETE FROM tahun_buku WHERE id=?').run(id);
  logPerubahan(db, 'hapus', 'tahun_buku', id, old, null, `Hapus tahun buku ${old.tahun}`);
  res.redirect('/tahun-buku?msgType=success&msg=Tahun+buku+berhasil+dihapus');
});

module.exports = router;
