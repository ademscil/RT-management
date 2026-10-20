# 14 QA Standard & Definition of Done

Dokumen ini menjadi standar verifikasi kualitas sebelum suatu fitur dinyatakan selesai dan siap dirilis ke lingkungan produksi.

---

## 1. Definisi Selesai (Definition of Done)

Sebuah fitur atau perbaikan kode baru dianggap **Selesai (Done)** apabila memenuhi seluruh kriteria berikut:
1. **Zero Compile Errors:** Perintah `npm run build` di root monorepo menghasilkan 5/5 paket sukses tanpa peringatan TypeScript atau linting.
2. **All Tests Passing:** Perintah `npm test` menyelesaikan seluruh unit & kriptografi test dengan status pass 100%.
3. **No AI Attribution:** Tidak ada komentar, string, commit message, maupun metadata yang merujuk pada AI.
4. **W3C/WCAG AA Compliance:** Tidak ada form input tanpa `id`/`htmlFor`/label, dan tidak ada tombol tanpa nama aksesibel.
5. **UU PDP Compliance:** Tidak ada kebocoran NIK atau No. KK mentah ke console log, response payload publik, atau antarmuka tanpa masking.
6. **Mobile APK Verification:** Sinkronisasi Capacitor berhasil, kompilasi Gradle berhasil, dan file APK termutakhir berada di `release-apk/simrt-warga-v1.0.0-debug.apk`.
7. **Git Cleanliness:** Seluruh perubahan di-commit dengan pesan semantik yang bersih dan di-push ke remote repository.

---

## 2. Checklist Pengujian Antarmuka (Cross-Device & Responsive)

| Parameter Uji | Desktop (1280px+) | Tablet (768px - 1024px) | Mobile (360px - 480px) |
|---|---|---|---|
| **Sidebar Admin** | Terbuka penuh (256px) atau Rail (80px) | Rail (80px) dengan tooltip | Off-canvas drawer dengan backdrop overlay |
| **Tabel Sensus Warga** | Tampil seluruh kolom kependudukan | Tabel dapat di-scroll horizontal dengan scrollbar kustom | Tampilan kartu kependudukan atau scroll mulus |
| **Modal Formulir** | Tampil di tengah layar dengan backdrop blur | Max-width 640px, padding proporsional | Full-width bottom sheet atau scroll vertikal mandiri |
| **Bottom Navigation APK** | Tersembunyi (hidden) | Tersembunyi | Sticky bottom bar dengan haptic tap feedback |

