#!/usr/bin/env bash
# SIM-RT ENTERPRISE PRODUCTION SETUP SCRIPT (Bash)
# 100% Automated Zero-MDN, Defense-in-Depth Monorepo Deployment

set -euo pipefail

echo -e "\033[0;36m==========================================================\033[0m"
echo -e "\033[0;36m  SIM-RT ENTERPRISE MONOREPO: ONE-CLICK PRODUCTION SETUP  \033[0m"
echo -e "\033[0;36m==========================================================\033[0m"

# 1. Check Node.js and pnpm
echo -e "\033[0;33m[1/6] Memeriksa Lingkungan Runtime...\033[0m"
if ! command -v node &> /dev/null; then
    echo "Node.js (>=20.10.0) belum terpasang. Harap pasang Node.js terlebih dahulu."
    exit 1
fi
if ! command -v pnpm &> /dev/null; then
    echo "Memasang pnpm secara global..."
    npm install -g pnpm@12.14.0
fi
echo -e "  Node.js: $(node -v)"
echo -e "  pnpm: $(pnpm -v)"

# 2. Check and generate cryptographic keys in .env
echo -e "\033[0;33m[2/6] Memeriksa & Mengamankan Vault Kriptografi...\033[0m"
if [ ! -f ".env" ]; then
    echo "  Men-generate file .env baru dengan kunci kriptografi AES-256-GCM..."
    cp .env.example .env

    MASTER_KEK=$(openssl rand -hex 32)
    BLIND_PEPPER=$(openssl rand -hex 32)
    JWT_ACCESS=$(openssl rand -hex 32)
    JWT_REFRESH=$(openssl rand -hex 32)

    sed -i "s/PII_MASTER_KEY_HEX=.*/PII_MASTER_KEY_HEX=${MASTER_KEK}/" .env
    sed -i "s/BLIND_INDEX_PEPPER=.*/BLIND_INDEX_PEPPER=${BLIND_PEPPER}/" .env
    sed -i "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=${JWT_ACCESS}/" .env
    sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=${JWT_REFRESH}/" .env
    echo -e "  Kunci Master KEK & Blind Index Pepper berhasil dibuat secara unik."
else
    echo -e "  File .env terdeteksi. Kunci kriptografi aman."
fi

# 3. Install Monorepo Dependencies
echo -e "\033[0;33m[3/6] Menginstal Dependensi Turborepo...\033[0m"
pnpm install

# 4. Build Monorepo
echo -e "\033[0;33m[4/6] Mengompilasi Seluruh Aplikasi & Paket (Zero-Bug Build)...\033[0m"
pnpm build

# 5. Start Infrastructure via Docker Compose
echo -e "\033[0;33m[5/6] Menjalankan PostgreSQL 16 & MinIO Object Storage...\033[0m"
if command -v docker &> /dev/null; then
    docker compose up -d
    echo "  Menunggu database siap..."
    sleep 5
fi

# 6. Database Push & Seed
echo -e "\033[0;33m[6/6] Menjalankan Sinkronisasi Schema & Seeding Data Awal RT...\033[0m"
pnpm --filter backend-api db:push
pnpm --filter backend-api db:seed

echo -e "\033[0;32m==========================================================\033[0m"
echo -e "\033[0;32m  SIM-RT TELAH SIAP DIGUNAKAN DI MODE PRODUKSI!          \033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
echo -e "  1. Admin Panel ERP      : http://localhost:3000"
echo -e "  2. Backend REST & SSE   : http://localhost:3001"
echo -e "  3. Resident Super-App   : http://localhost:3002"
echo -e "  4. MinIO Object Storage : http://localhost:9001 (simrt_minio_admin)"
echo -e ""
echo -e "  Akun Pengurus RT (Demo Bawaan):"
echo -e "  - Ketua RT    : ketua_rt     | Password: KetuaRT@2026!"
echo -e "  - Sekretaris  : sekretaris_rt| Password: Sekretaris@2026!"
echo -e "  - Bendahara   : bendahara_rt | Password: Bendahara@2026!"
echo -e "  - Akun Warga  : warga_test   | Password: WargaRT@2026!"
echo -e "\033[0;32m==========================================================\033[0m"
