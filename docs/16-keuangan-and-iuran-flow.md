# 16 Alur Bisnis Keuangan, Buku Kas & Iuran Warga

Dokumen spesifikasi modul Keuangan dan Penagihan Iuran Warga RT 05 / RW 02.

---

## 1. Jenis Pos Keuangan RT

1. **Iuran Wajib Bulanan:** Terdiri dari iuran keamanan lingkungan (pos kamling) dan iuran pengelolaan sampah kebersihan (biasanya Rp50.000,- / KK / bulan).
2. **Iuran Sukarela / Donasi Warga:** Sumbangan sukarela untuk perbaikan fasilitas umum, kerja bakti, santunan kematian, atau peringatan 17 Agustus.
3. **Pengeluaran Operasional RT:** Gaji petugas keamanan/kebersihan, pembelian perlengkapan ronda, perbaikan lampu penerangan jalan umum, dan administrasi RT.

---

## 2. Alur Penagihan & Verifikasi Pembayaran

```
1. Generator Tagihan Bulanan (Setiap awal bulan)
   └─► Sistem membuat record `TagihanIuran` untuk setiap KK terverifikasi
       (Status awal: `UNPAID`)

2. Warga Membayar via Transfer Bank / QRIS
   └─► Warga membuka aplikasi mobile SIM-RT -> Tab Iuran Kas
   └─► Mengunggah foto struk transfer / bukti bayar
   └─► Status tagihan berubah menjadi `PENDING_VERIFICATION`

3. Bendahara Memeriksa Bukti Bayar di Admin Panel
   └─► Bendahara membuka menu Keuangan -> Daftar Menunggu Verifikasi
   └─► Meneliti mutasi rekening bank kas RT
   └─► Klik "Approve / Sahkan": Status tagihan menjadi `PAID`
       dan sistem secara otomatis membukukan transaksi masuk ke `BukuKas`
   └─► Klik "Tolak": Disertai catatan penolakan (misal: "Nominal tidak sesuai")
```

---

## 3. Buku Kas & Laporan Transparansi

- Seluruh mutasi kas memiliki kolom `saldoSetelahTransaksi` yang dihitung secara atomik dalam transaksi database.
- Laporan kas bulanan menampilkan ringkasan: Total Pemasukan, Total Pengeluaran, Saldo Akhir, dan Persentase Kepatuhan Iuran Warga per Blok.
- Warga dapat memantau grafik transparansi kas umum langsung dari aplikasi mobile (prinsip *akuntabilitas terbuka*).

