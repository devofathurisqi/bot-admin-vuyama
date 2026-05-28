#!/bin/bash

# Exit immediately if any command fails
set -e

echo "=========================================================="
echo "      VUYAMA CS SUITE - AUTOMATED DEPLOYMENT SCRIPT       "
echo "=========================================================="
echo "Menyiapkan server Linux VPS Anda untuk produksi..."
echo ""

# 1. Update system packages
echo "[1/5] Memperbarui paket sistem operasi..."
sudo apt update && sudo apt upgrade -y

# 2. Install Puppeteer Chrome OS dependencies
echo "[2/5] Menginstal OS dependencies untuk Puppeteer & Chrome..."
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
  libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
  libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
  libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev

# 3. Install Node.js (v18 LTS) if not present
if ! command -v node &> /dev/null; then
    echo "[3/5] Node.js belum terdeteksi. Menginstal Node.js v18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "Node.js berhasil diinstal: $(node -v)"
else
    echo "[3/5] Node.js sudah terpasang: $(node -v)"
fi

# 4. Install PM2 (Process Manager) globally
if ! command -v pm2 &> /dev/null; then
    echo "[4/5] Menginstal PM2 Process Manager secara global..."
    sudo npm install -g pm2
else
    echo "[4/5] PM2 sudah terpasang."
fi

# 5. Install Node project dependencies
echo "[5/5] Menginstal NPM dependencies proyek Vuyama..."
npm install

echo ""
echo "=========================================================="
echo "          PROSES SETUP SERVER SELESAI DENGAN SUKSES!      "
echo "=========================================================="
echo "Langkah selanjutnya:"
echo "1. Pastikan Anda telah membuat & mengisi file '.env' di server."
echo "2. Jalankan bot WhatsApp & server dashboard Anda dengan:"
echo "   pm2 start src/index.js --name 'vuyama-bot-suite'"
echo "3. Agar bot otomatis menyala jika server restart, jalankan:"
echo "   pm2 startup && pm2 save"
echo "=========================================================="
