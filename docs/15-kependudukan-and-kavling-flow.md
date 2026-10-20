# 15 Alur Bisnis Kependudukan, Kavling Rumah & Anggota Keluarga

Dokumen ini adalah acuan spesifikasi bisnis resmi untuk modul Kependudukan di SIM-RT.

---

## 1. Konsep Dasar Kavling & Rumah Fisik vs Kartu Keluarga

Dalam tata pamong RT di Indonesia:
- **Kavling / Rumah Fisik (`RumahKavling`):** Adalah unit bangunan fisik berlokasi di RT 05/RW 02. Unit ini memiliki kode blok unik (misal `A-01`), nomor rumah (misal `12`), dan status kepemilikan/hunian (`DIHUNI_PEMILIK`, `DIHUNI_PENYEWA`, atau `KOSONG`).
- **Kartu Keluarga (`KartuKeluarga`):** Adalah unit administratif kependudukan yang menempati suatu rumah fisik. Satu rumah fisik umumnya menaungi 1 KK (pemilik atau pengontrak), namun dimungkinkan menaungi lebih dari 1 KK jika terdapat keluarga menumpang.
- **Warga / Anggota Keluarga (`Warga`):** Adalah individu-individu yang terdaftar di dalam Kartu Keluarga tersebut, dengan satu orang bertindak sebagai `KEPALA_KELUARGA` dan yang lainnya sebagai `ISTRI`, `ANAK`, `ORANG_TUA`, atau hubungan keluarga lainnya.

---

## 2. Alur Pengelolaan di Admin Panel

```
[Tab Kavling & KK]
       │
       ├─► Tambah Blok Rumah Baru (POST /api/v1/kependudukan/rumah)
       │     └─► Input: kodeBlok, nomorRumah, alamat, statusHunian, (opsional) nomorKk
       │
       ├─► Edit Blok Rumah (PUT /api/v1/kependudukan/rumah/:id)
       │     └─► Ubah alamat, nomor rumah, atau status hunian
       │
       ├─► Hapus Blok Rumah (DELETE /api/v1/kependudukan/rumah/:id)
       │     └─► Validasi Aman: Ditolak bila rumah masih memiliki penghuni terdaftar
       │
       └─► Buka "House Workbench" (Tombol "Kelola Penghuni")
             │
             ├─► Tampilkan daftar seluruh anggota keluarga di rumah tersebut
             │
             ├─► Tambah Anggota ke Rumah Ini (POST /api/v1/kependudukan/warga)
             │     └─► Terkunci otomatis ke kkId rumah tersebut
             │
             ├─► Edit Biodata Anggota (PUT /api/v1/kependudukan/warga/:id)
             │
             └─► Hapus Anggota dari KK (DELETE /api/v1/kependudukan/warga/:id)
```

---

## 3. Logika & Validasi Bisnis Kritis

1. **Keunikan Kode Blok:** Kolom `kodeBlok` bersifat unik di database. Tidak boleh ada dua kavling fisik dengan kode blok yang sama di lingkungan RT 05.
2. **Proteksi Hapus Rumah (Cascade Guard):** Pengurus tidak boleh secara sengaja maupun tidak sengaja menghapus rumah yang masih memiliki warga aktif. Sistem akan melempar galat `400 Bad Request` dengan pesan: *"Rumah masih memiliki X warga terdaftar. Pindahkan atau hapus warga terlebih dahulu."*
3. **Pengikatan Anggota Keluarga:** Saat pengurus menambah anggota baru lewat House Workbench, sistem secara otomatis mengunci `kkId` ke KK yang ada di rumah tersebut sehingga pengurus tidak perlu menghafal atau mencari ID KK secara manual.
4. **Verifikasi Mandiri Warga via Mobile:** Jika warga baru mendaftar mandiri via aplikasi APK dengan mengunggah foto KK dan KTP, status KK bernilai `PENDING`. Pengurus RT memeriksa keabsahan berkas di Admin Panel melalui Forensic Viewer, kemudian menekan tombol **"Verifikasi"** untuk mengaktifkan KK dan warganya.

