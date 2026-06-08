const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const param = {};
  db.prepare('SELECT kunci, nilai FROM parameter').all().forEach(p => param[p.kunci] = p.nilai);

  const { tabel, jenis } = req.query;
  let query = 'SELECT * FROM log_perubahan WHERE 1=1';
  const args = [];
  if (tabel) { query += ' AND tabel=?'; args.push(tabel); }
  if (jenis) { query += ' AND jenis=?'; args.push(jenis); }
  query += ' ORDER BY id DESC LIMIT 500';

  const logs = db.prepare(query).all(...args);
  res.render('log-perubahan', {
    param, logs,
    filter: { tabel: tabel || '', jenis: jenis || '' },
    msg: req.query.msg || '', msgType: req.query.msgType || ''
  });
});

module.exports = router;
