#!/bin/bash
# Script untuk menjalankan SiKopra di Mac
# Klik dua kali file ini untuk memulai aplikasi

# Pindah ke folder script ini berada
cd "$(dirname "$0")"

echo "======================================="
echo "  SiKopra — Sistem Informasi Koperasi  "
echo "======================================="
echo ""

# Cek Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js tidak ditemukan!"
  echo "   Download di: https://nodejs.org"
  read -p "Tekan Enter untuk keluar..."
  exit 1
fi

echo "✅ Node.js: $(node --version)"

# Install dependencies jika belum ada
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 Menginstall dependencies (hanya sekali)..."
  npm install
  echo "✅ Dependencies berhasil diinstall"
fi

echo ""
echo "🚀 Menjalankan SiKopra..."
echo "   Buka browser: http://localhost:3005"
echo "   Tekan Ctrl+C untuk menghentikan"
echo ""

node app.js
