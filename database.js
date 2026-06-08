const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'sikopra.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
CREATE TABLE IF NOT EXISTS parameter (
  id INTEGER PRIMARY KEY,
  kunci TEXT NOT NULL UNIQUE,
  nilai TEXT NOT NULL,
  keterangan TEXT
);

CREATE TABLE IF NOT EXISTS tahun_buku (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'aktif',
  tanggal_kunci TEXT,
  keterangan TEXT
);

CREATE TABLE IF NOT EXISTS anggota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_anggota TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  alamat TEXT,
  no_hp TEXT,
  tanggal_bergabung TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  keterangan TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simpanan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anggota_id INTEGER NOT NULL,
  jenis TEXT NOT NULL,
  jumlah REAL NOT NULL,
  tanggal TEXT NOT NULL,
  tahun_buku INTEGER NOT NULL,
  keterangan TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anggota_id) REFERENCES anggota(id)
);

CREATE TABLE IF NOT EXISTS pinjaman (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anggota_id INTEGER NOT NULL,
  jenis TEXT NOT NULL,
  jumlah REAL NOT NULL,
  tanggal TEXT NOT NULL,
  tahun_buku INTEGER NOT NULL,
  keterangan TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anggota_id) REFERENCES anggota(id)
);

CREATE TABLE IF NOT EXISTS log_perubahan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT DEFAULT CURRENT_TIMESTAMP,
  jenis TEXT NOT NULL,
  tabel TEXT NOT NULL,
  record_id INTEGER,
  data_lama TEXT,
  data_baru TEXT,
  keterangan TEXT
);
`);

// Insert default data if empty
const paramCount = db.prepare('SELECT COUNT(*) as c FROM parameter').get().c;
if (paramCount === 0) {
  const currentYear = new Date().getFullYear().toString();
  const insertParam = db.prepare('INSERT OR IGNORE INTO parameter (kunci, nilai, keterangan) VALUES (?, ?, ?)');
  insertParam.run('nama_koperasi', 'Koperasi Warga RT 05', 'Nama koperasi');
  insertParam.run('persen_cadangan', '2', 'Persentase cadangan dari SHU');
  insertParam.run('persen_shu_peminjam', '59', 'Persentase SHU untuk peminjam');
  insertParam.run('persen_shu_simpanan', '39', 'Persentase SHU untuk simpanan');
  insertParam.run('jasa_pinjaman_default', '5', 'Persentase jasa pinjaman default');
  insertParam.run('tahun_aktif', currentYear, 'Tahun buku aktif');
}

const tahunCount = db.prepare('SELECT COUNT(*) as c FROM tahun_buku').get().c;
if (tahunCount === 0) {
  db.prepare('INSERT INTO tahun_buku (tahun, status) VALUES (?, ?)').run(2024, 'aktif');
  db.prepare('INSERT INTO tahun_buku (tahun, status) VALUES (?, ?)').run(2025, 'aktif');
}

const anggotaCount = db.prepare('SELECT COUNT(*) as c FROM anggota').get().c;
if (anggotaCount === 0) {
  const insertAnggota = db.prepare(`
    INSERT INTO anggota (nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status)
    VALUES (?, ?, ?, ?, ?, 'aktif')
  `);
  insertAnggota.run('A001', 'Budi Santoso', 'Jl. Mawar No. 1', '081234567890', '2024-01-01');
  insertAnggota.run('A002', 'Siti Rahayu', 'Jl. Melati No. 5', '081234567891', '2024-01-01');
  insertAnggota.run('A003', 'Ahmad Fauzi', 'Jl. Dahlia No. 3', '081234567892', '2024-02-01');
  insertAnggota.run('A004', 'Dewi Lestari', 'Jl. Anggrek No. 7', '081234567893', '2024-02-15');
  insertAnggota.run('A005', 'Eko Prasetyo', 'Jl. Kenanga No. 2', '081234567894', '2024-03-01');
}

const simpananCount = db.prepare('SELECT COUNT(*) as c FROM simpanan').get().c;
if (simpananCount === 0) {
  const insertSimpanan = db.prepare(`
    INSERT INTO simpanan (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  // Simpanan pokok (sekali saja)
  insertSimpanan.run(1, 'pokok', 100000, '2024-01-01', 2024, 'Simpanan pokok awal');
  insertSimpanan.run(2, 'pokok', 100000, '2024-01-01', 2024, 'Simpanan pokok awal');
  insertSimpanan.run(3, 'pokok', 100000, '2024-02-01', 2024, 'Simpanan pokok awal');
  insertSimpanan.run(4, 'pokok', 100000, '2024-02-15', 2024, 'Simpanan pokok awal');
  insertSimpanan.run(5, 'pokok', 100000, '2024-03-01', 2024, 'Simpanan pokok awal');
  // Simpanan wajib bulanan
  insertSimpanan.run(1, 'wajib', 50000, '2024-01-05', 2024, 'Simpanan wajib Januari');
  insertSimpanan.run(2, 'wajib', 50000, '2024-01-05', 2024, 'Simpanan wajib Januari');
  insertSimpanan.run(3, 'wajib', 50000, '2024-02-05', 2024, 'Simpanan wajib Februari');
  insertSimpanan.run(1, 'wajib', 50000, '2024-02-05', 2024, 'Simpanan wajib Februari');
  insertSimpanan.run(4, 'wajib', 50000, '2024-03-05', 2024, 'Simpanan wajib Maret');
  // Simpanan sukarela
  insertSimpanan.run(1, 'sukarela', 200000, '2024-03-10', 2024, 'Simpanan sukarela');
  insertSimpanan.run(2, 'sukarela', 150000, '2024-04-15', 2024, 'Simpanan sukarela');
  insertSimpanan.run(3, 'sukarela', 300000, '2024-05-20', 2024, 'Simpanan sukarela');
}

const pinjamanCount = db.prepare('SELECT COUNT(*) as c FROM pinjaman').get().c;
if (pinjamanCount === 0) {
  const insertPinjaman = db.prepare(`
    INSERT INTO pinjaman (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  // Pinjaman
  insertPinjaman.run(1, 'pinjaman', 1000000, '2024-02-01', 2024, 'Pinjaman usaha');
  insertPinjaman.run(1, 'jasa_pinjaman', 50000, '2024-02-01', 2024, 'Jasa pinjaman 5%');
  insertPinjaman.run(2, 'pinjaman', 500000, '2024-03-01', 2024, 'Pinjaman kebutuhan');
  insertPinjaman.run(2, 'jasa_pinjaman', 25000, '2024-03-01', 2024, 'Jasa pinjaman 5%');
  insertPinjaman.run(4, 'pinjaman', 750000, '2024-04-01', 2024, 'Pinjaman pendidikan');
  insertPinjaman.run(4, 'jasa_pinjaman', 37500, '2024-04-01', 2024, 'Jasa pinjaman 5%');
  // Angsuran
  insertPinjaman.run(1, 'angsuran_pokok', 200000, '2024-03-01', 2024, 'Angsuran ke-1');
  insertPinjaman.run(1, 'angsuran_pokok', 200000, '2024-04-01', 2024, 'Angsuran ke-2');
  insertPinjaman.run(2, 'angsuran_pokok', 250000, '2024-04-01', 2024, 'Angsuran ke-1');
  insertPinjaman.run(4, 'angsuran_pokok', 250000, '2024-05-01', 2024, 'Angsuran ke-1');
}

module.exports = db;
