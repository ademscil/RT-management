import fs from 'fs';
import path from 'path';

// Import pdf-lib from backend-api node_modules
const { PDFDocument, rgb, StandardFonts } = await import(
  '../apps/backend-api/node_modules/pdf-lib/dist/pdf-lib.js'
);

async function generateManualPdf() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await doc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await doc.embedFont(StandardFonts.CourierBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT * 2; // 515.28
  const TOTAL_PAGES = 9;

  // Colors
  const cTealDark = rgb(15 / 255, 118 / 255, 110 / 255); // Teal 700
  const cTealPrimary = rgb(13 / 255, 148 / 255, 136 / 255); // Teal 600
  const cTealLight = rgb(240 / 255, 253 / 255, 250 / 255); // Teal 50
  const cTealBorder = rgb(153 / 255, 246 / 255, 228 / 255); // Teal 200

  const cSlate900 = rgb(15 / 255, 23 / 255, 42 / 255);
  const cSlate800 = rgb(30 / 255, 41 / 255, 59 / 255);
  const cSlate700 = rgb(51 / 255, 65 / 255, 85 / 255);
  const cSlate500 = rgb(100 / 255, 116 / 255, 139 / 255);
  const cSlate200 = rgb(226 / 255, 232 / 255, 240 / 255);
  const cSlate100 = rgb(241 / 255, 245 / 255, 249 / 255);
  const cWhite = rgb(1, 1, 1);

  const cAmberBg = rgb(254 / 255, 243 / 255, 199 / 255);
  const cAmberBorder = rgb(253 / 255, 230 / 255, 138 / 255);
  const cAmberText = rgb(146 / 255, 64 / 255, 14 / 255);

  const cBlueBg = rgb(239 / 255, 246 / 255, 255 / 255);
  const cBlueBorder = rgb(191 / 255, 219 / 255, 254 / 255);
  const cBlueText = rgb(30 / 255, 64 / 255, 175 / 255);

  // Helper for Header
  function drawHeader(page, title) {
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 32,
      width: PAGE_WIDTH,
      height: 32,
      color: cSlate900,
    });
    page.drawText('SISTEM INFORMASI MANAJEMEN RUKUN TETANGGA (SIM-RT 05 / RW 02)', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 20,
      size: 8.5,
      font: fontBold,
      color: rgb(204 / 255, 251 / 255, 241 / 255),
    });
    page.drawText(title, {
      x: PAGE_WIDTH - MARGIN_LEFT - fontRegular.widthOfTextAtSize(title, 8.5),
      y: PAGE_HEIGHT - 20,
      size: 8.5,
      font: fontRegular,
      color: rgb(226 / 255, 232 / 255, 240 / 255),
    });
    page.drawLine({
      start: { x: 0, y: PAGE_HEIGHT - 32 },
      end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - 32 },
      thickness: 1.5,
      color: cTealPrimary,
    });
  }

  // Helper for Footer
  function drawFooter(page, pageNum) {
    page.drawLine({
      start: { x: MARGIN_LEFT, y: 36 },
      end: { x: PAGE_WIDTH - MARGIN_LEFT, y: 36 },
      thickness: 0.5,
      color: cSlate200,
    });
    const leftText = 'Dokumen Resmi Panduan Operasional - RT 05 / RW 02 Kel. Sukamaju, Kec. Cilodong, Kota Depok';
    page.drawText(leftText, {
      x: MARGIN_LEFT,
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: cSlate500,
    });
    const pageText = `Halaman ${pageNum} dari ${TOTAL_PAGES}`;
    page.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN_LEFT - fontBold.widthOfTextAtSize(pageText, 8),
      y: 24,
      size: 8,
      font: fontBold,
      color: cSlate700,
    });
  }

  // Helper for Card Box
  function drawCard(page, x, y, width, height, bgColor, borderColor) {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: bgColor,
      borderColor: borderColor || cSlate200,
      borderWidth: 1,
    });
  }

  // =========================================================================
  // HALAMAN 1: SAMPUL RESMI & LEMBAR PENGESAHAN
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Top Brand Accent
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 180,
      width: PAGE_WIDTH,
      height: 180,
      color: cSlate900,
    });

    // Decorative Teal Stripe
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 186,
      width: PAGE_WIDTH,
      height: 6,
      color: cTealPrimary,
    });

    // Header Content inside dark band
    page.drawText('PEMERINTAH KOTA DEPOK - KECAMATAN CILODONG', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 55,
      size: 10,
      font: fontBold,
      color: rgb(204 / 255, 251 / 255, 241 / 255),
    });
    page.drawText('KELURAHAN SUKAMAJU - RUKUN WARGA 02', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 70,
      size: 9,
      font: fontRegular,
      color: rgb(153 / 255, 246 / 255, 228 / 255),
    });

    page.drawText('BUKU PANDUAN PENGGUNA', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 110,
      size: 26,
      font: fontBold,
      color: cWhite,
    });

    page.drawText('Sistem Informasi Manajemen RT Modern (SIM-RT 05)', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 135,
      size: 14,
      font: fontRegular,
      color: rgb(204 / 255, 251 / 255, 241 / 255),
    });

    page.drawText('Edisi Resmi Produksi 2026 - Versi 1.0', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 155,
      size: 9.5,
      font: fontOblique,
      color: rgb(148 / 255, 163 / 255, 184 / 255),
    });

    // Content Body
    let y = PAGE_HEIGHT - 220;

    // Callout Box: Lingkup Penerapan
    drawCard(page, MARGIN_LEFT, y - 65, CONTENT_WIDTH, 65, cTealLight, cTealBorder);
    page.drawText('INFORMASI RESMI SISTEM OPERASIONAL', {
      x: MARGIN_LEFT + 15,
      y: y - 20,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    page.drawText('Buku panduan ini merupakan acuan operasional resmi bagi seluruh Pengurus RT (Ketua RT, Sekretaris,', {
      x: MARGIN_LEFT + 15,
      y: y - 35,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    page.drawText('Bendahara), Administrator Sistem, serta Warga RT 05 / RW 02 dalam pemanfaatan ekosistem SIM-RT.', {
      x: MARGIN_LEFT + 15,
      y: y - 48,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });

    y -= 90;

    // Alamat Akses Portal (Web URLs)
    page.drawText('ALAMAT AKSES PORTAL RESMI (PRODUCTION)', {
      x: MARGIN_LEFT,
      y,
      size: 11,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 250, y }, thickness: 2, color: cTealPrimary });

    y -= 18;
    const portals = [
      {
        name: 'Portal Admin Web (Command Center)',
        url: 'https://rt-management-admin.vercel.app/',
        user: 'Ketua RT, Sekretaris, Bendahara, Superuser',
        desc: 'Modul master kependudukan, validasi e-surat, pembukuan kas 3 pos, audit log, & konfigurasi.',
      },
      {
        name: 'Portal Warga Mobile (Resident Web App)',
        url: 'https://rt-management-warga.vercel.app/',
        user: 'Warga & Kepala Keluarga RT 05',
        desc: 'Pengajuan surat online, histori tagihan & iuran, jadwal ronda malam, & tiket pengaduan.',
      },
      {
        name: 'Backend API Terenkripsi',
        url: 'https://rt-management-api.vercel.app/',
        user: 'API Core Services & Database Postgres',
        desc: 'Enkripsi data pribadi AES-256-GCM, Blind Index NIK, Argon2id, & pelindung RLS.',
      },
    ];

    portals.forEach((p) => {
      drawCard(page, MARGIN_LEFT, y - 55, CONTENT_WIDTH, 55, cSlate100, cSlate200);
      page.drawText(p.name, { x: MARGIN_LEFT + 12, y: y - 16, size: 9.5, font: fontBold, color: cSlate900 });
      page.drawText(`URL: ${p.url}`, { x: MARGIN_LEFT + 12, y: y - 29, size: 8.5, font: fontMonoBold, color: cTealDark });
      page.drawText(`Pengguna: ${p.user}`, { x: MARGIN_LEFT + 12, y: y - 41, size: 8, font: fontRegular, color: cSlate700 });
      y -= 63;
    });

    y -= 10;
    // Ringkasan Isi Dokumen
    page.drawText('DAFTAR BAB PANDUAN PENGGUNA', {
      x: MARGIN_LEFT,
      y,
      size: 11,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 180, y }, thickness: 2, color: cTealPrimary });

    y -= 16;
    const chapters = [
      ['Bab 1', 'Pengenalan Sistem, Arsitektur 3 Pilar & Standar Keamanan Data'],
      ['Bab 2', 'Struktur Peran (RBAC) & Matriks Wewenang Pengguna'],
      ['Bab 3', 'Panduan Pendaftaran & Pengaturan Akun Pengurus (Ketua RT, Sekretaris, Bendahara)'],
      ['Bab 4', 'Modul Kependudukan, Peta Kavling & Pelindungan Data NIK (PII Masking)'],
      ['Bab 5', 'Modul Layanan E-Surat Pengantar RT Ber-Barcode QR & Verifikasi Digital'],
      ['Bab 6', 'Modul Kas, Iuran Warga & Transparansi Keuangan 3 Pos Kas RT'],
      ['Bab 7', 'Panduan Aplikasi Warga Mobile (Instalasi PWA, Ronda, Aduan & Iuran)'],
      ['Bab 8', 'Pemulihan Akun, 8 Kode Darurat Offline & Panduan Bantuan Teknis'],
    ];

    chapters.forEach(([bab, judul]) => {
      page.drawText(bab, { x: MARGIN_LEFT + 5, y, size: 8.5, font: fontBold, color: cTealDark });
      page.drawText(`:  ${judul}`, { x: MARGIN_LEFT + 45, y, size: 8.5, font: fontRegular, color: cSlate800 });
      y -= 15;
    });

    // Footer
    drawFooter(page, 1);
  }

  // =========================================================================
  // HALAMAN 2: BAB 1 - PENGENALAN SISTEM & KEAMANAN
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 1: PENGENALAN SISTEM & KEAMANAN');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 1: PENGENALAN SISTEM & ARSITEKTUR KEAMANAN', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 320, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('1.1 Latar Belakang & Visi Digitalisasi RT Modern', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;
    const p1 = [
      'SIM-RT 05 / RW 02 dikembangkan untuk mewujudkan tata kelola rukun tetangga yang modern, tertib,',
      'transparan, dan akuntabel. Melalui digitalisasi menyeluruh, sistem ini mengeliminasi pencatatan manual',
      'berbasis kertas yang rentan rusak atau tercecer, sekaligus mempermudah komunikasi dan pelayanan kepada',
      'warga masyarakat 24 jam sehari secara mandiri.',
    ];
    p1.forEach((line) => {
      page.drawText(line, { x: MARGIN_LEFT, y, size: 8.5, font: fontRegular, color: cSlate700 });
      y -= 12;
    });

    y -= 10;
    page.drawText('1.2 Ekosistem Tiga Pilar Aplikasi', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;

    const pilars = [
      {
        title: '1. Admin Panel Command Center (Web Desktop)',
        desc: 'Diperuntukkan khusus bagi jajaran Pengurus RT (Ketua, Sekretaris, Bendahara) dan Superuser. Digunakan untuk manajemen kependudukan dan kavling, persetujuan dan tanda tangan digital e-surat pengantar, pencatatan iuran dan pengeluaran kas, serta pelaporan.',
      },
      {
        title: '2. Resident Portal (Aplikasi Warga Mobile PWA)',
        desc: 'Diperuntukkan bagi seluruh warga RT 05. Berjalan mulus di peramban ponsel pintar (Android/iOS) dan dapat diinstal ke layar beranda tanpa biaya Google Play Store. Digunakan untuk mengajukan surat, memantau iuran, melihat jadwal ronda malam, dan lapor aduan.',
      },
      {
        title: '3. Backend API Terenkripsi & Basis Data Cloud PostgreSQL',
        desc: 'Mesin layanan pusat yang mengelola seluruh proses autentikasi terenkripsi, penyimpanan berkas dokumen kependudukan, pelaporan kas real-time, serta verifikasi keaslian tanda tangan surat secara kriptografis.',
      },
    ];

    pilars.forEach((p) => {
      drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cSlate100, cSlate200);
      page.drawText(p.title, { x: MARGIN_LEFT + 10, y: y - 14, size: 9, font: fontBold, color: cSlate900 });
      page.drawText(p.desc.substring(0, 115), { x: MARGIN_LEFT + 10, y: y - 27, size: 8, font: fontRegular, color: cSlate700 });
      page.drawText(p.desc.substring(115), { x: MARGIN_LEFT + 10, y: y - 38, size: 8, font: fontRegular, color: cSlate700 });
      y -= 54;
    });

    y -= 8;
    page.drawText('1.3 Standar Keamanan Data & Pelindungan Data Pribadi (UU PDP)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;

    const securityItems = [
      {
        label: 'Enkripsi Data Pribadi (AES-256-GCM)',
        desc: 'Data sensitif seperti Nomor Induk Kependudukan (NIK) dan berkas KTP disimpan dalam keadaan terenkripsi dengan kunci cipher standar militer. Database administrator sekalipun tidak dapat membaca NIK asli tanpa dekripsi resmi.',
      },
      {
        label: 'Blind Indexing untuk Pencarian Data',
        desc: 'Pencarian warga berdasarkan NIK dilakukan menggunakan indeks deterministik ter-hash (HMAC-SHA256). Hal ini memungkinkan pencarian secepat kilat tanpa perlu mendeskripsi seluruh database kependudukan.',
      },
      {
        label: 'Pengamanan Kata Sandi (Argon2id)',
        desc: 'Kata sandi seluruh akun pengguna diamankan menggunakan algoritma Argon2id (standar OWASP 2026), tahan terhadap serangan brute-force, dictionary attack, maupun GPU password cracking.',
      },
      {
        label: 'Proteksi Kunci Akun (Account Lockout)',
        desc: 'Akun yang mengalami kegagalan login sebanyak 5 kali berturut-turut akan dikunci secara otomatis selama 15 menit untuk mencegah upaya pembobolan kata sandi secara otomatis.',
      },
    ];

    securityItems.forEach((s) => {
      page.drawText(`•  ${s.label}:`, { x: MARGIN_LEFT, y, size: 8.5, font: fontBold, color: cSlate900 });
      y -= 12;
      page.drawText(`    ${s.desc.substring(0, 115)}`, { x: MARGIN_LEFT, y, size: 8, font: fontRegular, color: cSlate700 });
      y -= 11;
      page.drawText(`    ${s.desc.substring(115)}`, { x: MARGIN_LEFT, y, size: 8, font: fontRegular, color: cSlate700 });
      y -= 14;
    });

    drawFooter(page, 2);
  }

  // =========================================================================
  // HALAMAN 3: BAB 2 - STRUKTUR PERAN & WEWENANG (RBAC)
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 2: STRUKTUR PERAN & HAK AKSES');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 2: STRUKTUR PERAN & MATRIKS HAK AKSES PENGGUNA (RBAC)', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 380, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('2.1 Prinsip Pembagian Wewenang Berdasarkan Jabatan', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;
    page.drawText('Sistem menerapkan Role-Based Access Control (RBAC) yang ketat. Setiap pengurus dan warga hanya memiliki', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 12;
    page.drawText('wewenang akses sesuai tugas pokok dan fungsinya dalam organisasi rukun tetangga.', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });

    y -= 16;
    page.drawText('2.2 Matriks Hak Akses Modul Sistem', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 12;

    // Table Header
    const colX = [MARGIN_LEFT, MARGIN_LEFT + 90, MARGIN_LEFT + 155, MARGIN_LEFT + 225, MARGIN_LEFT + 300, MARGIN_LEFT + 375, MARGIN_LEFT + 445];
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: cSlate900,
    });
    page.drawText('Peran (Role)', { x: colX[0] + 5, y: y - 13, size: 8, font: fontBold, color: cWhite });
    page.drawText('Kependudukan', { x: colX[1], y: y - 13, size: 7.5, font: fontBold, color: cWhite });
    page.drawText('E-Surat', { x: colX[2], y: y - 13, size: 7.5, font: fontBold, color: cWhite });
    page.drawText('Tanda Tangan', { x: colX[3], y: y - 13, size: 7.5, font: fontBold, color: cWhite });
    page.drawText('Keuangan Kas', { x: colX[4], y: y - 13, size: 7.5, font: fontBold, color: cWhite });
    page.drawText('Audit Trail', { x: colX[5], y: y - 13, size: 7.5, font: fontBold, color: cWhite });
    page.drawText('Portal Masuk', { x: colX[6], y: y - 13, size: 7.5, font: fontBold, color: cWhite });

    y -= 18;

    const roleMatrix = [
      { role: 'SUPERUSER', p1: 'Full Akses', p2: 'Full Akses', p3: 'Bypass / Ya', p4: 'Full Akses', p5: 'Full Akses', portal: 'Admin Web' },
      { role: 'KETUA_RT', p1: 'Full Kelola', p2: 'Approve/Tolak', p3: 'Resmi (Digital)', p4: 'Monitoring', p5: 'Lihat Log', portal: 'Admin Web' },
      { role: 'SEKRETARIS', p1: 'Full Kelola', p2: 'Verifikasi/Draft', p3: 'Tidak', p4: 'Tidak', p5: 'Tidak', portal: 'Admin Web' },
      { role: 'BENDAHARA', p1: 'Lihat KK/Rumah', p2: 'Tidak', p3: 'Tidak', p4: 'Full Kelola Kas', p5: 'Lihat Kas', portal: 'Admin Web' },
      { role: 'WARGA', p1: 'KK Sendiri', p2: 'Ajukan Surat', p3: 'Tidak', p4: 'Bayar Iuran', p5: 'Tidak', portal: 'Mobile App' },
    ];

    roleMatrix.forEach((r, idx) => {
      const rowBg = idx % 2 === 0 ? cSlate100 : cWhite;
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: y - 18,
        width: CONTENT_WIDTH,
        height: 18,
        color: rowBg,
        borderColor: cSlate200,
        borderWidth: 0.5,
      });
      page.drawText(r.role, { x: colX[0] + 5, y: y - 13, size: 7.5, font: fontBold, color: cSlate900 });
      page.drawText(r.p1, { x: colX[1], y: y - 13, size: 7.5, font: fontRegular, color: cSlate700 });
      page.drawText(r.p2, { x: colX[2], y: y - 13, size: 7.5, font: fontRegular, color: cSlate700 });
      page.drawText(r.p3, { x: colX[3], y: y - 13, size: 7.5, font: fontRegular, color: cSlate700 });
      page.drawText(r.p4, { x: colX[4], y: y - 13, size: 7.5, font: fontRegular, color: cSlate700 });
      page.drawText(r.p5, { x: colX[5], y: y - 13, size: 7.5, font: fontRegular, color: cSlate700 });
      page.drawText(r.portal, { x: colX[6], y: y - 13, size: 7.5, font: fontBold, color: cTealDark });
      y -= 18;
    });

    y -= 15;
    page.drawText('2.3 Rincian Tugas Pokok & Wewenang Peran', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;

    const roleDetails = [
      {
        title: 'Ketua RT (Role: KETUA_RT)',
        desc: 'Pemegang keputusan tertinggi operasional RT. Bertanggung jawab memeriksa permohonan surat pengantar warga yang telah diverifikasi oleh sekretaris, menandatangani surat secara digital, mengawasi kas bersama bendahara, serta memantau keamanan wilayah.',
      },
      {
        title: 'Sekretaris RT (Role: SEKRETARIS)',
        desc: 'Pengelola administrasi umum dan kependudukan. Bertugas mendaftarkan blok rumah dan kartu keluarga, menginput mutasi warga (kelahiran, kepindahan, kematian), memeriksa kelengkapan berkas KTP pemohon surat, dan menyiapkan draft surat pengantar.',
      },
      {
        title: 'Bendahara RT (Role: BENDAHARA)',
        desc: 'Pengelola perbendaharaan RT. Bertugas mengelola 3 pos kas resmi RT (Kas Operasional, Sosial/Kematian, dan Pembangunan), mencatat iuran bulanan warga secara tunai maupun transfer, menginput pengeluaran beserta bukti kuitansi, dan mencetak laporan kas bulanan.',
      },
      {
        title: 'Superuser / Root Administrator (Role: SUPERUSER)',
        desc: 'Pemegang akses darurat dan pemeliharaan teknis sistem. Memiliki kemampuan mendaftarkan akun pengurus RT pertama kali, mereset kata sandi pengurus, mengubah konfigurasi RT, serta melakukan audit keamanan sistem.',
      },
    ];

    roleDetails.forEach((rd) => {
      drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cSlate100, cSlate200);
      page.drawText(rd.title, { x: MARGIN_LEFT + 10, y: y - 14, size: 9, font: fontBold, color: cSlate900 });
      page.drawText(rd.desc.substring(0, 115), { x: MARGIN_LEFT + 10, y: y - 27, size: 8, font: fontRegular, color: cSlate700 });
      page.drawText(rd.desc.substring(115), { x: MARGIN_LEFT + 10, y: y - 38, size: 8, font: fontRegular, color: cSlate700 });
      y -= 54;
    });

    drawFooter(page, 3);
  }

  // =========================================================================
  // HALAMAN 4: BAB 3 - PENDAFTARAN & PENGATURAN AKUN PENGURUS
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 3: PENDAFTARAN AKUN PENGURUS RT');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 3: PANDUAN PENDAFTARAN & PENGATURAN AKUN PENGURUS RT', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 400, y }, thickness: 2, color: cTealPrimary });

    y -= 18;
    page.drawText('3.1 Konsep Keterhubungan Akun dengan Buku Induk Warga', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Pada SIM-RT, setiap akun pengurus (Ketua RT, Sekretaris, Bendahara) WAJIB terhubung dengan data Warga asli', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 11;
    page.drawText('di lingkungan RT 05. Prinsip ini memastikan bahwa penandatangan surat dan pengelola kas merupakan warga resmi.', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });

    y -= 16;
    page.drawText('3.2 Langkah demi Langkah Pendaftaran Akun Pengurus Baru', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;

    const steps = [
      {
        step: 'Langkah 1: Masuk Sebagai Superuser',
        desc: 'Buka https://rt-management-admin.vercel.app/ melalui peramban laptop/komputer. Masukkan Username: superuser dan Password: SuperUser@2026!, lalu klik Masuk Sistem.',
      },
      {
        step: 'Langkah 2: Daftarkan Blok Rumah Pengurus',
        desc: 'Buka menu Kependudukan & KK di sidebar kiri. Klik tombol Tambah Blok Rumah Baru (+). Masukkan Kode Blok (contoh: A), Nomor Rumah (contoh: 01), dan Alamat. Jika nomor KK sudah ada, isi di kolom Nomor KK, lalu klik Simpan Blok Rumah.',
      },
      {
        step: 'Langkah 3: Daftarkan Warga Pengurus ke Dalam KK',
        desc: 'Pada baris rumah yang baru dibuat, klik tombol Kelola Penghuni. Klik Tambah Anggota ke Rumah Ini. Masukkan Nama Lengkap (contoh: Bambang Hermanto), NIK 16 digit, Tempat/Tanggal Lahir, Jenis Kelamin, dan pilih Hubungan Keluarga: KEPALA_KELUARGA. Klik Simpan Data Warga.',
      },
      {
        step: 'Langkah 4: Buatkan Akun Login & Pilih Jabatan',
        desc: 'Pada baris nama warga pengurus tersebut, klik tombol hijau toska Buat Akun. Modal dialog Atur Hak Akses & Akun akan terbuka secara otomatis.',
      },
      {
        step: 'Langkah 5: Tentukan Jabatan & Kredensial Login',
        desc: 'Pada dropdown Jabatan / Hak Akses, pilih peran yang sesuai:\n• Ketua RT : Akses Admin Panel penuh & hak tanda tangan surat pengantar.\n• Sekretaris RT : Akses Admin Panel untuk pendataan kependudukan & verifikasi surat.\n• Bendahara RT : Akses Admin Panel untuk pengelolaan pos kas & pembukuan iuran.\nKemudian masukkan Username login (huruf kecil tanpa spasi) dan Password baru (minimal 8 karakter).',
      },
      {
        step: 'Langkah 6: Simpan & Bagikan Kredensial',
        desc: 'Klik tombol Simpan & Aktifkan Akun. Akun langsung aktif seketika. Berikan username dan password tersebut kepada pengurus bersangkutan. Pengurus dapat langsung login ke portal Admin Panel web.',
      },
    ];

    steps.forEach((s) => {
      drawCard(page, MARGIN_LEFT, y - 56, CONTENT_WIDTH, 56, cSlate100, cSlate200);
      page.drawText(s.step, { x: MARGIN_LEFT + 10, y: y - 14, size: 9, font: fontBold, color: cSlate900 });
      const lines = s.desc.split('\n');
      let lineY = y - 26;
      lines.forEach((l) => {
        page.drawText(l.substring(0, 118), { x: MARGIN_LEFT + 10, y: lineY, size: 7.8, font: fontRegular, color: cSlate700 });
        lineY -= 10;
        if (l.length > 118) {
          page.drawText(l.substring(118), { x: MARGIN_LEFT + 10, y: lineY, size: 7.8, font: fontRegular, color: cSlate700 });
          lineY -= 10;
        }
      });
      y -= 62;
    });

    y -= 4;
    // Box Tips: Pergantian Pengurus
    drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cAmberBg, cAmberBorder);
    page.drawText('PETUNJUK: PERGANTIAN PENGURUS RT / RESET KATA SANDI', {
      x: MARGIN_LEFT + 12,
      y: y - 14,
      size: 8.5,
      font: fontBold,
      color: cAmberText,
    });
    page.drawText('Jika terjadi pergantian pengurus atau pengurus lupa password, buka menu Kependudukan, cari nama warga,', {
      x: MARGIN_LEFT + 12,
      y: y - 26,
      size: 8,
      font: fontRegular,
      color: cAmberText,
    });
    page.drawText('lalu klik tombol Atur Akun. Anda dapat langsung mengganti peran atau mereset password baru tanpa hapus akun.', {
      x: MARGIN_LEFT + 12,
      y: y - 37,
      size: 8,
      font: fontRegular,
      color: cAmberText,
    });

    drawFooter(page, 4);
  }

  // =========================================================================
  // HALAMAN 5: BAB 4 - MODUL KEPENDUDUKAN & PETA KAVLING
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 4: MODUL KEPENDUDUKAN & PETA KAVLING');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 4: MODUL KEPENDUDUKAN, PETA KAVLING & PELINDUNGAN DATA (PII)', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 450, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('4.1 Tampilan Berbasis Kavling Rumah & Buku Kartu Keluarga (KK)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Modul Kependudukan diorganisasikan berbasis data fisik rumah/kavling yang ada di wilayah RT 05:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const items41 = [
      '•  Status Hunian Rumah: Dihuni Pemilik, Dihuni Penyewa/Kontrak, atau Kosong.',
      '•  Manajemen Rumah Kosong: Rumah yang belum berpenghuni tetap dapat didata dan dipantau kewajiban iuran lingkungannya.',
      '•  Struktur Keluarga: Setiap rumah dapat menampung satu atau lebih Kartu Keluarga (KK), lengkap dengan hubungan keluarga.',
    ];
    items41.forEach((it) => {
      page.drawText(it, { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 13;
    });

    y -= 10;
    page.drawText('4.2 Tab Buku Induk Kependudukan & Filter Cepat', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Tab Buku Induk menampilkan seluruh warga secara individual dengan alat bantu pencarian dan filter cepat:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const filters = [
      { name: 'Pencarian Real-Time', desc: 'Ketik nama lengkap atau potongan NIK untuk menyaring data seketika tanpa refresh.' },
      { name: 'Filter Golongan Darah', desc: 'Sangat berguna saat ada kebutuhan donor darah darurat antar warga (A, B, AB, O).' },
      { name: 'Filter Demografi Prioritas', desc: 'Penyaringan kategori Warga Lansia (>60 th), Balita (<5 th), Disabilitas, dan Ibu Hamil.' },
      { name: 'Badge Status Pengurus', desc: 'Menandai warga yang menjabat sebagai Ketua RT (kuning), Sekretaris (biru), dan Bendahara (hijau).' },
    ];

    filters.forEach((f) => {
      drawCard(page, MARGIN_LEFT, y - 36, CONTENT_WIDTH, 36, cSlate100, cSlate200);
      page.drawText(f.name, { x: MARGIN_LEFT + 10, y: y - 13, size: 8.5, font: fontBold, color: cSlate900 });
      page.drawText(f.desc, { x: MARGIN_LEFT + 10, y: y - 25, size: 8, font: fontRegular, color: cSlate700 });
      y -= 42;
    });

    y -= 10;
    page.drawText('4.3 Prosedur Keamanan Pelindungan NIK (PII Masking & Audit Reveal)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Sesuai amanat Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27/2022), NIK warga dilindungi ketat:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const piiSteps = [
      '1. Penyamaran Otomatis (Masking): NIK pada tabel selalu disamarkan menjadi 3276********1234.',
      '2. Tombol Buka NIK (Ikon Mata): Hanya pengurus berwenang yang dapat membuka NIK lengkap.',
      '3. Pemilihan Alasan Resmi: Pengurus wajib memilih alasan pembukaan NIK (Verifikasi Surat / Administrasi KK / Darurat).',
      '4. Pencatatan Audit Trail: Setiap aksi membuka NIK dicatat permanen ke log audit beserta nama pengurus, waktu, dan IP.',
    ];

    piiSteps.forEach((ps) => {
      page.drawText(ps, { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 13;
    });

    y -= 10;
    // Box Dokumen Vault
    drawCard(page, MARGIN_LEFT, y - 55, CONTENT_WIDTH, 55, cTealLight, cTealBorder);
    page.drawText('FITUR DOKUMEN VAULT (BERKAS KTP & KK TERENKRIPSI)', {
      x: MARGIN_LEFT + 12,
      y: y - 14,
      size: 8.5,
      font: fontBold,
      color: cTealDark,
    });
    page.drawText('Foto KTP dan Kartu Keluarga yang diunggah warga disimpan di brankas digital terenkripsi (Dokumen Vault).', {
      x: MARGIN_LEFT + 12,
      y: y - 27,
      size: 8,
      font: fontRegular,
      color: cSlate700,
    });
    page.drawText('Pengurus dapat meninjau berkas asli melalui tombol "Berkas" pada tabel untuk memverifikasi keabsahan data.', {
      x: MARGIN_LEFT + 12,
      y: y - 39,
      size: 8,
      font: fontRegular,
      color: cSlate700,
    });

    drawFooter(page, 5);
  }

  // =========================================================================
  // HALAMAN 6: BAB 5 - MODUL LAYANAN E-SURAT PENGANTAR ONLINE
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 5: LAYANAN E-SURAT PENGANTAR ONLINE');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 5: MODUL LAYANAN E-SURAT PENGANTAR RT BER-BARCODE QR', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 400, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('5.1 Alur Pelayanan E-Surat Pengantar (End-to-End)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Layanan surat pengantar kini 100% digital tanpa perlu warga bolak-balik ke rumah Ketua RT:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const suratSteps = [
      {
        t: '1. Pengajuan oleh Warga (Mobile App)',
        d: 'Warga memilih jenis surat (Pengantar SKCK, KTP Baru, Domisili, Keterangan Usaha, Kematian, dll), mengisi keperluan surat, dan melampirkan berkas KTP dari ponsel.',
      },
      {
        t: '2. Verifikasi oleh Sekretaris RT (Admin Panel)',
        d: 'Sekretaris memeriksa kesesuaian data warga, nomor KK, dan berkas persyaratan di menu Layanan E-Surat. Jika lengkap, status diubah menjadi Disetujui / Siap Tanda Tangan.',
      },
      {
        t: '3. Penandatanganan Digital oleh Ketua RT (Admin Panel)',
        d: 'Ketua RT meninjau draf surat dan membubuhkan tanda tangan digital secara kriptografis (Digital Signature). Sistem otomatis menerbitkan nomor surat resmi dan kode verifikasi unik.',
      },
      {
        t: '4. Unduh & Cetak Surat Ber-Barcode QR',
        d: 'Warga menerima notifikasi langsung di ponselnya dan dapat mengunduh dokumen PDF resmi. Surat dapat dicetak langsung atau diteruskan dalam bentuk PDF ke pihak Kelurahan/Kecamatan.',
      },
    ];

    suratSteps.forEach((st) => {
      drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cSlate100, cSlate200);
      page.drawText(st.t, { x: MARGIN_LEFT + 10, y: y - 14, size: 8.5, font: fontBold, color: cSlate900 });
      page.drawText(st.d.substring(0, 115), { x: MARGIN_LEFT + 10, y: y - 27, size: 8, font: fontRegular, color: cSlate700 });
      page.drawText(st.d.substring(115), { x: MARGIN_LEFT + 10, y: y - 38, size: 8, font: fontRegular, color: cSlate700 });
      y -= 54;
    });

    y -= 8;
    page.drawText('5.2 Fitur Verifikasi Keaslian Surat via Barcode QR', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Setiap surat yang diterbitkan dilengkapi Barcode QR anti-pemalsuan di pojok kanan bawah:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const qrPoints = [
      '•  Petugas Kelurahan Sukamaju atau Polsek Cilodong cukup memindai QR code tersebut menggunakan kamera HP apa saja.',
      '•  Halaman verifikasi resmi akan menampilkan data pemohon, tanggal pengesahan, dan identitas Ketua RT penandatangan.',
      '•  Jika surat telah dimodifikasi atau dipalsukan, sistem verifikasi akan menampilkan peringatan tidak valid.',
    ];
    qrPoints.forEach((qp) => {
      page.drawText(qp, { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 13;
    });

    y -= 10;
    // Box 5 Jenis Template Standar
    drawCard(page, MARGIN_LEFT, y - 60, CONTENT_WIDTH, 60, cBlueBg, cBlueBorder);
    page.drawText('DAFTAR TEMPLATE SURAT STANDAR YANG TERSEDIA DI SISTEM', {
      x: MARGIN_LEFT + 12,
      y: y - 14,
      size: 8.5,
      font: fontBold,
      color: cBlueText,
    });
    page.drawText('1. Surat Pengantar Pembuatan / Perpanjangan SKCK (Kepolisian)', { x: MARGIN_LEFT + 15, y: y - 27, size: 7.8, font: fontRegular, color: cBlueText });
    page.drawText('2. Surat Keterangan Domisili Tempat Tinggal Warga', { x: MARGIN_LEFT + 15, y: y - 38, size: 7.8, font: fontRegular, color: cBlueText });
    page.drawText('3. Surat Pengantar Permohonan KTP-el / KK Baru di Kelurahan', { x: MARGIN_LEFT + 15, y: y - 49, size: 7.8, font: fontRegular, color: cBlueText });
    page.drawText('4. Surat Keterangan Usaha Mikro / UMKM Warga', { x: MARGIN_LEFT + 270, y: y - 27, size: 7.8, font: fontRegular, color: cBlueText });
    page.drawText('5. Surat Keterangan Kematian / Berita Duka', { x: MARGIN_LEFT + 270, y: y - 38, size: 7.8, font: fontRegular, color: cBlueText });

    drawFooter(page, 6);
  }

  // =========================================================================
  // HALAMAN 7: BAB 6 - KEUANGAN & KAS RT
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 6: KEUANGAN, IURAN & KAS RT');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 6: MODUL KAS, IURAN WARGA & TRANSPARANSI KEUANGAN RT', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 380, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('6.1 Struktur 3 Pos Keuangan Terpisah (Akuntabilitas Kas)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Untuk menjamin dana warga tidak tercampur aduk, SIM-RT menerapkan pembukuan 3 pos kas independen:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const posKas = [
      {
        nama: '1. Pos Kas Operasional RT',
        desc: 'Diperuntukkan membiayai operasional rutin bulanan: gaji petugas kebersihan sampah, honor petugas keamanan malam, listrik penerangan jalan umum (PJU), dan pengadaan ATK sekretariat.',
      },
      {
        nama: '2. Pos Kas Sosial & Kematian (Santunan)',
        desc: 'Dana khusus yang dialokasikan untuk kepedulian warga: santunan duka cita keluarga yang tertimpa musibah kematian, bantuan warga sakit opname di RS, dan bingkisan hari raya petugas.',
      },
      {
        nama: '3. Pos Kas Pembangunan & Sarana Prasarana',
        desc: 'Dana perbaikan dan perawatan fasilitas fisik: renovasi pos poskamling, pengecatan portal gerbang masuk, perbaikan jalan paving gang, dan pengadaan kamera CCTV lingkungan.',
      },
    ];

    posKas.forEach((pk) => {
      drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cSlate100, cSlate200);
      page.drawText(pk.nama, { x: MARGIN_LEFT + 10, y: y - 14, size: 8.5, font: fontBold, color: cSlate900 });
      page.drawText(pk.desc.substring(0, 115), { x: MARGIN_LEFT + 10, y: y - 27, size: 8, font: fontRegular, color: cSlate700 });
      page.drawText(pk.desc.substring(115), { x: MARGIN_LEFT + 10, y: y - 38, size: 8, font: fontRegular, color: cSlate700 });
      y -= 54;
    });

    y -= 8;
    page.drawText('6.2 Pencatatan Iuran Warga & Kuitansi Digital PDF', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    const iuranPoints = [
      '•  Penagihan Otomatis: Setiap awal bulan, sistem otomatis membuat daftar tagihan per rumah.',
      '•  Pembayaran Tunai / Transfer: Bendahara mencatat pembayaran yang diterima baik melalui setor tunai maupun transfer bank.',
      '•  Penerbitan Kuitansi Digital: Begitu pembayaran dicatat, sistem menghasilkan dokumen Kuitansi Resmi PDF ber-nomor unik.',
      '•  Bukti Pembayaran Real-Time: Warga dapat langsung melihat bukti lunas di aplikasi ponsel masing-masing.',
    ];
    iuranPoints.forEach((ip) => {
      page.drawText(ip, { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 13;
    });

    y -= 10;
    page.drawText('6.3 Pencatatan Pengeluaran Kas & Lampiran Bukti Nota', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Setiap rupiah yang dikeluarkan dari kas RT wajib dicatat dengan disiplin transparansi:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;
    const outPoints = [
      '1. Pilih Pos Kas sumber dana yang digunakan (Operasional / Sosial / Pembangunan).',
      '2. Masukkan tanggal transaksi, nama penerima dana, dan rincian peruntukan belanja.',
      '3. Unggah foto nota belanja, kuitansi toko, atau bukti transfer material.',
      '4. Saldo kas pada dashboard dan menu Keuangan akan otomatis terpotong secara akurat.',
    ];
    outPoints.forEach((op) => {
      page.drawText(op, { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 13;
    });

    y -= 10;
    // Box Laporan Keuangan
    drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cTealLight, cTealBorder);
    page.drawText('LAPORAN ARUS KAS REAL-TIME UNTUK RAPAT BULANAN WARGA', {
      x: MARGIN_LEFT + 12,
      y: y - 14,
      size: 8.5,
      font: fontBold,
      color: cTealDark,
    });
    page.drawText('Bendahara tidak perlu lagi menyusun laporan kas manual menjelang rapat RT. Cukup buka tab Laporan Kas,', {
      x: MARGIN_LEFT + 12,
      y: y - 26,
      size: 8,
      font: fontRegular,
      color: cSlate700,
    });
    page.drawText('lalu klik "Unduh Laporan PDF" untuk mencetak neraca kas lengkap beserta grafik pemasukan dan pengeluaran.', {
      x: MARGIN_LEFT + 12,
      y: y - 37,
      size: 8,
      font: fontRegular,
      color: cSlate700,
    });

    drawFooter(page, 7);
  }

  // =========================================================================
  // HALAMAN 8: BAB 7 - APLIKASI WARGA MOBILE (RESIDENT PORTAL)
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 7: PANDUAN APLIKASI WARGA MOBILE');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 7: PANDUAN APLIKASI WARGA MOBILE (RESIDENT PORTAL)', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 380, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('7.1 Cara Membuka & Memasang Aplikasi di Ponsel (Tanpa Play Store)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Aplikasi Warga dibangun dengan teknologi Progressive Web App (PWA) modern yang hemat memori:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const installSteps = [
      {
        t: 'Pada HP Android (Google Chrome)',
        d: 'Buka browser Chrome dan ketik https://rt-management-warga.vercel.app/. Ketuk ikon titik tiga di pojok kanan atas, lalu pilih "Tambahkan ke Layar Utama" (Install App). Ikon aplikasi SIM-RT akan langsung muncul di menu HP Anda.',
      },
      {
        t: 'Pada HP iPhone / iOS (Safari)',
        d: 'Buka browser Safari dan kunjungi https://rt-management-warga.vercel.app/. Ketuk tombol Bagikan (Share) di bilah bawah layar, lalu pilih "Tambahkan ke Layar Utama" (Add to Home Screen).',
      },
    ];

    installSteps.forEach((is) => {
      drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cSlate100, cSlate200);
      page.drawText(is.t, { x: MARGIN_LEFT + 10, y: y - 14, size: 8.5, font: fontBold, color: cSlate900 });
      page.drawText(is.d.substring(0, 115), { x: MARGIN_LEFT + 10, y: y - 27, size: 8, font: fontRegular, color: cSlate700 });
      page.drawText(is.d.substring(115), { x: MARGIN_LEFT + 10, y: y - 38, size: 8, font: fontRegular, color: cSlate700 });
      y -= 54;
    });

    y -= 8;
    page.drawText('7.2 Fitur-Fitur Unggulan untuk Warga Lingkungan RT 05', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 14;

    const wFeatures = [
      {
        n: 'Jadwal Ronda Malam Digital',
        d: 'Warga dapat melihat giliran jadwal poskamling malam ini, daftar regu ronda yang bertugas, serta nomor kontak darurat posko keamanan.',
      },
      {
        n: 'Permohonan E-Surat Mandiri',
        d: 'Warga dapat mengajukan surat kapan saja dari rumah tanpa perlu menunggu malam hari untuk bertamu ke rumah Ketua RT.',
      },
      {
        n: 'Kartu Iuran Digital',
        d: 'Warga dapat mengecek histori iuran bulanan keluarga, melihat status lunas/belum, serta mengunduh kuitansi resmi.',
      },
      {
        n: 'Layanan Pengaduan & Aduan Warga',
        d: 'Warga dapat melaporkan masalah lingkungan seperti lampu jalan mati, got mampet, atau gangguan ketertiban secara tertulis & terpantau.',
      },
      {
        n: 'Papan Pengumuman & Tombol Darurat (SOS)',
        d: 'Informasi kegiatan kerja bakti, posyandu, dan rapat RT tersaji di halaman muka, lengkap dengan tombol panggil ambulans/pemadam/polisi.',
      },
    ];

    wFeatures.forEach((wf) => {
      page.drawText(`•  ${wf.n}:`, { x: MARGIN_LEFT, y, size: 8.5, font: fontBold, color: cSlate900 });
      y -= 12;
      page.drawText(`    ${wf.d}`, { x: MARGIN_LEFT, y, size: 8, font: fontRegular, color: cSlate700 });
      y -= 14;
    });

    y -= 8;
    // Box Kemudahan Warga
    drawCard(page, MARGIN_LEFT, y - 48, CONTENT_WIDTH, 48, cTealLight, cTealBorder);
    page.drawText('LOGIN MUDAH & CEPAT UNTUK KEPALA KELUARGA & ANGGOTA', {
      x: MARGIN_LEFT + 12,
      y: y - 14,
      size: 8.5,
      font: fontBold,
      color: cTealDark,
    });
    page.drawText('Setiap anggota keluarga dalam KK yang telah dibuatkan akun oleh pengurus dapat masuk ke aplikasi menggunakan', {
      x: MARGIN_LEFT + 12,
      y: y - 26,
      size: 8,
      font: fontRegular,
      color: cSlate700,
    });
    page.drawText('username dan password masing-masing secara aman.', {
      x: MARGIN_LEFT + 12,
      y: y - 37,
      size: 8,
      font: fontRegular,
      color: cSlate700,
    });

    drawFooter(page, 8);
  }

  // =========================================================================
  // HALAMAN 9: BAB 8 - PEMULIHAN AKUN, DARURAT & BANTUAN TEKNIS
  // =========================================================================
  {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, 'BAB 8: PEMULIHAN AKUN & BANTUAN TEKNIS');

    let y = PAGE_HEIGHT - 55;

    page.drawText('BAB 8: PEMULIHAN AKUN, KEAMANAN DARURAT & BANTUAN TEKNIS', {
      x: MARGIN_LEFT,
      y,
      size: 13,
      font: fontBold,
      color: cSlate900,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: MARGIN_LEFT + 400, y }, thickness: 2, color: cTealPrimary });

    y -= 20;
    page.drawText('8.1 8 Kode Pemulihan Darurat Offline (Emergency Recovery Codes)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Untuk mengantisipasi situasi darurat di mana pengurus lupa kata sandi dan tidak ada koneksi email/SMS:', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 14;

    const rcPoints = [
      '•  Setiap akun baru yang dibuat otomatis dibekali 8 kode pemulihan acak 8 karakter (contoh: RC184920).',
      '•  Kode ini dapat digunakan satu kali per kode untuk mereset kata sandi secara instan di menu Lupa Password.',
      '•  Pengurus disarankan mencatat atau mencetak kode pemulihan ini dan menyimpannya di tempat yang aman.',
    ];
    rcPoints.forEach((rp) => {
      page.drawText(rp, { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 13;
    });

    y -= 10;
    page.drawText('8.2 Prosedur Reset Password oleh Pengurus & Superuser', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    const resetPoints = [
      '1. Jika Warga Lupa Password: Hubungi Sekretaris atau Ketua RT. Pengurus membuka menu Kependudukan, mencari nama warga, klik "Atur Akun", lalu mengetikkan password baru minimal 8 karakter.',
      '2. Jika Pengurus Lupa Password: Masuk menggunakan akun Superuser, buka menu Kependudukan, klik "Atur Akun" pada nama pengurus bersangkutan, dan masukkan password baru.',
      '3. Jika Superuser Lupa Password: Hubungi Administrator Sistem untuk menjalankan skrip reset kredensial root.',
    ];
    resetPoints.forEach((rsp) => {
      page.drawText(rsp.substring(0, 115), { x: MARGIN_LEFT + 5, y, size: 8, font: fontRegular, color: cSlate800 });
      y -= 11;
      if (rsp.length > 115) {
        page.drawText(rsp.substring(115), { x: MARGIN_LEFT + 15, y, size: 8, font: fontRegular, color: cSlate800 });
        y -= 12;
      }
    });

    y -= 10;
    page.drawText('8.3 Menu Audit Trail (Pencatatan Jejak Digital Sistem)', {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font: fontBold,
      color: cTealDark,
    });
    y -= 13;
    page.drawText('Seluruh aktivitas perubahan data, transaksi keuangan, penerbitan surat, pembukaan NIK, dan login', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });
    y -= 11;
    page.drawText('dicatat secara permanen di menu "Audit Trail" untuk keperluan akuntabilitas hukum dan pertanggungjawaban.', {
      x: MARGIN_LEFT,
      y,
      size: 8.5,
      font: fontRegular,
      color: cSlate700,
    });

    y -= 18;
    // Box Kontak Bantuan & Pengesahan
    drawCard(page, MARGIN_LEFT, y - 110, CONTENT_WIDTH, 110, cSlate900, cTealPrimary);
    page.drawText('LEMBAR PENGESAHAN & LAYANAN DUKUNGAN SISTEM', {
      x: MARGIN_LEFT + 15,
      y: y - 20,
      size: 9.5,
      font: fontBold,
      color: rgb(204 / 255, 251 / 255, 241 / 255),
    });
    page.drawText('Buku panduan ini disahkan untuk dipergunakan dalam penyelenggaraan administrasi:', {
      x: MARGIN_LEFT + 15,
      y: y - 35,
      size: 8,
      font: fontRegular,
      color: rgb(226 / 255, 232 / 255, 240 / 255),
    });
    page.drawText('Rukun Tetangga (RT) 05 / Rukun Warga (RW) 02, Kelurahan Sukamaju, Kecamatan Cilodong, Kota Depok', {
      x: MARGIN_LEFT + 15,
      y: y - 48,
      size: 8,
      font: fontBold,
      color: cWhite,
    });
    page.drawText('Kontak Administrator Teknis : Tim Pengembang SIM-RT Depok (2026)', {
      x: MARGIN_LEFT + 15,
      y: y - 65,
      size: 8,
      font: fontRegular,
      color: rgb(153 / 255, 246 / 255, 228 / 255),
    });
    page.drawText('Pembaruan Terakhir          : 20 Oktober 2026 - Production Release v1.0', {
      x: MARGIN_LEFT + 15,
      y: y - 77,
      size: 8,
      font: fontRegular,
      color: rgb(153 / 255, 246 / 255, 228 / 255),
    });
    page.drawText('Lisensi & Hak Cipta         : Seluruh Hak Cipta Dilindungi Undang-Undang Republik Indonesia', {
      x: MARGIN_LEFT + 15,
      y: y - 89,
      size: 8,
      font: fontRegular,
      color: rgb(153 / 255, 246 / 255, 228 / 255),
    });

    drawFooter(page, 9);
  }

  // Save the PDF
  const pdfBytes = await doc.save();

  // Save to multiple locations:
  // 1. Root of workspace
  const rootPath = path.resolve('BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf');
  fs.writeFileSync(rootPath, pdfBytes);

  // 2. Admin Panel public directory (accessible via web /BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf)
  const adminPublic = path.resolve('apps/admin-panel/public/BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf');
  fs.mkdirSync(path.dirname(adminPublic), { recursive: true });
  fs.writeFileSync(adminPublic, pdfBytes);

  // 3. Resident Mobile public directory
  const mobilePublic = path.resolve('apps/resident-mobile/public/BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf');
  fs.mkdirSync(path.dirname(mobilePublic), { recursive: true });
  fs.writeFileSync(mobilePublic, pdfBytes);

  // 4. Artifact directory
  const artifactDir = 'C:/Users/adam.cid00676/.gemini/antigravity/brain/13c4e793-d4c4-4e44-8487-5ef653428ec0';
  if (fs.existsSync(artifactDir)) {
    fs.writeFileSync(path.join(artifactDir, 'BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf'), pdfBytes);
  }

  console.log('PDF generated successfully!');
  console.log('Size:', (pdfBytes.length / 1024).toFixed(1), 'KB');
  console.log('Saved to:');
  console.log(' -', rootPath);
  console.log(' -', adminPublic);
  console.log(' -', mobilePublic);
}

generateManualPdf().catch(console.error);
