const bcrypt = require('bcryptjs');

// Seed default users (dipanggil dari app.js setelah anggota diload)
function seedUsers(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Admin default
  db.prepare(`INSERT INTO users (username, password, role, nama) VALUES (?,?,?,?)`)
    .run('admin', hash('admin123'), 'admin', 'Administrator');

  // Buat akun untuk setiap anggota (username=nomor_anggota, password=123456)
  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota').all();
  const ins = db.prepare(`INSERT OR IGNORE INTO users (username, password, role, anggota_id, nama) VALUES (?,?,?,?,?)`);
  anggotaList.forEach(a => {
    ins.run(a.nomor_anggota.toLowerCase(), hash('123456'), 'anggota', a.id, a.nama);
  });
}

module.exports = { seedUsers };
