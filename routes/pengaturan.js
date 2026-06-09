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
  const komponenShu = db.prepare('SELECT * FROM shu_komponen ORDER BY urutan, id').all();
  res.render('pengaturan', { param, komponenShu, msg: req.query.msg || '', msgType: req.query.msgType || '' });
});

router.post('/simpan', (req, res) => {
  const db = req.app.locals.db;
  const fields = ['nama_koperasi', 'tahun_aktif', 'jasa_pinjaman_default'];
  const old = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => old[p.kunci] = p.nilai);
  const update = db.prepare('INSERT OR REPLACE INTO parameter (kunci, nilai) VALUES (?, ?)');
  fields.forEach(f => { if (req.body[f] !== undefined) update.run(f, req.body[f]); });
  logPerubahan(db, 'edit', 'parameter', null, old, req.body, 'Update pengaturan sistem');
  res.redirect('/pengaturan?msgType=success&msg=Pengaturan berhasil disimpan');
});

// Tambah komponen SHU
router.post('/shu-komponen/tambah', (req, res) => {
  const db = req.app.locals.db;
  const { nama, kode, persentase, deskripsi, tipe } = req.body;
  if (!nama || !kode || persentase === undefined) {
    return res.redirect('/pengaturan?msgType=error&msg=Nama, kode, dan persentase wajib diisi');
  }
  const kodeClean = kode.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const existing = db.prepare('SELECT id FROM shu_komponen WHERE kode=?').get(kodeClean);
  if (existing) {
    return res.redirect('/pengaturan?msgType=error&msg=Kode komponen sudah digunakan, pilih kode lain');
  }
  const maxUrutan = db.prepare('SELECT COALESCE(MAX(urutan),0) as m FROM shu_komponen').get().m;
  const result = db.prepare(`INSERT INTO shu_komponen (nama, kode, persentase, deskripsi, tipe, urutan) VALUES (?,?,?,?,?,?)`)
    .run(nama, kodeClean, parseFloat(persentase), deskripsi || '', tipe || 'umum', maxUrutan + 1);
  logPerubahan(db, 'tambah', 'shu_komponen', result.lastInsertRowid, null, req.body, 'Tambah komponen SHU: ' + nama);
  res.redirect('/pengaturan?msgType=success&msg=Komponen SHU berhasil ditambahkan');
});

// Edit komponen SHU
router.post('/shu-komponen/edit', (req, res) => {
  const db = req.app.locals.db;
  const { id, nama, persentase, deskripsi, tipe } = req.body;
  const old = db.prepare('SELECT * FROM shu_komponen WHERE id=?').get(id);
  if (!old) return res.redirect('/pengaturan?msgType=error&msg=Komponen tidak ditemukan');
  db.prepare('UPDATE shu_komponen SET nama=?, persentase=?, deskripsi=?, tipe=? WHERE id=?')
    .run(nama, parseFloat(persentase), deskripsi || '', tipe || 'umum', id);
  logPerubahan(db, 'edit', 'shu_komponen', id, old, req.body, 'Edit komponen SHU: ' + nama);
  res.redirect('/pengaturan?msgType=success&msg=Komponen SHU berhasil diperbarui');
});

// Hapus komponen SHU
router.post('/shu-komponen/hapus', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const total = db.prepare('SELECT COUNT(*) as c FROM shu_komponen').get().c;
  if (total <= 1) {
    return res.redirect('/pengaturan?msgType=error&msg=Minimal harus ada 1 komponen SHU');
  }
  const old = db.prepare('SELECT * FROM shu_komponen WHERE id=?').get(id);
  db.prepare('DELETE FROM shu_komponen WHERE id=?').run(id);
  logPerubahan(db, 'hapus', 'shu_komponen', id, old, null, 'Hapus komponen SHU: ' + (old ? old.nama : id));
  res.redirect('/pengaturan?msgType=success&msg=Komponen SHU berhasil dihapus');
});

// Simpan semua persentase sekaligus (bulk update)
router.post('/shu-komponen/simpan-semua', (req, res) => {
  const db = req.app.locals.db;
  const ids = [].concat(req.body.id || []);
  const persentases = [].concat(req.body.persentase || []);

  const total = persentases.reduce((sum, p) => sum + parseFloat(p || 0), 0);
  if (Math.abs(total - 100) >= 0.1) {
    return res.redirect('/pengaturan?msgType=error&msg=Total persentase harus 100%. Saat ini: ' + total.toFixed(1) + '%');
  }

  const update = db.prepare('UPDATE shu_komponen SET persentase=? WHERE id=?');
  ids.forEach((id, i) => update.run(parseFloat(persentases[i] || 0), id));

  logPerubahan(db, 'edit', 'shu_komponen', null, null, { ids, persentases }, 'Update persentase semua komponen SHU');
  res.redirect('/pengaturan?msgType=success&msg=Persentase SHU berhasil disimpan');
});

module.exports = router;
