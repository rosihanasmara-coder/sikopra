const express = require('express');
const router = express.Router();

function logPerubahan(db, jenis, tabel, record_id, data_lama, data_baru, keterangan) {
  db.prepare(`INSERT INTO log_perubahan (jenis, tabel, record_id, data_lama, data_baru, keterangan) VALUES (?,?,?,?,?,?)`)
    .run(jenis, tabel, record_id, JSON.stringify(data_lama), JSON.stringify(data_baru), keterangan);
}

function isTahunLocked(db, tahun) {
  const tb = db.prepare("SELECT status FROM tahun_buku WHERE tahun=?").get(tahun);
  return tb && tb.status === 'terkunci';
}

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  const { tahun, anggota_id, jenis } = req.query;
  let query = `SELECT s.*, a.nama, a.nomor_anggota FROM simpanan s JOIN anggota a ON s.anggota_id = a.id WHERE 1=1`;
  const args = [];
  if (tahun) { query += ' AND s.tahun_buku=?'; args.push(tahun); }
  if (anggota_id) { query += ' AND s.anggota_id=?'; args.push(anggota_id); }
  if (jenis) { query += ' AND s.jenis=?'; args.push(jenis); }
  query += ' ORDER BY s.tanggal DESC, s.id DESC';

  const simpanan = db.prepare(query).all(...args);
  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota ORDER BY nomor_anggota').all();
  const tahunList = db.prepare('SELECT * FROM tahun_buku ORDER BY tahun DESC').all();

  res.render('simpanan', {
    param, simpanan, anggotaList, tahunList,
    filter: { tahun: tahun || '', anggota_id: anggota_id || '', jenis: jenis || '' },
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

router.post('/tambah', (req, res) => {
  const db = req.app.locals.db;
  const { anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan } = req.body;
  if (isTahunLocked(db, tahun_buku)) {
    return res.redirect('/simpanan?msgType=error&msg=Tahun+buku+sudah+terkunci');
  }
  try {
    const result = db.prepare(`
      INSERT INTO simpanan (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(anggota_id, jenis, parseFloat(jumlah), tanggal, tahun_buku, keterangan);
    logPerubahan(db, 'tambah', 'simpanan', result.lastInsertRowid, null, req.body, `Tambah simpanan ${jenis}`);
    res.redirect('/simpanan?msgType=success&msg=Simpanan berhasil ditambahkan');
  } catch (e) {
    res.redirect('/simpanan?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/edit', (req, res) => {
  const db = req.app.locals.db;
  const { id, anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan } = req.body;
  if (isTahunLocked(db, tahun_buku)) {
    return res.redirect('/simpanan?msgType=error&msg=Tahun+buku+sudah+terkunci');
  }
  const old = db.prepare('SELECT * FROM simpanan WHERE id=?').get(id);
  if (old && isTahunLocked(db, old.tahun_buku)) {
    return res.redirect('/simpanan?msgType=error&msg=Tahun+buku+asal+sudah+terkunci');
  }
  try {
    db.prepare(`
      UPDATE simpanan SET anggota_id=?, jenis=?, jumlah=?, tanggal=?, tahun_buku=?, keterangan=? WHERE id=?
    `).run(anggota_id, jenis, parseFloat(jumlah), tanggal, tahun_buku, keterangan, id);
    logPerubahan(db, 'edit', 'simpanan', id, old, req.body, `Edit simpanan`);
    res.redirect('/simpanan?msgType=success&msg=Simpanan berhasil diperbarui');
  } catch (e) {
    res.redirect('/simpanan?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/hapus', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const old = db.prepare('SELECT * FROM simpanan WHERE id=?').get(id);
  if (!old) return res.redirect('/simpanan?msgType=error&msg=Data+tidak+ditemukan');
  if (isTahunLocked(db, old.tahun_buku)) {
    return res.redirect('/simpanan?msgType=error&msg=Tahun+buku+sudah+terkunci');
  }
  db.prepare('DELETE FROM simpanan WHERE id=?').run(id);
  logPerubahan(db, 'hapus', 'simpanan', id, old, null, `Hapus simpanan`);
  res.redirect('/simpanan?msgType=success&msg=Simpanan berhasil dihapus');
});

module.exports = router;
