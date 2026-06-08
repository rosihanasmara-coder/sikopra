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

  const pinjaman = db.prepare(`
    SELECT p.*, a.nama, a.nomor_anggota FROM pinjaman p
    JOIN anggota a ON p.anggota_id = a.id
    ORDER BY p.tanggal DESC, p.id DESC
  `).all();

  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota ORDER BY nomor_anggota').all();
  const tahunList = db.prepare('SELECT * FROM tahun_buku ORDER BY tahun DESC').all();

  const saldoPerAnggota = db.prepare(`
    SELECT a.id, a.nomor_anggota, a.nama,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) as total_pinjaman,
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as total_angsuran,
      COALESCE(SUM(CASE WHEN p.jenis='pinjaman' THEN p.jumlah ELSE 0 END),0) -
      COALESCE(SUM(CASE WHEN p.jenis='angsuran_pokok' THEN p.jumlah ELSE 0 END),0) as saldo,
      COALESCE(SUM(CASE WHEN p.jenis='jasa_pinjaman' THEN p.jumlah ELSE 0 END),0) as total_jasa
    FROM anggota a
    LEFT JOIN pinjaman p ON p.anggota_id = a.id
    GROUP BY a.id
    HAVING total_pinjaman > 0
    ORDER BY a.nomor_anggota
  `).all();

  const jasaDefault = parseFloat(param.jasa_pinjaman_default || 5);

  res.render('pinjaman', {
    param, pinjaman, anggotaList, tahunList, saldoPerAnggota, jasaDefault,
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

router.post('/tambah', (req, res) => {
  const db = req.app.locals.db;
  const { anggota_id, jumlah, tanggal, tahun_buku, keterangan } = req.body;
  if (isTahunLocked(db, tahun_buku)) {
    return res.redirect('/pinjaman?msgType=error&msg=Tahun+buku+sudah+terkunci');
  }
  try {
    const param = {};
    db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);
    const jasaPersen = parseFloat(param.jasa_pinjaman_default || 5) / 100;
    const jumlahNum = parseFloat(jumlah);
    const jasa = Math.round(jumlahNum * jasaPersen);

    const r1 = db.prepare(`INSERT INTO pinjaman (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?,?,?,?,?,?)`)
      .run(anggota_id, 'pinjaman', jumlahNum, tanggal, tahun_buku, keterangan);
    const r2 = db.prepare(`INSERT INTO pinjaman (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?,?,?,?,?,?)`)
      .run(anggota_id, 'jasa_pinjaman', jasa, tanggal, tahun_buku, `Jasa pinjaman ${parseFloat(param.jasa_pinjaman_default)}%`);

    logPerubahan(db, 'tambah', 'pinjaman', r1.lastInsertRowid, null, req.body, `Tambah pinjaman Rp ${jumlahNum}`);
    logPerubahan(db, 'tambah', 'pinjaman', r2.lastInsertRowid, null, {jasa}, `Tambah jasa pinjaman Rp ${jasa}`);
    res.redirect('/pinjaman?msgType=success&msg=Pinjaman berhasil ditambahkan');
  } catch (e) {
    res.redirect('/pinjaman?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/angsuran', (req, res) => {
  const db = req.app.locals.db;
  const { anggota_id, angsuran_pokok, tanggal, tahun_buku, keterangan } = req.body;
  if (isTahunLocked(db, tahun_buku)) {
    return res.redirect('/pinjaman?msgType=error&msg=Tahun+buku+sudah+terkunci');
  }
  try {
    const r = db.prepare(`INSERT INTO pinjaman (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?,?,?,?,?,?)`)
      .run(anggota_id, 'angsuran_pokok', parseFloat(angsuran_pokok), tanggal, tahun_buku, keterangan);
    logPerubahan(db, 'tambah', 'pinjaman', r.lastInsertRowid, null, req.body, `Tambah angsuran Rp ${angsuran_pokok}`);
    res.redirect('/pinjaman?msgType=success&msg=Angsuran berhasil ditambahkan');
  } catch (e) {
    res.redirect('/pinjaman?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

router.post('/hapus', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const old = db.prepare('SELECT * FROM pinjaman WHERE id=?').get(id);
  if (!old) return res.redirect('/pinjaman?msgType=error&msg=Data+tidak+ditemukan');
  if (isTahunLocked(db, old.tahun_buku)) {
    return res.redirect('/pinjaman?msgType=error&msg=Tahun+buku+sudah+terkunci');
  }
  db.prepare('DELETE FROM pinjaman WHERE id=?').run(id);
  logPerubahan(db, 'hapus', 'pinjaman', id, old, null, `Hapus pinjaman`);
  res.redirect('/pinjaman?msgType=success&msg=Transaksi berhasil dihapus');
});

module.exports = router;
