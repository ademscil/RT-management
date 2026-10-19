# SIM-RT Enterprise Monorepo v3.0

> **Sistem Informasi Manajemen Rukun Tetangga (SIM-RT)** berskala produksi penuh menggunakan pendekatan **Strict Clean Architecture**, **Defense-in-Depth Security Audited**, dan **100% Open Source Stack** (Zero External Subscriptions).

---

## 1. Arsitektur Monorepo & Filosofi Sistem

SIM-RT dibangun di atas **Turborepo** dan **pnpm workspaces** yang membagi sistem ke dalam 3 aplikasi utama dan 2 pustaka bersama:

```
manajemen rt/
├── apps/
│   ├── backend-api/         # Fastify 5 REST & SSE Server, PII Cryptographic Vault, Ed25519 Signer, Sharp Sanitizer
│   ├── admin-panel/         # RT Command Center & Backoffice ERP (Desktop & Tablet Optimized, React 19 + Vite 6)
│   └── resident-mobile/     # Resident Super-App (Mobile-First Web + Native Android .aab via CapacitorJS 6)
├── packages/
│   ├── shared-types/        # DTO, Zod Schemas, Domain Entities, Types murni (Zero dependencies)
│   └── ui-kit/              # Design System Tailwind CSS, 5-Tier Notifications, Reusable UI Components
├── docker/
│   ├── postgres-init/       # Script inisialisasi native PostgreSQL 16 Row-Level Security (RLS)
│   └── caddy/               # Caddyfile produksi: Reverse Proxy, TLS otomatis, HTTP/2 & CSP Headers
├── setup.ps1 / setup.sh     # Script instalasi & deployment satu-klik
└── docker-compose.prod.yml  # Orkestrasi kontainer produksi lengkap
```

---

## 2. Batasan Arsitektur Mutlak (Hard Constraints)

1. **ZERO MDN & ZERO EXTERNAL PUSH GATEWAY**:
   - **100% Bebas Pulsa/SMS/WA/Telegram/Email**: Tidak menggunakan nomor HP (MDN), SMS gateway, WhatsApp API, ataupun Firebase Cloud Messaging (FCM).
   - **Onboarding Mandiri**: Cetak Lembar Kartu QR Aktivasi A4 (8 kartu per lembar dengan garis potong) dari Admin Panel $\to$ Dipindai melalui kamera aplikasi Android warga.
   - **Pemulihan Akun**: 8-Digit Kode Pemulihan Offline (diunduh/disimpan saat aktivasi pertama) + Reset Tatap Muka oleh Pengurus RT.
   - **Real-Time & Offline Notification**: Kombinasi **HTTP Server-Sent Events (SSE)** saat aplikasi terbuka + **In-App Notification Center** + **Capacitor Local Notifications** internal perangkat OS untuk ronda & jatuh tempo iuran.

2. **DEFENSE-IN-DEPTH SECURITY SPECIFICATIONS**:
   - **Envelope Encryption (`AES-256-GCM`)**: Dokumen KTP & KK dienkripsi menggunakan *Data Encryption Key (DEK)* 256-bit unik per baris, dan didekripsi dengan Master *Key Encryption Key (KEK)* bervariasi `key_version`.
   - **Blind Indexing (`HMAC-SHA256`)**: Kolom `nik_blind_index` dan `no_kk_blind_index` dengan secret pepper untuk pencarian eksak tanpa membuka cipher data pribadi.
   - **Anti-Tamper Hash-Chaining**: Tabel `security_audit_logs` dan `kas_ledger_immutable` menggunakan rantai hash kriptografis `SHA256(prev_hash + ...)`. Dilengkapi fitur *"Verify Ledger & Audit Integrity"* di Admin Panel.
   - **PostgreSQL Native Row-Level Security (RLS)**: Enforced pada tabel `kartu_keluarga`, `warga`, `dokumen_vault`, `pengajuan_surat`, dan `tagihan_iuran` dengan konteks sesi database transaction wrapper.
   - **Anti-Polyglot Image Sanitizer & Dual Watermarking**: Upload foto KTP/KK/Struk kas didekode piksel mentah dan di-encode ulang menjadi WebP baru (menghancurkan metadata EXIF/GPS). Dokumen diberi watermark statis diagonal `"DOKUMEN VERIFIKASI RT"` dan overlay forensik transparan `"[NAMA_ADMIN] - [IP] - [TIMESTAMP]"`.
   - **Android `FLAG_SECURE`**: Layar otomatis diblokir dari *screenshot* dan *screen recording* saat menampilkan data PII KTP/KK atau kode pemulihan.

