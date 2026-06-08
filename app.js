const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Make db available in routes
app.locals.db = db;

// Routes
app.use('/', require('./routes/dashboard'));
app.use('/anggota', require('./routes/anggota'));
app.use('/simpanan', require('./routes/simpanan'));
app.use('/pinjaman', require('./routes/pinjaman'));
app.use('/shu', require('./routes/shu'));
app.use('/laporan-anggota', require('./routes/laporan'));
app.use('/rekonsiliasi', require('./routes/rekonsiliasi'));
app.use('/anomali', require('./routes/anomali'));
app.use('/tahun-buku', require('./routes/tahunBuku'));
app.use('/log-perubahan', require('./routes/logPerubahan'));
app.use('/pengaturan', require('./routes/pengaturan'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SiKopra berjalan di http://localhost:${PORT}`);
});
