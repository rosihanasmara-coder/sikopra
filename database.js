const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(path.join(dbDir, 'sikopra.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

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

// Helper: prepare + get count
function getCount(table) {
  return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
}

// Insert default parameters
if (getCount('parameter') === 0) {
  const currentYear = new Date().getFullYear().toString();
  const ins = db.prepare('INSERT OR IGNORE INTO parameter (kunci, nilai, keterangan) VALUES (?, ?, ?)');
  ins.run('nama_koperasi', 'Koperasi Warga RT 05', 'Nama koperasi');
  ins.run('persen_cadangan', '2', 'Persentase cadangan dari SHU');
  ins.run('persen_shu_peminjam', '59', 'Persentase SHU untuk peminjam');
  ins.run('persen_shu_simpanan', '39', 'Persentase SHU untuk simpanan');
  ins.run('jasa_pinjaman_default', '5', 'Persentase jasa pinjaman default');
  ins.run('tahun_aktif', currentYear, 'Tahun buku aktif');
}

// Insert default tahun buku
if (getCount('tahun_buku') === 0) {
  db.prepare('INSERT INTO tahun_buku (tahun, status) VALUES (?, ?)').run(2024, 'aktif');
  db.prepare('INSERT INTO tahun_buku (tahun, status) VALUES (?, ?)').run(2025, 'aktif');
}

// Insert sample anggota
if (getCount('anggota') === 0) {
  const ins = db.prepare(`
    INSERT INTO anggota (nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status)
    VALUES (?, ?, ?, ?, ?, 'aktif')
  `);
  ins.run('A001', 'Budi Santoso', 'Jl. Mawar No. 1', '081234567890', '2024-01-01');
  ins.run('A002', 'Siti Rahayu', 'Jl. Melati No. 5', '081234567891', '2024-01-01');
  ins.run('A003', 'Ahmad Fauzi', 'Jl. Dahlia No. 3', '081234567892', '2024-02-01');
  ins.run('A004', 'Dewi Lestari', 'Jl. Anggrek No. 7', '081234567893', '2024-02-15');
  ins.run('A005', 'Eko Prasetyo', 'Jl. Kenanga No. 2', '081234567894', '2024-03-01');
}

// Insert sample simpanan
if (getCount('simpanan') === 0) {
  const ins = db.prepare(`
    INSERT INTO simpanan (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  ins.run(1, 'pokok', 100000, '2024-01-01', 2024, 'Simpanan pokok awal');
  ins.run(2, 'pokok', 100000, '2024-01-01', 2024, 'Simpanan pokok awal');
  ins.run(3, 'pokok', 100000, '2024-02-01', 2024, 'Simpanan pokok awal');
  ins.run(4, 'pokok', 100000, '2024-02-15', 2024, 'Simpanan pokok awal');
  ins.run(5, 'pokok', 100000, '2024-03-01', 2024, 'Simpanan pokok awal');
  ins.run(1, 'wajib', 50000, '2024-01-05', 2024, 'Simpanan wajib Januari');
  ins.run(2, 'wajib', 50000, '2024-01-05', 2024, 'Simpanan wajib Januari');
  ins.run(3, 'wajib', 50000, '2024-02-05', 2024, 'Simpanan wajib Februari');
  ins.run(1, 'wajib', 50000, '2024-02-05', 2024, 'Simpanan wajib Februari');
  ins.run(4, 'wajib', 50000, '2024-03-05', 2024, 'Simpanan wajib Maret');
  ins.run(1, 'sukarela', 200000, '2024-03-10', 2024, 'Simpanan sukarela');
  ins.run(2, 'sukarela', 150000, '2024-04-15', 2024, 'Simpanan sukarela');
  ins.run(3, 'sukarela', 300000, '2024-05-20', 2024, 'Simpanan sukarela');
}

// Insert sample pinjaman
if (getCount('pinjaman') === 0) {
  const ins = db.prepare(`
    INSERT INTO pinjaman (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  ins.run(1, 'pinjaman', 1000000, '2024-02-01', 2024, 'Pinjaman usaha');
  ins.run(1, 'jasa_pinjaman', 50000, '2024-02-01', 2024, 'Jasa pinjaman 5%');
  ins.run(2, 'pinjaman', 500000, '2024-03-01', 2024, 'Pinjaman kebutuhan');
  ins.run(2, 'jasa_pinjaman', 25000, '2024-03-01', 2024, 'Jasa pinjaman 5%');
  ins.run(4, 'pinjaman', 750000, '2024-04-01', 2024, 'Pinjaman pendidikan');
  ins.run(4, 'jasa_pinjaman', 37500, '2024-04-01', 2024, 'Jasa pinjaman 5%');
  ins.run(1, 'angsuran_pokok', 200000, '2024-03-01', 2024, 'Angsuran ke-1');
  ins.run(1, 'angsuran_pokok', 200000, '2024-04-01', 2024, 'Angsuran ke-2');
  ins.run(2, 'angsuran_pokok', 250000, '2024-04-01', 2024, 'Angsuran ke-1');
  ins.run(4, 'angsuran_pokok', 250000, '2024-05-01', 2024, 'Angsuran ke-1');
}

module.exports = db;
