# 00 Konteks Project SIM-RT (Sistem Informasi Manajemen Rukun Tetangga)

Dokumen ini adalah baseline permanen agar seluruh pengembang, auditor, dan autonomous AI agent memahami arsitektur, domain bisnis, batasan regulasi, dan riwayat sistem tanpa kehilangan konteks maupun berhalusinasi.

> [!IMPORTANT]
> **Klarifikasi Penamaan & Cakupan Sistem**
> - **Nama Resmi Platform:** **SIM-RT** (Sistem Informasi Manajemen Rukun Tetangga).
> - **Target Lingkungan:** Lingkungan RT 05 / RW 02, Kelurahan Sukamaju, Kecamatan Cilodong, Kota Depok, Jawa Barat.
> - **Domain Bisnis Utama:** Digitalisasi tata kelola kependudukan (Kavling/Rumah, KK, Biodata Warga), pelayanan persuratan elektronik warga (Pengantar KTP/KK, Domisili, Keterangan Usaha/Kematian), transparansi keuangan kas dan penagihan iuran warga terverifikasi, kanal informasi kegiatan warga, serta panic button darurat lingkungan.
> - **Kepatuhan Hukum Wajib:** Undang-Undang Perlindungan Data Pribadi (UU PDP No. 27/2022) — NIK dan Nomor KK adalah data pribadi spesifik yang wajib dienkripsi di tingkat database (AES-256-GCM), diindeks menggunakan Blind Index (HMAC-SHA256), dan seluruh akses buka data wajib melewati audit trail hash-chain kriptografis (SHA-256 tamper-evident log).

---

## 1. Verifikasi Status Repository

- **Tipe Monorepo:** Turborepo + PNPM Workspaces (5 paket/aplikasi terintegrasi).
- **Branch Aktif:** `main` (Production / Staging Sync).
- **Paket dalam Workspace:**
  1. `@simrt/shared-types` (`packages/shared-types`): Kontrak antarmuka TypeScript, Enum peran, DTO, dan skema payload bersama.
  2. `@simrt/ui-kit` (`packages/ui-kit`): Komponen antarmuka enterprise, design tokens, modal proteksi PII, viewer berkas ber-watermark forensik, dan komponen form yang patuh W3C/WCAG AA.
  3. `backend-api` (`apps/backend-api`): RESTful API engine berbasis Node.js Fastify, Prisma ORM, arsitektur Hexagonal/Clean Architecture, dan Cryptographic Adapters.
  4. `admin-panel` (`apps/admin-panel`): Web dashboard responsif untuk Pengurus RT (Ketua RT, Sekretaris, Bendahara) berbasis React 19, Vite, dan Tailwind.
  5. `resident-mobile` (`apps/resident-mobile`): Aplikasi mobile warga berbasis Capacitor 6, React 19, dan Vite yang dapat di-build native Android APK (`release-apk/simrt-warga-v1.0.0-debug.apk`).

---

## 2. Arsitektur Domain & Hierarki Entitas

Banyak kebingungan dan halusinasi terjadi ketika sistem memodelkan warga secara terpisah dari rumah fisiknya. SIM-RT menetapkan hierarki 3 lapis yang tegas:

```
┌────────────────────────────────────────────────────────┐
│ 1. RUMAH / KAVLING FISIK (RumahKavling)               │
│    - kodeBlok (misal: 'A-01', 'B-14')                  │
│    - nomorRumah ('12', '14')                           │
│    - alamat ('Jl. Melati Indah No. 14')                │
│    - statusHunian ('DIHUNI_PEMILIK', 'PENYEWA', KOSONG)│
└──────────────────────────┬─────────────────────────────┘
                           │ 1 Kavling menaungi 1 atau lebih KK
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. KARTU KELUARGA (KartuKeluarga)                      │
│    - noKkEncrypted (AES-256-GCM ciphertext)            │
│    - noKkBlindIndex (HMAC-SHA256 pencarian exact match)│
│    - noKkMasked (16 digit tersamar: '3276************')│
│    - statusDomisili ('TETAP' / 'KONTRAK')              │
│    - statusVerifikasi ('VERIFIED' / 'PENDING')         │
└──────────────────────────┬─────────────────────────────┘
                           │ 1 KK memiliki N Anggota Keluarga
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. ANGGOTA KELUARGA / WARGA (Warga)                    │
│    - nikEncrypted & nikBlindIndex & nikMasked          │
│    - namaLengkap, jenisKelamin, tempatLahir, tglLahir  │
│    - hubunganKeluarga: KEPALA_KELUARGA, ISTRI, ANAK,   │
│      ORANG_TUA, MERTUA, FAMILI_LAIN, PEMBANTU, LAINNYA │
│    - Kategori Kerentanan: isLansia, isBalita,          │
│      isDisabilitas, isIbuHamil                         │
└────────────────────────────────────────────────────────┘
```

---

## 3. Aturan Autentikasi & Otorisasi Berbasis Peran (RBAC)

1. **`KETUA_RT`**: Memiliki hak akses tertinggi terhadap seluruh data kependudukan, pengesahan e-surat dengan tanda tangan digital Ed25519, pemantauan audit trail PII, dan pelaporan keuangan.
2. **`SEKRETARIS`**: Mengelola verifikasi berkas KK/KTP, pencatatan mutasi warga, drafting e-surat pengantar, dan administrasi blok rumah.
3. **`BENDAHARA`**: Mengelola buku kas umum, penagihan iuran bulanan (keamanan & sampah), verifikasi bukti transfer warga, dan rekapitulasi realisasi anggaran.
4. **`WARGA`**: Mengakses aplikasi mobile untuk melihat profil KK sendiri, mengajukan e-surat, membayar dan mengunggah bukti iuran, menerima notifikasi kegiatan warga, dan menekan tombol panik darurat.

---

## 4. Filosofi Desain: Melawan "AI Slop"

Platform ini mengadopsi standar desain enterprise berkeahlian tinggi (mengacu pada benchmark **Astra Otoparts Portal E-Venturer**):
1. **Tidak Ada Gradien Neon atau Elemen Generik yang Tidak Fungsional:** Menghilangkan background blur neon abstrak yang tidak berguna.
2. **Kartu Statistik dengan Aksen Top-Border Berbobot:** Menggunakan aksen garis gradient 3px pada bagian atas kartu stat (`.summaryBlue`, `.summaryGreen`, `.summaryAmber`) serta icon wrap berdimensi 44x44px dengan warna tint semantik.
3. **Tipografi Terstruktur & Angka Tabular:** Label uppercase 11px dengan letter spacing `0.05em`, nilai angka 28px tebal dengan `font-variant-numeric: tabular-nums` agar sejajar rapi saat diurutkan.
4. **Tabel Data Kelas Enterprise:** Header tabel uppercase `11px font-bold text-slate-500`, scrollbar kustom ramping 6px, serta definisi lebar kolom yang eksplisit (`.colCenter`, `.colText`, `.colActions`).
5. **Form & Aksesibilitas Ketat:** Seluruh elemen interaktif wajib memiliki `id`, `name`, `htmlFor`, `aria-label`, dan status fokus visual dengan cincin fokus 2px yang jelas.
