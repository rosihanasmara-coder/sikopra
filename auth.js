const bcrypt = require('bcryptjs');

function seedUsers(db) {
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Admin default
  const adminExists = db.prepare("SELECT id FROM users WHERE username='admin'").get();
  if (!adminExists) {
    db.prepare(`INSERT INTO users (username, password, role, nama) VALUES (?,?,?,?)`)
      .run('admin', hash('admin123'), 'admin', 'Administrator');
  }

  // Buat atau update akun untuk setiap anggota
  const anggotaList = db.prepare('SELECT id, nomor_anggota, nama FROM anggota').all();
  const ins = db.prepare(`INSERT OR IGNORE INTO users (username, password, role, anggota_id, nama) VALUES (?,?,?,?,?)`);
  const upd = db.prepare(`UPDATE users SET anggota_id=?, nama=? WHERE username=? AND (anggota_id IS NULL OR anggota_id != ?)`);
  anggotaList.forEach(a => {
    const uname = a.nomor_anggota.toLowerCase();
    ins.run(uname, hash('123456'), 'anggota', a.id, a.nama);
    upd.run(a.id, a.nama, uname, a.id);
  });
}

module.exports = { seedUsers };
