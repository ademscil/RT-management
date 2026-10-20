# 03 Data Classification & Handling Policy

Dokumen klasifikasi tingkat kerahasiaan data di lingkungan SIM-RT dan panduan perlakuan pada setiap lapisan aplikasi.

---

## 1. Matriks Klasifikasi Data

| Tingkat Klasifikasi | Contoh Elemen Data | Perlakuan Penyimpanan | Perlakuan Antarmuka | Otorisasi Akses |
|---|---|---|---|---|
| **Tier 1: Restricted PII (Sangat Rahasia)** | NIK, Nomor KK, Rekam Medis Disabilitas, Foto KTP asli | AES-256-GCM + Blind Index HMAC-SHA256 | Wajib Masking (`3276************`), Buka data wajib audit log SHA-256 | Ketua RT & Sekretaris (dengan alasan hukum tercatat) |
| **Tier 2: Confidential (Rahasia Pengurus)** | Mutasi Kas RT, Catatan Keuangan, Password Hash (Argon2/Bcrypt), Kunci Privat Ed25519 | Hash satu arah atau Enkripsi Server | Hanya tampil di Admin Panel Pengurus, tidak dikirim ke app warga | Ketua RT, Bendahara, Sekretaris |
| **Tier 3: Internal Community (Komunitas Warga)** | Nama Kepala Keluarga, Nomor Blok/Rumah, Status Hunian (Dihuni/Kosong), Riwayat Iuran Pribadi | Plaintext terstruktur di Database | Ditampilkan pada direktori warga & app mobile untuk transparansi lingkungan | Seluruh Warga Terverifikasi RT 05 |
| **Tier 4: Public (Publik Lingkungan)** | Jadwal Kerja Bakti, Posyandu, Pengumuman RT, Kontak Darurat Polsek/Damkar/Puskesmas | Plaintext publik | Tampil di beranda sebelum & sesudah login | Publik / Semua Pengguna |

---

## 2. Aturan Perlindungan Endpoint API

1. **Anti-Leakage Nomor Telepon:** Endpoint publik atau daftar warga tidak boleh mereturn field `nomorTelepon` kecuali untuk profil pengguna itu sendiri.
2. **Sanitasi Error Response:** Jika terjadi kegagalan database (misal error Prisma), handler Fastify wajib mengembalikan kode galat terstandar (`ERR_INTERNAL`, `ERR_VALIDATION`, dll) tanpa pernah memuntahkan query SQL mentah atau exception stack trace ke antarmuka klien.

