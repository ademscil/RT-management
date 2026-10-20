# 12 Coding Standard & Design Guidelines

Dokumen ini menjadi pedoman baku penulisan kode TypeScript, arsitektur komponen React 19, sistem token desain antarmuka, dan kepatuhan aksesibilitas di SIM-RT.

---

## 1. Standar TypeScript & Strict Typing

1. **Strict Null Checks:** Seluruh kode wajib mematuhi strict mode TypeScript tanpa `any` yang tidak terkendali.
2. **DTO & Contract Sharing:** Jangan mendefinisikan interface data kependudukan atau respon API secara independen di komponen lokal bila interface tersebut sudah ada di `@simrt/shared-types`.
3. **No Unused Locals/Imports:** Konfigurasi TypeScript `noUnusedLocals: true` aktif; jangan tinggalkan import atau variabel yang tidak digunakan.

---

## 2. Standar Desain Antarmuka: Melawan "AI Slop"

Mengacu pada arsitektur benchmark `D:\AOP\portal-csi-github`:

### A. Palet Token Semantik & Aksesibilitas
- **Latar Belakang:** Gunakan `#ffffff` untuk kartu/panel dan `#f8fafc` atau `#f1f5f9` untuk background halaman dasar. Hindari wallpaper gelap hitam pekat dengan glowing orb yang tidak proporsional.
- **Kartu Statistik (Summary Cards):**
  - Menggunakan aksen garis gradient 3px pada sisi atas kartu:
    - Biru: `linear-gradient(90deg, #1d4ed8, #60a5fa)`
    - Hijau: `linear-gradient(90deg, #15803d, #4ade80)`
    - Amber/Kuning: `linear-gradient(90deg, #d97706, #fbbf24)`
    - Ungu: `linear-gradient(90deg, #7c3aed, #a78bfa)`
  - Icon container berukuran `44x44px` dengan `border-radius: 12px` dan background tint senada (`#dbeafe`, `#dcfce7`, `#fef3c7`, `#ede9fe`).
  - Label statistik: `11px font-bold text-slate-500 uppercase tracking-wider` (`letter-spacing: 0.05em`).
  - Nilai statistik: `28px font-extrabold text-slate-900 tracking-tight` dengan `font-variant-numeric: tabular-nums`.

### B. Desain Tabel Data & Scrollbar
- **Header Tabel:** Selalu gunakan font kecil, tegas, dan tracked: `font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc;`.
- **Zebra Hover:** Baris tabel memiliki transisi lembut saat di-hover (`hover:bg-slate-50/80 dark:hover:bg-slate-800/50`).
- **Scrollbar Ramping (Slim Scrollbar):**
  - Lebar: 6px.
  - Track: `#f1f5f9` dengan radius pill.
  - Thumb: `#cbd5e1` dengan radius pill, berubah `#94a3b8` saat di-hover.

### C. Tombol & Elemen Interaktif
- **Primary Button:** Warna solid profesional (`#0f766e` untuk civic teal atau `#1d4ed8` untuk corporate blue) dengan transisi `translateY(-1px)` saat hover dan bayangan halus `0 2px 6px rgba(15, 23, 42, 0.08)`.
- **Secondary Button:** Background putih/terang dengan border tegas `#d1d5db` dan teks `#374151`.
- **Danger Button:** Background putih dengan border merah lembut `#fca5a5`, teks merah `#dc2626`, dan hover latar merah pudar `#fef2f2`.

---

## 3. Kepatuhan Aksesibilitas (W3C / WCAG AA)

1. **Form Controls:** Seluruh elemen `<input>`, `<select>`, dan `<textarea>` **WAJIB** memiliki:
   - Atribut `id` dan `name` yang unik.
   - Pasangan elemen `<label htmlFor="...">` yang terhubung secara eksplisit.
   - Atribut `aria-label` atau `aria-describedby` bila label tidak tampak secara visual.
2. **Tombol Icon-Only:** Setiap tombol yang hanya merender icon (seperti icon silang `X`, edit, atau trash) **WAJIB** memiliki atribut `aria-label` dan `title` yang menjelaskan aksinya (misal: `aria-label="Tutup modal"`).
3. **Fokus Visual:** Tidak boleh mematikan outline tanpa menyediakan cincin fokus pengganti (`focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2`).

---

## 4. Penanganan Kesalahan & Validasi

1. **Inline Field Errors:** Validasi input formulir wajib ditampilkan langsung di bawah input bersangkutan dengan teks merah kecil yang jelas (bukan hanya melempar notifikasi toast).
2. **Toast Feedback:** Toast notifikasi hanya digunakan untuk konfirmasi hasil akhir operasi async (misal: "Data warga berhasil diperbarui" atau "Gagal menyimpan: koneksi terputus").
3. **Empty States & Skeletons:** Gunakan komponen skeleton loader yang proporsional saat memuat data, dan tampilkan EmptyStateCard dengan pesan bersahabat dan call-to-action saat data kosong.
