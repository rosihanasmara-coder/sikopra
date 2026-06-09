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
CREATE TABLE IF NOT EXISTS shu_komponen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  kode TEXT NOT NULL UNIQUE,
  persentase REAL NOT NULL DEFAULT 0,
  deskripsi TEXT,
  tipe TEXT NOT NULL DEFAULT 'umum',
  urutan INTEGER DEFAULT 0,
  aktif INTEGER DEFAULT 1
);

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
  ins.run('jasa_pinjaman_default', '5', 'Persentase jasa pinjaman default');
  ins.run('tahun_aktif', currentYear, 'Tahun buku aktif');
}

// Auto-reset: hapus data contoh lama jika masih ada (Budi Santoso / Siti Rahayu)
const dataLama = db.prepare("SELECT id FROM anggota WHERE nama IN ('Budi Santoso','Siti Rahayu') LIMIT 1").get();
if (dataLama) {
  db.exec('DELETE FROM log_perubahan');
  db.exec('DELETE FROM pinjaman');
  db.exec('DELETE FROM simpanan');
  db.exec('DELETE FROM anggota');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('anggota','simpanan','pinjaman','log_perubahan')");
}

// Insert default komponen SHU
if (getCount('shu_komponen') === 0) {
  const ins = db.prepare(`INSERT INTO shu_komponen (nama, kode, persentase, deskripsi, tipe, urutan) VALUES (?,?,?,?,?,?)`);
  ins.run('Cadangan / KAS', 'cadangan', 2, 'Dana cadangan dan KAS koperasi', 'cadangan', 1);
  ins.run('SHU Anggota Peminjam', 'peminjam', 59, 'Dibagi proporsional berdasarkan jasa pinjaman anggota', 'anggota_peminjam', 2);
  ins.run('SHU Anggota Simpanan', 'simpanan', 39, 'Dibagi proporsional berdasarkan total simpanan anggota', 'anggota_simpanan', 3);
}

// Insert default tahun buku
if (getCount('tahun_buku') === 0) {
  for (let y = 2017; y <= 2025; y++) {
    db.prepare('INSERT INTO tahun_buku (tahun, status) VALUES (?, ?)').run(y, y < 2025 ? 'terkunci' : 'aktif');
  }
}

// Data anggota dari KoperasiRT2025.xlsx
if (getCount('anggota') === 0) {
  const insA = db.prepare(`INSERT INTO anggota (nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status) VALUES (?, ?, '', '', '2017-01-01', 'aktif')`);
  const insS = db.prepare(`INSERT INTO simpanan (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?, ?, ?, ?, ?, ?)`);
  const insP = db.prepare(`INSERT INTO pinjaman  (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?, ?, ?, ?, ?, ?)`);

  const anggota = [
    { no:'A001', nama:'Bu Sugeng',   pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},        tabungan:2950000 },
    { no:'A002', nama:'Bu Guswandi', pokok:10000, wajib:{2022:12000,2023:12000,2024:12000},                                          tabungan:113000  },
    { no:'A003', nama:'Bu Maryono',  pokok:10000, wajib:{2017:24000,2022:12000,2023:12000,2024:12000},                               tabungan:292000  },
    { no:'A004', nama:'Bu Wawan',    pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:120000,  pinjaman:4000000, jasa:200000, pelunasan:4000000 },
    { no:'A005', nama:'Bu Puji',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:190500,  pinjaman:4050000, jasa:202500, pelunasan:4050000 },
    { no:'A006', nama:'Bu Ali',      pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:33500   },
    { no:'A007', nama:'Bu Mala',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:75000,   pinjaman:1500000, jasa:75000,  pelunasan:1500000 },
    { no:'A008', nama:'Bu Nita',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:50000,   pinjaman:2000000, jasa:100000, pelunasan:2000000 },
    { no:'A009', nama:'Bu Tina',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:450000  },
    { no:'A010', nama:'Bu Imam',     pokok:10000, wajib:{},                                                                          tabungan:338000  },
    { no:'A011', nama:'Bu Hendras',  pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:220000  },
    { no:'A012', nama:'Bu Yudo',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:803000  },
    { no:'A013', nama:'Bu Uci',      pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:0,       pinjaman:1500000, jasa:75000,  pelunasan:1500000 },
    { no:'A014', nama:'Bu Rosihan',  pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:2800000 },
    { no:'A015', nama:'Bu Utami',    pokok:10000, wajib:{},                                                                          tabungan:550000  },
    { no:'A016', nama:'Bu Priyo',    pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:68000,   pinjaman:1200000, jasa:60000,  pelunasan:1200000 },
    { no:'A017', nama:'Bu Awan',     pokok:10000, wajib:{2024:12000,2025:12000},                                                     tabungan:0       },
    { no:'A018', nama:'Bu Arin',     pokok:10000, wajib:{2024:12000,2025:12000},                                                     tabungan:0       },
    { no:'A019', nama:'Bu Anisa',    pokok:10000, wajib:{2024:12000,2025:12000},                                                     tabungan:27500   },
    { no:'A020', nama:'Bu Dhana',    pokok:10000, wajib:{2024:12000,2025:12000},                                                     tabungan:0       },
    { no:'A021', nama:'Bu Arif JL',  pokok:10000, wajib:{},                                                                          tabungan:162500,  pinjaman:750000,  jasa:37500,  pelunasan:750000  },
    { no:'A023', nama:'Bu Erlike',   pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},         tabungan:500000  },
  ];

  anggota.forEach(a => {
    const r = insA.run(a.no, a.nama);
    const aid = r.lastInsertRowid;
    // Simpanan pokok
    if (a.pokok > 0) insS.run(aid, 'pokok', a.pokok, '2017-01-01', 2017, 'Simpanan pokok');
    // Simpanan wajib per tahun
    Object.entries(a.wajib).forEach(([th, jml]) => {
      if (jml > 0) insS.run(aid, 'wajib', jml, `${th}-12-31`, parseInt(th), `Simpanan wajib ${th}`);
    });
    // Tabungan
    if (a.tabungan > 0) insS.run(aid, 'sukarela', a.tabungan, '2025-07-31', 2025, 'Total tabungan s/d Juli 2025');
    // Pinjaman
    if (a.pinjaman) {
      insP.run(aid, 'pinjaman',      a.pinjaman,  '2025-01-01', 2025, 'Total pinjaman s/d 2025');
      insP.run(aid, 'jasa_pinjaman', a.jasa,      '2025-01-01', 2025, 'Total jasa pinjaman s/d 2025');
      insP.run(aid, 'angsuran_pokok',a.pelunasan, '2025-12-31', 2025, 'Total pelunasan pokok s/d 2025');
    }
  });
}

module.exports = db;
