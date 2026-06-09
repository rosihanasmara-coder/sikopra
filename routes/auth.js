const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/' : '/member/dashboard');
  }
  res.render('login', { error: req.query.error || '', msg: req.query.msg || '' });
});

router.post('/login', (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=? AND aktif=1').get(username.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.redirect('/login?error=Username atau password salah');
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    nama: user.nama,
    role: user.role,
    anggota_id: user.anggota_id
  };

  res.redirect(user.role === 'admin' ? '/' : '/member/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
