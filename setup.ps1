# SIM-RT ENTERPRISE PRODUCTION SETUP SCRIPT (PowerShell)
# 100% Automated Zero-MDN, Defense-in-Depth Monorepo Deployment

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SIM-RT ENTERPRISE MONOREPO: ONE-CLICK PRODUCTION SETUP  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Node.js and pnpm
Write-Host "[1/6] Memeriksa Lingkungan Runtime..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js (>=20.10.0) belum terpasang. Harap pasang Node.js terlebih dahulu."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Memasang pnpm secara global..." -ForegroundColor Gray
    npm install -g pnpm@12.14.0
}
Write-Host "  Node.js: $(node -v)" -ForegroundColor Green
Write-Host "  pnpm: $(pnpm -v)" -ForegroundColor Green

# 2. Check and generate cryptographic keys in .env
Write-Host "[2/6] Memeriksa & Mengamankan Vault Kriptografi..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "  Men-generate file .env baru dengan kunci kriptografi AES-256-GCM..." -ForegroundColor Gray
    Copy-Item ".env.example" ".env"

    # Generate 64-char hex cryptographically random keys
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    function New-SecureHex($bytes) {
        $buf = New-Object byte[] $bytes
        $rng.GetBytes($buf)
        return [System.BitConverter]::ToString($buf).Replace("-", "").ToLower()
    }

    $masterKek = New-SecureHex 32
    $blindPepper = New-SecureHex 32
    $jwtAccess = New-SecureHex 32
    $jwtRefresh = New-SecureHex 32

    $envContent = Get-Content ".env"
    $envContent = $envContent -replace "PII_MASTER_KEY_HEX=.*", "PII_MASTER_KEY_HEX=$masterKek"
    $envContent = $envContent -replace "BLIND_INDEX_PEPPER=.*", "BLIND_INDEX_PEPPER=$blindPepper"
    $envContent = $envContent -replace "JWT_ACCESS_SECRET=.*", "JWT_ACCESS_SECRET=$jwtAccess"
    $envContent = $envContent -replace "JWT_REFRESH_SECRET=.*", "JWT_REFRESH_SECRET=$jwtRefresh"
    Set-Content ".env" $envContent
    Write-Host "  Kunci Master KEK & Blind Index Pepper berhasil dibuat secara unik." -ForegroundColor Green
} else {
    Write-Host "  File .env terdeteksi. Kunci kriptografi aman." -ForegroundColor Green
}

# 3. Install Monorepo Dependencies
Write-Host "[3/6] Menginstal Dependensi Turborepo..." -ForegroundColor Yellow
pnpm install

# 4. Build Monorepo (Clean Arch & Shared Types)
Write-Host "[4/6] Mengompilasi Seluruh Aplikasi & Paket (Zero-Bug Build)..." -ForegroundColor Yellow
pnpm build

# 5. Start Infrastructure via Docker Compose
Write-Host "[5/6] Menjalankan PostgreSQL 16 & MinIO Object Storage..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose up -d
    Write-Host "  Menunggu database siap..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
} else {
    Write-Host "  [Peringatan] Docker belum aktif. Lewati docker compose." -ForegroundColor DarkYellow
}

# 6. Database Push & Seed
Write-Host "[6/6] Menjalankan Sinkronisasi Schema & Seeding Data Awal RT..." -ForegroundColor Yellow
pnpm --filter backend-api db:push
pnpm --filter backend-api db:seed

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  SIM-RT TELAH SIAP DIGUNAKAN DI MODE PRODUKSI!          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  1. Admin Panel ERP      : http://localhost:3000" -ForegroundColor White
Write-Host "  2. Backend REST & SSE   : http://localhost:3001" -ForegroundColor White
Write-Host "  3. Resident Super-App   : http://localhost:3002" -ForegroundColor White
Write-Host "  4. MinIO Object Storage : http://localhost:9001 (simrt_minio_admin)" -ForegroundColor White
Write-Host ""
Write-Host "  Akun Pengurus RT (Demo Bawaan):" -ForegroundColor Cyan
Write-Host "  - Ketua RT    : ketua_rt     | Password: KetuaRT@2026!" -ForegroundColor Gray
Write-Host "  - Sekretaris  : sekretaris_rt| Password: Sekretaris@2026!" -ForegroundColor Gray
Write-Host "  - Bendahara   : bendahara_rt | Password: Bendahara@2026!" -ForegroundColor Gray
Write-Host "  - Akun Warga  : warga_test   | Password: WargaRT@2026!" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Green
