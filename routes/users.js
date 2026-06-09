const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);
  const users = db.prepare(`
    SELECT u.*, a.nomor_anggota FROM users u
    LEFT JOIN anggota a ON u.anggota_id = a.id
    ORDER BY u.role, u.username
  `).all();
  res.render('users', { param, users, msg: req.query.msg || '', msgType: req.query.msgType || '' });
});

// Reset password user
router.post('/reset-password', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { id, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, id);
  res.redirect('/users?msgType=success&msg=Password berhasil direset');
});

// Toggle aktif
router.post('/toggle-aktif', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (user.username === 'admin') return res.redirect('/users?msgType=error&msg=Akun admin tidak dapat dinonaktifkan');
  db.prepare('UPDATE users SET aktif=? WHERE id=?').run(user.aktif ? 0 : 1, id);
  res.redirect('/users?msgType=success&msg=Status user berhasil diubah');
});

// Tambah user admin manual
router.post('/tambah', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { username, password, nama, role, anggota_id } = req.body;
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password, nama, role, anggota_id) VALUES (?,?,?,?,?)')
      .run(username.toLowerCase().trim(), hash, nama, role, anggota_id || null);
    res.redirect('/users?msgType=success&msg=User berhasil ditambahkan');
  } catch (e) {
    res.redirect('/users?msgType=error&msg=' + encodeURIComponent(e.message));
  }
});

// Ganti password sendiri (semua user)
router.post('/ganti-password', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const db = req.app.locals.db;
  const { password_lama, password_baru } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);
  if (!bcrypt.compareSync(password_lama, user.password)) {
    const back = req.session.user.role === 'admin' ? '/users' : '/member/dashboard';
    return res.redirect(back + '?msgType=error&msg=Password lama salah');
  }
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(password_baru, 10), user.id);
  const back = req.session.user.role === 'admin' ? '/users' : '/member/dashboard';
  res.redirect(back + '?msgType=success&msg=Password berhasil diubah');
});

module.exports = router;
