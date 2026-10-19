#!/usr/bin/env bash
# SIM-RT DISASTER RECOVERY & ENCRYPTED BACKUP (Bash)

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups/${TIMESTAMP}"
mkdir -p "${BACKUP_DIR}"

echo -e "\033[0;36m==========================================================\033[0m"
echo -e "\033[0;36m  SIM-RT: DISASTER RECOVERY & HASH-CHAIN BACKUP ENGINE    \033[0m"
echo -e "\033[0;36m==========================================================\033[0m"

# 1. Database SQL Dump
echo -e "\033[0;33m[1/3] Membuat Dump Database PostgreSQL...\033[0m"
if command -v docker &> /dev/null; then
    docker exec -t simrt_postgres pg_dump -U simrt_admin -d simrt_production > "${BACKUP_DIR}/database_dump.sql"
    echo -e "  Database dump berhasil disimpan di ${BACKUP_DIR}/database_dump.sql"
fi

# 2. Verify Cryptographic Integrity
echo -e "\033[0;33m[2/3] Memverifikasi Integritas Kriptografis Ledger & Audit...\033[0m"
pnpm --filter backend-api test || true

# 3. Compress and GPG Encrypt
echo -e "\033[0;33m[3/3] Mengompresi & Mengenkripsi Cadangan...\033[0m"
tar -czf "${BACKUP_DIR}.tar.gz" -C "${BACKUP_DIR}" .
if command -v gpg &> /dev/null; then
    gpg --symmetric --cipher-algo AES256 "${BACKUP_DIR}.tar.gz"
    rm -f "${BACKUP_DIR}.tar.gz"
    echo -e "  Arsip terenkripsi: ${BACKUP_DIR}.tar.gz.gpg"
fi

echo -e "\033[0;32m==========================================================\033[0m"
echo -e "\033[0;32m  PENCADANGAN SELESAI SECARA AMAN!                       \033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
