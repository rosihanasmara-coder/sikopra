const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./database');
const { seedUsers } = require('./auth');
const { requireLogin, requireAdmin } = require('./middleware/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'sikopra-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 jam
}));

// Make db & user available in all views
app.locals.db = db;
app.use((req, res, next) => {
  res.locals.sessionUser = req.session.user || null;
  next();
});

// Seed users after DB ready
seedUsers(db);

// Auth routes (public)
app.use('/', require('./routes/auth'));

// Route reset data (sekali pakai untuk migrasi data)
app.get('/reset-data-koperasi-2025', (req, res) => {
  const db = req.app.locals.db;
  const insA = db.prepare(`INSERT INTO anggota (nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status) VALUES (?, ?, '', '', '2017-01-01', 'aktif')`);
  const insS = db.prepare(`INSERT INTO simpanan (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?, ?, ?, ?, ?, ?)`);
  const insP = db.prepare(`INSERT INTO pinjaman  (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan) VALUES (?, ?, ?, ?, ?, ?)`);

  db.exec('DELETE FROM log_perubahan');
  db.exec('DELETE FROM pinjaman');
  db.exec('DELETE FROM simpanan');
  db.exec('DELETE FROM anggota');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('anggota','simpanan','pinjaman','log_perubahan')");

  const anggota = [
    { no:'A001', nama:'Bu Sugeng',   pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000}, tabungan:2950000 },
    { no:'A002', nama:'Bu Guswandi', pokok:10000, wajib:{2022:12000,2023:12000,2024:12000},                                   tabungan:113000  },
    { no:'A003', nama:'Bu Maryono',  pokok:10000, wajib:{2017:24000,2022:12000,2023:12000,2024:12000},                        tabungan:292000  },
    { no:'A004', nama:'Bu Wawan',    pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:120000,  pinjaman:4000000, jasa:200000, pelunasan:4000000 },
    { no:'A005', nama:'Bu Puji',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:190500,  pinjaman:4050000, jasa:202500, pelunasan:4050000 },
    { no:'A006', nama:'Bu Ali',      pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:33500   },
    { no:'A007', nama:'Bu Mala',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:75000,   pinjaman:1500000, jasa:75000,  pelunasan:1500000 },
    { no:'A008', nama:'Bu Nita',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:50000,   pinjaman:2000000, jasa:100000, pelunasan:2000000 },
    { no:'A009', nama:'Bu Tina',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:450000  },
    { no:'A010', nama:'Bu Imam',     pokok:10000, wajib:{},                                                                   tabungan:338000  },
    { no:'A011', nama:'Bu Hendras',  pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:220000  },
    { no:'A012', nama:'Bu Yudo',     pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:803000  },
    { no:'A013', nama:'Bu Uci',      pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:0,       pinjaman:1500000, jasa:75000,  pelunasan:1500000 },
    { no:'A014', nama:'Bu Rosihan',  pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:2800000 },
    { no:'A015', nama:'Bu Utami',    pokok:10000, wajib:{},                                                                   tabungan:550000  },
    { no:'A016', nama:'Bu Priyo',    pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:68000,   pinjaman:1200000, jasa:60000,  pelunasan:1200000 },
    { no:'A017', nama:'Bu Awan',     pokok:10000, wajib:{2024:12000,2025:12000},                                              tabungan:0       },
    { no:'A018', nama:'Bu Arin',     pokok:10000, wajib:{2024:12000,2025:12000},                                              tabungan:0       },
    { no:'A019', nama:'Bu Anisa',    pokok:10000, wajib:{2024:12000,2025:12000},                                              tabungan:27500   },
    { no:'A020', nama:'Bu Dhana',    pokok:10000, wajib:{2024:12000,2025:12000},                                              tabungan:0       },
    { no:'A021', nama:'Bu Arif JL',  pokok:10000, wajib:{},                                                                   tabungan:162500,  pinjaman:750000,  jasa:37500,  pelunasan:750000  },
    { no:'A023', nama:'Bu Erlike',   pokok:10000, wajib:{2017:24000,2018:12000,2019:12000,2022:12000,2023:12000,2024:12000},  tabungan:500000  },
  ];

  anggota.forEach(a => {
    const r = insA.run(a.no, a.nama);
    const aid = r.lastInsertRowid;
    if (a.pokok > 0) insS.run(aid, 'pokok', a.pokok, '2017-01-01', 2017, 'Simpanan pokok');
    Object.entries(a.wajib).forEach(([th, jml]) => {
      if (jml > 0) insS.run(aid, 'wajib', jml, `${th}-12-31`, parseInt(th), `Simpanan wajib ${th}`);
    });
    if (a.tabungan > 0) insS.run(aid, 'sukarela', a.tabungan, '2025-07-31', 2025, 'Total tabungan s/d Juli 2025');
    if (a.pinjaman) {
      insP.run(aid, 'pinjaman',       a.pinjaman,  '2025-01-01', 2025, 'Total pinjaman s/d 2025');
      insP.run(aid, 'jasa_pinjaman',  a.jasa,      '2025-01-01', 2025, 'Total jasa pinjaman s/d 2025');
      insP.run(aid, 'angsuran_pokok', a.pelunasan, '2025-12-31', 2025, 'Total pelunasan pokok s/d 2025');
    }
  });

  // Seed tahun buku 2017–2026
  db.exec('DELETE FROM tahun_buku');
  db.exec("DELETE FROM sqlite_sequence WHERE name='tahun_buku'");
  const insTahun = db.prepare('INSERT INTO tahun_buku (tahun, status, keterangan) VALUES (?, ?, ?)');
  for (let y = 2017; y <= 2025; y++) {
    insTahun.run(y, y < 2025 ? 'terkunci' : 'aktif', y < 2025 ? 'Tahun buku historis' : 'Tahun buku aktif');
  }
  insTahun.run(2026, 'aktif', 'Tahun buku berjalan');

  res.send(`
    <style>body{font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center}</style>
    <h2>✅ Reset berhasil!</h2>
    <p>22 anggota dan tahun buku 2017–2026 telah dimuat.</p>
    <a href="/anggota" style="display:inline-block;margin:8px;padding:10px 20px;background:#3f51b5;color:#fff;border-radius:6px;text-decoration:none">→ Lihat Anggota</a>
    <a href="/tahun-buku" style="display:inline-block;margin:8px;padding:10px 20px;background:#4caf50;color:#fff;border-radius:6px;text-decoration:none">→ Lihat Tahun Buku</a>
  `);
});

// Routes anggota & user (harus SEBELUM requireAdmin catch-all)
app.use('/member', require('./routes/member'));
app.use('/users', require('./routes/users'));

// Routes admin only
app.use('/', requireAdmin, require('./routes/dashboard'));
app.use('/anggota', requireAdmin, require('./routes/anggota'));
app.use('/simpanan', requireAdmin, require('./routes/simpanan'));
app.use('/pinjaman', requireAdmin, require('./routes/pinjaman'));
app.use('/shu', requireAdmin, require('./routes/shu'));
app.use('/laporan-anggota', requireAdmin, require('./routes/laporan'));
app.use('/laporan', requireLogin, require('./routes/export'));
app.use('/rekonsiliasi', requireAdmin, require('./routes/rekonsiliasi'));
app.use('/anomali', requireAdmin, require('./routes/anomali'));
app.use('/tahun-buku', requireAdmin, require('./routes/tahunBuku'));
app.use('/log-perubahan', requireAdmin, require('./routes/logPerubahan'));
app.use('/pengaturan', requireAdmin, require('./routes/pengaturan'));

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`SiKopra berjalan di http://localhost:${PORT}`);
});
