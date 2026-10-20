# 17 Alur Pelayanan E-Surat Pengantar RT

Dokumen spesifikasi alur pelayanan permohonan surat pengantar warga secara digital.

---

## 1. Jenis Surat Pengantar yang Dilayani

1. **Surat Pengantar Pembuatan / Perpanjangan KTP**
2. **Surat Pengantar Pembuatan / Pembaruan Kartu Keluarga**
3. **Surat Keterangan Domisili Warga**
4. **Surat Keterangan Kematian**
5. **Surat Keterangan Tidak Mampu (SKTM) untuk Beasiswa/Bansos**
6. **Surat Keterangan Usaha Mikro Lingkungan**

---

## 2. Alur Proses Persuratan (State Machine)

```
[WARGA (Mobile App)]
       │
       ▼  1. Mengisi form permohonan surat & keperluan
[STATUS: SUBMITTED / MENUNGGU_VERIFIKASI]
       │
       ▼  2. Sekretaris memeriksa kelengkapan biodata di Admin Panel
[STATUS: DIPROSES / DRAFT_DISIAPKAN]
       │
       ▼  3. Ketua RT menyetujui & menandatangani digital (Ed25519)
[STATUS: DITANDATANGANI / SELESAI]
       │
       ▼  4. Warga mengunduh PDF resmi ber-QR Code dari aplikasi mobile
[VERIFIKASI PUBLIK VIA QR SCAN]
```

---

## 3. Otentikasi & Verifikasi QR Code Publik

Setiap lembar PDF surat pengantar yang diterbitkan dilengkapi dengan QR Code unik:
- Format payload QR: `https://domain-rt.id/verify-surat/{suratId}?sig={ed25519SignatureHex}`
- Petugas di Kantor Kelurahan atau Kecamatan dapat memindai QR code ini menggunakan kamera ponsel apapun tanpa harus login, dan sistem akan menampilkan status sah keaslian surat langsung dari database RT 05.