---

## 3. Akun Uji Coba Bawaan (Default Seed Credentials)

Setelah menjalankan seeding database, akun-akun berikut siap digunakan:

| Peran | Username | Password | Deskripsi Akses |
|---|---|---|---|
| **Ketua RT** | `ketua_rt` | `KetuaRT@2026!` | Maker-Checker TTD Ed25519 E-Surat, Command Center Map, Audit Log |
| **Sekretaris RT** | `sekretaris_rt` | `Sekretaris@2026!` | Verifikasi Berkas KTP/KK Warga, Cetak Lembar Kartu QR A4, Verifikasi Surat |
| **Bendahara RT** | `bendahara_rt` | `Bendahara@2026!` | Penagihan Iuran Kas Bulanan, Verifikasi Struk Transfer, Ledger Kas SHA-256 |
| **Warga Test** | `warga_test` | `WargaRT@2026!` | Super-App Warga: Permohonan E-Surat, Bayar Iuran, Cek Jadwal Ronda |

---

## 4. Panduan Menjalankan Sistem

### Persyaratan Minimum
- **Node.js**: `v20.10.0` atau lebih baru
- **pnpm**: `v9.0.0` atau `v12.14.0`
- **Docker & Docker Compose**

### Cara Cepat (One-Click Setup)

**Pada Windows (PowerShell):**
```powershell
./setup.ps1
```

**Pada Linux / macOS (Bash):**
```bash
chmod +x ./setup.sh
./setup.sh
```

### Menjalankan Secara Manual (Development Mode)

1. **Pasang Dependensi**:
   ```bash
   pnpm install
   ```

2. **Jalankan Database & Storage**:
   ```bash
   docker compose up -d
   ```

3. **Sinkronisasi Schema Database & Seed Data**:
   ```bash
   pnpm db:push
   pnpm db:seed
   ```

4. **Jalankan Seluruh Aplikasi Secara Paralel**:
   ```bash
   pnpm dev
   ```

Akses layanan melalui peramban:
- **Admin Panel Command Center**: [http://localhost:3000](http://localhost:3000)
- **Backend API Server & SSE**: [http://localhost:3001](http://localhost:3001)
- **Resident Super-App**: [http://localhost:3002](http://localhost:3002)
- **MinIO Object Storage Console**: [http://localhost:9001](http://localhost:9001) (User: `simrt_minio_admin`)

---

## 5. Rilis Aplikasi Android (.apk / .aab)

Aplikasi warga (`apps/resident-mobile`) telah dilengkapi konfigurasi **CapacitorJS 6** siap Google Play Store:

```bash
cd apps/resident-mobile
pnpm cap:build:android
```

File Android native terletak di `apps/resident-mobile/android-setup/`:
- `MainActivity.java`: Dilengkapi `FLAG_SECURE` anti-screenshot.
- `AndroidManifest.xml`: Izin kamera lokal, local notifications alarm, dan network security config.
- `proguard-rules.pro`: Optimasi dan proteksi kode release.

---

## 6. Prosedur Pencadangan & Pemulihan Bencana (Disaster Recovery)

Untuk mencadangkan database PostgreSQL, lampiran dokumen MinIO, dan memvalidasi rantai hash:

```powershell
# Windows
./scripts/backup-dr.ps1

# Linux / macOS
./scripts/backup-dr.sh
```

File cadangan akan disimpan dalam folder `./backups/` dengan enkripsi simetris GPG AES-256.

---

## 7. Lisensi
Hak Cipta (c) 2026 SIM-RT Development Team. Dilindungi di bawah lisensi terbuka (Open Source).
