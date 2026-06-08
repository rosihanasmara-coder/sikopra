const express = require('express');
const router = express.Router();

function logPerubahan(db, jenis, tabel, record_id, data_lama, data_baru, keterangan) {
  db.prepare(`INSERT INTO log_perubahan (jenis, tabel, record_id, data_lama, data_baru, keterangan) VALUES (?,?,?,?,?,?)`)
    .run(jenis, tabel, record_id, JSON.stringify(data_lama), JSON.stringify(data_baru), keterangan);
}

function generateNomor(db) {
  const last = db.prepare("SELECT nomor_anggota FROM anggota ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'A001';
  const num = parseInt(last.nomor_anggota.replace('A', '')) + 1;
  return 'A' + String(num).padStart(3, '0');
}

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);
  const anggota = db.prepare('SELECT * FROM anggota ORDER BY nomor_anggota').all();
  res.render('anggota', { param, anggota, msg: req.query.msg || '', msgType: req.query.msgType || '' });
});

router.post('/tambah', (req, res) => {
  const db = req.app.locals.db;
  const { nama, alamat, no_hp, tanggal_bergabung, status, keterangan } = req.body;
  const nomor_anggota = generateNomor(db);
  try {
    const result = db.prepare(`
      INSERT INTO anggota (nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status, keterangan)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status || 'aktif', keterangan);
    logPerubahan(db, 'tambah', 'anggota', result.lastInsertRowid, null, req.body, `Tambah anggota ${nama}`);
    res.redirect('/anggota?msgType=success&msg=Anggota berhasil ditambahkan');
  } catch (e) {
    res.redirect('/anggota?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/edit', (req, res) => {
  const db = req.app.locals.db;
  const { id, nama, alamat, no_hp, tanggal_bergabung, status, keterangan } = req.body;
  const old = db.prepare('SELECT * FROM anggota WHERE id=?').get(id);
  try {
    db.prepare(`
      UPDATE anggota SET nama=?, alamat=?, no_hp=?, tanggal_bergabung=?, status=?, keterangan=? WHERE id=?
    `).run(nama, alamat, no_hp, tanggal_bergabung, status, keterangan, id);
    logPerubahan(db, 'edit', 'anggota', id, old, req.body, `Edit anggota ${nama}`);
    res.redirect('/anggota?msgType=success&msg=Anggota berhasil diperbarui');
  } catch (e) {
    res.redirect('/anggota?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/hapus', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const old = db.prepare('SELECT * FROM anggota WHERE id=?').get(id);
  // Check if has transactions
  const hasSimpanan = db.prepare('SELECT COUNT(*) as c FROM simpanan WHERE anggota_id=?').get(id).c;
  const hasPinjaman = db.prepare('SELECT COUNT(*) as c FROM pinjaman WHERE anggota_id=?').get(id).c;
  if (hasSimpanan > 0 || hasPinjaman > 0) {
    // Nonaktifkan instead
    db.prepare("UPDATE anggota SET status='nonaktif' WHERE id=?").run(id);
    logPerubahan(db, 'edit', 'anggota', id, old, { status: 'nonaktif' }, `Nonaktifkan anggota ${old.nama}`);
    res.redirect('/anggota?msgType=warning&msg=Anggota memiliki transaksi, status diubah menjadi nonaktif');
  } else {
    db.prepare('DELETE FROM anggota WHERE id=?').run(id);
    logPerubahan(db, 'hapus', 'anggota', id, old, null, `Hapus anggota ${old.nama}`);
    res.redirect('/anggota?msgType=success&msg=Anggota berhasil dihapus');
  }
});

module.exports = router;
