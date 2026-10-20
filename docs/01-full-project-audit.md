# 01 Full Project Audit & Architecture Map

Dokumen audit menyeluruh arsitektur monorepo, paket dependensi, database schema, dan kepatuhan sistem.

---

## 1. Inventaris Monorepo & Dependensi

| Paket | Path | Runtime / Framework | Peran Utama |
|---|---|---|---|
| `@simrt/shared-types` | `packages/shared-types` | TypeScript 5.8 | Sumber kebenaran tipe data, DTO, Enums, dan Response Contracts |
| `@simrt/ui-kit` | `packages/ui-kit` | React 19, Tailwind, Lucide | Design system, Enterprise Tokens, PII Disclosure Gate, Forensic Viewer |
| `backend-api` | `apps/backend-api` | Fastify 5, Node.js 22, Prisma | RESTful API, Crypto Adapter (AES-256-GCM + HMAC), Ed25519 Signer |
| `admin-panel` | `apps/admin-panel` | React 19, Vite, Tailwind | Panel kerja pengurus RT, House Member Workbench, Kas & Surat Ledger |
| `resident-mobile` | `apps/resident-mobile` | React 19, Vite, Capacitor 6 | Aplikasi warga (Android APK + Web PWA) untuk layanan mandiri & iuran |

---

## 2. Skema Database Kependudukan & Relasi Inti

Berdasarkan `prisma/schema.prisma`:

### A. Tabel `RumahKavling`
- `id` (UUID, Primary Key)
- `kodeBlok` (String, Unique, misal `A-01`)
- `nomorRumah` (String, misal `12`)
- `alamat` (String)
- `statusHunian` (`StatusHunian`: `DIHUNI_PEMILIK`, `DIHUNI_PENYEWA`, `KOSONG`)
- `latitude`, `longitude` (Float, Nullable untuk pemetaan GPS denah RT)
- Relasi: `kartuKeluarga` (`KartuKeluarga[]`)

### B. Tabel `KartuKeluarga`
- `id` (UUID, Primary Key)
- `rumahId` (UUID, Foreign Key ke `RumahKavling.id`)
- `noKkEncrypted` (String, Ciphertext AES-256-GCM)
- `noKkBlindIndex` (String, HMAC-SHA256 untuk indeks unik)
- `noKkMasked` (String, 16 karakter dengan masking)
- `statusDomisili` (`StatusDomisili`: `TETAP`, `KONTRAK`)
- `statusVerifikasi` (`StatusVerifikasi`: `PENDING`, `VERIFIED`, `REJECTED`)
- `fileKkPath` (String, path berkas tersimpan di storage terisolasi)
- Relasi: `warga` (`Warga[]`), `tagihanIuran` (`TagihanIuran[]`)

### C. Tabel `Warga`
- `id` (UUID, Primary Key)
- `kkId` (UUID, Foreign Key ke `KartuKeluarga.id`)
- `nikEncrypted`, `nikBlindIndex`, `nikMasked`
- `namaLengkap`, `tempatLahir`, `tanggalLahir`
- `jenisKelamin` (`JenisKelamin`: `LAKI_LAKI`, `PEREMPUAN`)
- `golonganDarah` (`GolonganDarah`: `A_POSITIF`, `B_POSITIF`, `AB_POSITIF`, `O_POSITIF`, dll)
- `agama` (`Agama`: `ISLAM`, `KRISTEN`, `KATOLIK`, `HINDU`, `BUDDHA`, `KONGHUCU`)
- `statusPerkawinan` (`StatusPerkawinan`: `BELUM_KAWIN`, `KAWIN`, `CERAI_HIDUP`, `CERAI_MATI`)
- `pekerjaan` (String)
- `hubunganKeluarga` (`HubunganKeluarga`: `KEPALA_KELUARGA`, `ISTRI`, `ANAK`, `ORANG_TUA`, `LAINNYA`)
- `isLansia`, `isBalita`, `isDisabilitas`, `isIbuHamil` (Boolean flags)

---

## 3. Jalur Verifikasi & Build Status

- **Monorepo Build Orchestration:** Menggunakan `turbo run build`. Seluruh 5 paket berhasil dikompilasi tanpa galat TypeScript maupun linting.
- **Unit & Crypto Test Coverage:** Dijalankan dengan Vitest (`npm test`). 14 tests lolos 100% mencakup:
  1. `crypto.test.ts`: Uji enkripsi AES-256-GCM bolak-balik dengan IV acak 12-byte dan auth tag 16-byte.
  2. `blind-index.test.ts`: Uji kestabilan Blind Index HMAC-SHA256 untuk pencarian data NIK tanpa pernah membuka enkripsi.
  3. `hash-chain.test.ts`: Uji integritas log tamper-evident SHA-256.
  4. `ed25519.test.ts`: Uji pembuatan pasangan kunci dan verifikasi tanda tangan digital e-surat.
  5. `pagination.test.ts`: Uji kepatuhan pagination meta data.
- **Android APK Build:**
  - Android SDK Path: `C:\Users\adam.cid00676\AppData\Local\Android\Sdk`
  - Java JDK Path: `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`
  - Output binary: `release-apk/simrt-warga-v1.0.0-debug.apk` (ukuran: ±6.6 MB).
