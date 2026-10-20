# 22 Go-Live Audit & Pre-Flight Checklist

Dokumen verifikasi akhir sebelum SIM-RT dinyatakan Go-Live di lingkungan RT 05 / RW 02.

---

## 1. Verifikasi Keamanan & Privasi (UU PDP)

- [x] Kunci rahasia enkripsi (`ENCRYPTION_KEY`, `BLIND_INDEX_SECRET`, `JWT_SECRET`, `ED25519_PRIVATE_KEY`) disimpan di `.env` aman dan tidak di-commit ke Git.
- [x] Seluruh kolom NIK dan Nomor KK dienkripsi menggunakan AES-256-GCM.
- [x] Pencarian NIK/KK menggunakan Blind Index deterministik HMAC-SHA256.
- [x] Seluruh pengungkapan NIK wajib memilih alasan hukum dan tercatat pada rantai audit hash-chain SHA-256 yang tamper-evident.
- [x] Penampil foto KTP/KK dilengkapi forensic dynamic watermark.

---

## 2. Verifikasi Kompilasi & Build

- [x] Turborepo `npm run build` sukses 5/5 paket tanpa galat.
- [x] Vitest `npm test` lolos 14/14 unit & crypto tests.
- [x] Capacitor Android tersinkronisasi dan berhasil di-compile ke `release-apk/simrt-warga-v1.0.0-debug.apk`.

---

## 3. Verifikasi Aksesibilitas & UI/UX

- [x] Seluruh form inputs memiliki atribut `id`, `name`, `htmlFor`, dan label yang terasosiasi.
- [x] Seluruh tombol memiliki teks atau `aria-label` yang jelas.
- [x] Kontras warna teks memenuhi standar WCAG AA (minimal 4.5:1).
- [x] Desain terbebas dari "AI Slop" — mengadopsi standar enterprise Astra Otoparts Portal E-Venturer: kartu statistik bergaris aksen gradien atas, icon wrap semantik 44x44px, tipografi tabular, dan tabel responsif dengan scrollbar ramping.
- [x] Tombol Logout tersedia dengan jelas di Admin Panel dan Aplikasi Mobile APK.
