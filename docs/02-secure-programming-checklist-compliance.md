# 02 Secure Programming Checklist & UU PDP Compliance

Dokumen ini memuat standar keamanan informasi, kriptografi, dan kepatuhan privasi data di SIM-RT sesuai **Undang-Undang Perlindungan Data Pribadi (UU PDP No. 27/2022)**.

---

## 1. Aturan Penanganan Data Pribadi Spesifik (PII)

Dalam UU PDP Pasal 4 Ayat (2), data kependudukan (NIK, KK, data kesehatan/disabilitas) masuk dalam kategori **Data Pribadi yang Bersifat Spesifik**, yang menuntut perlindungan tingkat tertinggi:

### A. Enkripsi At-Rest (AES-256-GCM)
- Seluruh nilai mentah NIK dan No. KK **TIDAK BOLEH** disimpan dalam bentuk plain-text di tabel database.
- Kriptografi menggunakan algoritma `aes-256-gcm` dengan initialization vector (IV) unik sepanjang 12 byte per record dan authentication tag 16 byte.
- Format ciphertext tersimpan: `hex(iv):hex(authTag):hex(encryptedData)`.

### B. Blind Indexing (HMAC-SHA256)
- Karena AES-256-GCM menghasilkan ciphertext yang berbeda setiap kali dienkripsi (akibat IV acak), query database `WHERE nik = ?` tidak dapat dilakukan secara langsung.
- Untuk mengizinkan pencarian exact-match tanpa mendeskripsi database, digunakan **Blind Index** berbasis HMAC-SHA256 dengan secret salt khusus (`BLIND_INDEX_SECRET`).
- Kolom `nikBlindIndex` dan `noKkBlindIndex` memiliki indeks b-tree unik untuk operasi pencarian cepat.

### C. Masking Default di Antarmuka
- Di seluruh respons API publik dan antarmuka tabel biasa, NIK dan Nomor KK ditampilkan dalam bentuk tersamar (*masked*), misal: `3276************` atau `327602******0001`.
- Nomor telepon warga tidak boleh dibocorkan ke warga lain; hanya nama kepala keluarga dan nomor rumah yang tampil di direktori publik warga.

---

## 2. Gate Pembukaan Data (PII Reveal Modal & Audit Trail)

Bila Pengurus RT (Ketua/Sekretaris) memerlukan NIK lengkap untuk keperluan administrasi negara (seperti verifikasi bansos atau pencoblosan):
1. Pengurus wajib mengklik tombol **"Buka NIK Lengkap"**.
2. Pengurus wajib memilih alasan pembukaan data yang sah (`PiiAccessReason`: `VERIFIKASI_BANSOS`, `PENGURUSAN_SURAT`, `SENSUS_PEMILU`, `PELAPORAN_KELURAHAN`).
3. Permintaan dikirim ke endpoint `POST /api/v1/kependudukan/audit/reveal-nik`.
4. Sistem mencatat transaksi ke dalam tabel `PiiAuditTrail` dengan rantai hash kriptografis SHA-256:
   $$\text{CurrentHash} = \text{SHA-256}(\text{PreviousHash} \parallel \text{Timestamp} \parallel \text{UserId} \parallel \text{TargetWargaId} \parallel \text{Reason})$$
5. Integritas hash-chain ini bersifat *tamper-evident*: jika ada manipulasi langsung di database SQL, rantai hash akan putus dan terdeteksi pada audit rutin.
6. Data NIK didekripsi dan ditampilkan dalam modal berbatas waktu (auto-mask setelah 30 detik).

---

## 3. Watermark Forensik Berkas KTP & KK

Ketika pengurus melihat foto berkas KTP atau KK:
- Komponen `ForensicWatermarkedImageViewer` di `@simrt/ui-kit` secara dinamis merender canvas bertumpuk (*stacked canvas*).
- Watermark visual repetitif diagonal memuat:
  - Nama dan ID Pengurus yang sedang login
  - Alamat IP & Timestamp tepat saat berkas dibuka
  - Teks peringatan hukum: *"DOKUMEN RAHASIA RT 05/RW 02 - HANYA UNTUK KEPERLUAN ADMINISTRASI RESMI"*
- Ini menjamin akuntabilitas: jika pengurus mengambil tangkapan layar (screenshot), identitas pengambil foto terpampang jelas secara forensik, mencegah kebocoran data keluar.

---

## 4. Tanda Tangan Digital E-Surat (Ed25519)

- E-Surat yang diterbitkan oleh Ketua RT ditandatangani menggunakan algoritma asimetris kurva eliptik **Ed25519**.
- Kunci privat (`ED25519_PRIVATE_KEY`) disimpan di backend yang aman.
- QR Code yang tercetak pada e-surat memuat URL verifikasi publik berparameter hash tanda tangan. Siapapun (Kelurahan, Kecamatan, atau warga) yang memindai QR code dapat memverifikasi keaslian surat langsung ke backend tanpa risiko pemalsuan cap/tanda tangan manual.

