# 29 Anti-AI-Slop Design Standard & Visual Craftsmanship

Dokumen ini mendefinisikan standar baku desain visual dan pedoman pencegahan **"AI Slop"** (desain antarmuka generik buatan AI) pada aplikasi web (Admin Panel) dan aplikasi mobile (Resident APK) SIM-RT, dengan mengacu pada kurasi dari komunitas desain global dan repositori anti-slop ternama.

---

## 1. Referensi Repositori GitHub Anti-AI-Slop

Untuk memastikan rancangan antarmuka memiliki cita rasa manusia (*human craftsmanship*) dan lolos dari stereotip AI:

| Repositori GitHub | Fokus Utama | Nilai yang Diadopsi ke SIM-RT |
|---|---|---|
| [`LeoStehlik/no-slop-ui`](https://github.com/LeoStehlik/no-slop-ui) | Guardrails & larangan desain klise bagi AI coding agents | Melarang teks gradien berlebih, melarang kartu bersarang (*nested cards*), dan mewajibkan hierarki tipografi tegas |
| [`yetone/kill-ai-slop`](https://github.com/yetone/kill-ai-slop) | Field guide & linter pemindai artefak kode mesin | Menghapus floating blur orbs, teks generik "Get Started", dan kartu fitur kosong |
| [`Vanszs/Anti-AI-UI`](https://github.com/Vanszs/Anti-AI-UI) | Steering prompt & filter tata letak terstruktur | Memaksakan token warna merek spesifik dan rasio kontras aksesibilitas tinggi |
| [`voltagent/awesome-design-md`](https://github.com/voltagent/awesome-design-md) | Kurasi token desain dari produk kelas dunia (Linear, Stripe, Notion) | Mengadopsi micro-interactions, angka tabular, dan pembagian jenis kolom tabel |
| [`Nutlope/hallmark`](https://github.com/Nutlope/hallmark) | Skill audit tata letak unik & sidik jari visual | Mengganti template default dengan arsitektur UI khas (Astra Otoparts Enterprise Benchmark) |

---

## 2. Katalog Karakteristik "AI Slop" vs Standar SIM-RT

### A. Larangan Teks Gradien & Glowing Blur Orbs
- ❌ **AI Slop:** Memakai `bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-500` pada judul dan menaruh bulatan blur besar di latar belakang (`absolute -top-10 -right-10 w-48 h-48 bg-teal-500/10 blur-2xl`).
- ✅ **Standar SIM-RT:** Menggunakan tipografi warna solid yang tegas (`text-slate-900` atau `text-white`), latar belakang panel putih/slate bertekstur tenang, dan aksen garis gradien tipis (3px) yang presisi hanya pada tepi atas kartu (`stat-card-enterprise`).

### B. Larangan Kartu Generik Seragam (3-Card Feature Sludge)
- ❌ **AI Slop:** Seluruh data ditampilkan dalam kartu kotak putih `rounded-xl p-6 shadow-sm border border-slate-200` tanpa hierarki dan tanpa pembeda peran data.
- ✅ **Standar SIM-RT:** Menggunakan sistem kartu beraksen atas (*Top-Accent Line*) dengan icon container terdedikasi 44×44px bersudut 12px dan background tint semantik:
  - **Civic Primary (Teal):** `bg-teal-50 text-teal-700 border-teal-200`
  - **Kependudukan (Blue):** `bg-blue-50 text-blue-700 border-blue-200`
  - **Keuangan & Tanggap Darurat (Amber):** `bg-amber-50 text-amber-700 border-amber-200`
  - **Verifikasi & Kas Sah (Green):** `bg-emerald-50 text-emerald-700 border-emerald-200`
  - **PII & Audit Trail (Purple):** `bg-purple-50 text-purple-700 border-purple-200`

### C. Tipografi & Angka Tabular
- ❌ **AI Slop:** Menggunakan ukuran font sembarangan tanpa tracking label, dan angka nominal uang yang bergeser atau berantakan saat diurutkan.
- ✅ **Standar SIM-RT:**
  - Label statistik: `text-[11px] font-bold text-slate-500 uppercase tracking-wider` (`letter-spacing: 0.05em`).
  - Nilai data: `text-2xl font-black text-slate-900` dengan `font-variant-numeric: tabular-nums` agar digit sejajar vertikal saat di-sort.

### D. Tabel Data Kelas Enterprise
- ❌ **AI Slop:** Tabel polos yang meluap keluar layar ponsel atau terpotong tanpa scrollbar yang jelas.
- ✅ **Standar SIM-RT:** 
  - Menggunakan kustom scrollbar ramping 6px (`.scrollbar-slim`) dengan track `#f1f5f9` dan thumb `#cbd5e1`.
  - Header tabel uppercase `11px font-bold text-slate-500` dengan background lembut `#f8fafc`.
  - Kolom memiliki peran eksplisit: `.colCenter` untuk status/tanggal, `.colText` untuk nama, dan `.colActions` untuk tombol kelola.

### E. Pengalaman Native pada Aplikasi Mobile (APK)
- ❌ **AI Slop:** Aplikasi APK hanya berupa web view mentah tanpa umpan balik sentuhan dan terpotong poni layar (notch).
- ✅ **Standar SIM-RT:**
  - Mengintegrasikan Capacitor Haptics (`Haptics.impact({ style: ImpactStyle.Light })`) pada setiap sentuhan tab bottom navigation.
  - Memperhitungkan Safe Area Insets (`env(safe-area-inset-top)` dan `env(safe-area-inset-bottom)`).
  - Tampilan kartu identitas digital berstatus terverifikasi dan tombol darurat kontak siaga yang taktil.
