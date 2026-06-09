const XLSX = require('xlsx');
const path = require('path');
const db = require('../database');

const XLSX_PATH = '/root/.claude/uploads/ef943762-3e3e-5f13-b3d9-348c6da129ab/1c40225e-KoperasiRT2025.xlsx';
const TAHUN = 2025;

console.log('=== Import Data Koperasi RT 2025 ===\n');

const wb = XLSX.readFile(XLSX_PATH);

// Baca sheet Simpanan — daftar anggota
const wsSimpanan = wb.Sheets['Simpanan'];
const rowsSimpanan = XLSX.utils.sheet_to_json(wsSimpanan, { header: 1 });

const anggotaExcel = [];
rowsSimpanan.slice(2).forEach(row => {
  if (row[0] && typeof row[0] === 'number' && row[1] && typeof row[1] === 'string') {
    const nama = row[1].trim();
    if (['Kas Koperasi', 'JPS'].includes(nama)) return;
    anggotaExcel.push({
      no:       row[0],
      nama,
      pokok:    row[2]  || 0,
      wajib2017: row[4] || 0,
      wajib2018: row[5] || 0,
      wajib2019: row[6] || 0,
      wajib2020: row[7] || 0,
      wajib2021: row[8] || 0,
      wajib2022: row[9] || 0,
      wajib2023: row[10]|| 0,
      wajib2024: row[11]|| 0,
      wajib2025: row[12]|| 0,
      tabungan:  row[14]|| 0,
    });
  }
});

// Baca sheet Pinjaman
const wsPinjaman = wb.Sheets['Pinjaman'];
const rowsPinjaman = XLSX.utils.sheet_to_json(wsPinjaman, { header: 1 });
const pinjamanMap = {};
rowsPinjaman.slice(6).forEach(row => {
  if (row[0] && typeof row[0] === 'number' && row[1]) {
    const nama = row[1].toString().trim();
    const totalPinjaman  = row[2]  || 0;
    const totalPelunasan = row[7]  || 0;
    const totalJasa      = row[23] || 0;
    if (totalPinjaman > 0 || totalJasa > 0) {
      pinjamanMap[nama] = { totalPinjaman, totalPelunasan, totalJasa };
    }
  }
});

console.log(`Ditemukan ${anggotaExcel.length} anggota dari Excel`);
console.log(`Ditemukan ${Object.keys(pinjamanMap).length} anggota dengan data pinjaman\n`);

// Reset semua data lama
console.log('Menghapus data lama...');
db.exec('DELETE FROM log_perubahan');
db.exec('DELETE FROM pinjaman');
db.exec('DELETE FROM simpanan');
db.exec('DELETE FROM anggota');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('anggota','simpanan','pinjaman','log_perubahan')");
console.log('✓ Data lama dihapus\n');

// Prepared statements
const insAnggota = db.prepare(`
  INSERT INTO anggota (nomor_anggota, nama, alamat, no_hp, tanggal_bergabung, status)
  VALUES (?, ?, ?, ?, ?, 'aktif')
`);
const insSimpanan = db.prepare(`
  INSERT INTO simpanan (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insPinjaman = db.prepare(`
  INSERT INTO pinjaman (anggota_id, jenis, jumlah, tanggal, tahun_buku, keterangan)
  VALUES (?, ?, ?, ?, ?, ?)
`);

console.log('Memasukkan data anggota...');
anggotaExcel.forEach(a => {
  const nomor = 'A' + String(a.no).padStart(3, '0');
  const result = insAnggota.run(nomor, a.nama, '', '', '2017-01-01');
  const aid = result.lastInsertRowid;

  // Simpanan Pokok
  if (a.pokok > 0) {
    insSimpanan.run(aid, 'pokok', a.pokok, '2017-01-01', 2017, 'Simpanan pokok');
  }

  // Simpanan Wajib per tahun
  const wajibTahun = [
    { tahun: 2017, jumlah: a.wajib2017 },
    { tahun: 2018, jumlah: a.wajib2018 },
    { tahun: 2019, jumlah: a.wajib2019 },
    { tahun: 2020, jumlah: a.wajib2020 },
    { tahun: 2021, jumlah: a.wajib2021 },
    { tahun: 2022, jumlah: a.wajib2022 },
    { tahun: 2023, jumlah: a.wajib2023 },
    { tahun: 2024, jumlah: a.wajib2024 },
    { tahun: 2025, jumlah: a.wajib2025 },
  ];
  wajibTahun.forEach(w => {
    if (w.jumlah > 0) {
      insSimpanan.run(aid, 'wajib', w.jumlah, `${w.tahun}-12-31`, w.tahun, `Simpanan wajib ${w.tahun}`);
    }
  });

  // Tabungan (simpanan sukarela)
  if (a.tabungan > 0) {
    insSimpanan.run(aid, 'sukarela', a.tabungan, '2025-07-31', TAHUN, 'Total tabungan s/d Juli 2025');
  }

  // Pinjaman
  const pdata = pinjamanMap[a.nama];
  if (pdata) {
    insPinjaman.run(aid, 'pinjaman', pdata.totalPinjaman, '2025-01-01', TAHUN, 'Total pinjaman s/d 2025');
    if (pdata.totalJasa > 0)
      insPinjaman.run(aid, 'jasa_pinjaman', pdata.totalJasa, '2025-01-01', TAHUN, 'Total jasa pinjaman s/d 2025');
    const pelunasanPokok = pdata.totalPelunasan - pdata.totalJasa;
    if (pelunasanPokok > 0)
      insPinjaman.run(aid, 'angsuran_pokok', pelunasanPokok, '2025-12-31', TAHUN, 'Total pelunasan pokok s/d 2025');
  }

  const totalSimpA = a.pokok + a.wajib2017 + a.wajib2018 + a.wajib2019 + a.wajib2020 +
                     a.wajib2021 + a.wajib2022 + a.wajib2023 + a.wajib2024 + a.wajib2025 + a.tabungan;
  const pinjamanInfo = pdata ? ` | Pinjaman: Rp ${pdata.totalPinjaman.toLocaleString('id-ID')} | Jasa: Rp ${pdata.totalJasa.toLocaleString('id-ID')}` : '';
  console.log(`  ✓ ${nomor} ${a.nama.padEnd(15)} — Simpanan: Rp ${totalSimpA.toLocaleString('id-ID')}${pinjamanInfo}`);
});

// Log import
db.prepare(`INSERT INTO log_perubahan (jenis, tabel, keterangan) VALUES (?,?,?)`)
  .run('tambah', 'anggota', `Import Excel KoperasiRT2025.xlsx — ${anggotaExcel.length} anggota`);

// Verifikasi
const totalAnggota = db.prepare('SELECT COUNT(*) as c FROM anggota').get().c;
const totalSimpanan = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM simpanan').get().t;
const totalPinjaman = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis="pinjaman"').get().t;
const totalJasa = db.prepare('SELECT COALESCE(SUM(jumlah),0) as t FROM pinjaman WHERE jenis="jasa_pinjaman"').get().t;

console.log('\n=== Hasil Import ===');
console.log(`Total anggota  : ${totalAnggota}`);
console.log(`Total simpanan : Rp ${totalSimpanan.toLocaleString('id-ID')}`);
console.log(`Total pinjaman : Rp ${totalPinjaman.toLocaleString('id-ID')}`);
console.log(`Total jasa     : Rp ${totalJasa.toLocaleString('id-ID')}`);
console.log('\n✅ Import selesai!');
