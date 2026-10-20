import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export interface QrCardItem {
  nomorKk: string;
  blok: string;
  nomorRumah: string;
  token: string;
}

export interface SuratPengantarParams {
  nomorSurat: string;
  namaWarga: string;
  nikMasked: string;
  tempatTanggalLahir: string;
  agama: string;
  pekerjaan: string;
  alamat: string;
  jenisSurat: string;
  keperluan: string;
  tanggalSurat: string;
  namaKetuaRt: string;
  signatureHex: string;
  verificationUrl: string;
  kodeRt?: string;
  kodeRw?: string;
  namaKelurahan?: string;
  namaKecamatan?: string;
  namaKota?: string;
  kodePos?: string;
}

export interface KwitansiParams {
  nomorKwitansi: string;
  namaWarga: string;
  blokRumah: string;
  periode: string;
  nominal: number;
  tanggalBayar: string;
  namaBendahara: string;
  hashReference: string;
  kodeRt?: string;
  kodeRw?: string;
  namaKota?: string;
}

export class PdfGeneratorService {
  /**
   * Generate A4 Sheet of 8 Activation QR Cards (2 columns x 4 rows) with dashed cut guides
   */
  public async generateQrActivationCards(cards: QrCardItem[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size in points
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const margin = 20;
    const cardWidth = (595.28 - margin * 3) / 2; // ~267 pt
    const cardHeight = (841.89 - margin * 5) / 4; // ~185 pt

    for (let i = 0; i < Math.min(cards.length, 8); i++) {
      const card = cards[i];
      const col = i % 2;
      const row = Math.floor(i / 2);

      const x = margin + col * (cardWidth + margin);
      const y = 841.89 - margin - (row + 1) * cardHeight - row * margin;

      // Draw Card Border with Rounded appearance
      page.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        borderColor: rgb(0.06, 0.46, 0.43), // Teal-700
        borderWidth: 1.5,
        color: rgb(0.98, 0.99, 0.99),
      });

      // Header Banner
      page.drawRectangle({
        x: x + 1,
        y: y + cardHeight - 28,
        width: cardWidth - 2,
        height: 27,
        color: rgb(0.06, 0.46, 0.43),
      });

      page.drawText('KARTU AKTIVASI WARGA SIM-RT', {
        x: x + 12,
        y: y + cardHeight - 19,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Generate QR Code PNG Buffer
      const qrDataUrl = await QRCode.toDataURL(card.token, {
        margin: 1,
        width: 120,
        errorCorrectionLevel: 'M',
      });
      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'));

      // Draw QR Image
      page.drawImage(qrImage, {
        x: x + 10,
        y: y + 25,
        width: 95,
        height: 95,
      });

      // Card Information Text
      page.drawText(`Blok / Rumah : ${card.blok} No. ${card.nomorRumah}`, {
        x: x + 115,
        y: y + cardHeight - 48,
        size: 8.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      page.drawText(`Nomor KK     : ${card.nomorKk}`, {
        x: x + 115,
        y: y + cardHeight - 63,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText('KODE TOKEN AKTIVASI:', {
        x: x + 115,
        y: y + cardHeight - 83,
        size: 7.5,
        font: fontBold,
        color: rgb(0.06, 0.46, 0.43),
      });

      page.drawText(card.token.substring(0, 16), {
        x: x + 115,
        y: y + cardHeight - 98,
        size: 9,
        font: fontMono,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Instructions footer inside card
      page.drawText('* Scan QR ini di aplikasi Resident Mobile', {
        x: x + 10,
        y: y + 12,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      page.drawText('* Berlaku 1x aktivasi untuk 1 Kepala Keluarga', {
        x: x + 10,
        y: y + 4,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generate Single Individual Activation QR Card PDF (A6 landscape: 420 x 297 pt)
   */
  public async generateSingleQrActivationCard(card: QrCardItem & { kepalaKeluarga?: string | undefined; rtName?: string | undefined }): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const width = 420;
    const height = 297;
    const page = pdfDoc.addPage([width, height]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    // Card background
    page.drawRectangle({
      x: 10,
      y: 10,
      width: width - 20,
      height: height - 20,
      borderColor: rgb(0.06, 0.46, 0.43),
      borderWidth: 2,
      color: rgb(0.99, 1, 1),
    });

    // Top Header Banner
    page.drawRectangle({
      x: 12,
      y: height - 55,
      width: width - 24,
      height: 43,
      color: rgb(0.06, 0.46, 0.43),
    });

    page.drawText('KARTU AKTIVASI WARGA RESMI', {
      x: 25,
      y: height - 35,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(card.rtName || 'SISTEM INFORMASI MANAJEMEN RUKUN TETANGGA', {
      x: 25,
      y: height - 48,
      size: 9,
      font,
      color: rgb(0.85, 0.95, 0.95),
    });

    // Generate QR Code PNG
    const qrDataUrl = await QRCode.toDataURL(card.token, {
      margin: 1,
      width: 140,
      errorCorrectionLevel: 'H',
    });
    const qrImage = await pdfDoc.embedPng(Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));

    // Draw QR on Right side
    page.drawImage(qrImage, {
      x: width - 155,
      y: height - 200,
      width: 130,
      height: 130,
    });

    // Draw Resident Details on Left side
    page.drawText('DATA KELUARGA PENERIMA:', {
      x: 25,
      y: height - 75,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.3, 0.3),
    });

    page.drawText('Alamat Rumah:', { x: 25, y: height - 95, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(`Blok ${card.blok} No. ${card.nomorRumah}`, { x: 105, y: height - 95, size: 10, font: fontBold, color: rgb(0.06, 0.46, 0.43) });

    page.drawText('Nomor KK:', { x: 25, y: height - 115, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(card.nomorKk, { x: 105, y: height - 115, size: 10, font: fontMono, color: rgb(0.1, 0.1, 0.1) });

    if (card.kepalaKeluarga) {
      page.drawText('Kepala Kel.:', { x: 25, y: height - 135, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(card.kepalaKeluarga, { x: 105, y: height - 135, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    }

    page.drawText('Kode Token:', { x: 25, y: height - 155, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(card.token, { x: 105, y: height - 155, size: 9, font: fontMono, color: rgb(0.06, 0.46, 0.43) });

    // Security warning box
    page.drawRectangle({
      x: 25,
      y: 25,
      width: width - 50,
      height: 52,
      color: rgb(0.95, 0.98, 0.98),
      borderColor: rgb(0.8, 0.9, 0.9),
      borderWidth: 1,
    });

    page.drawText('PETUNJUK KEAMANAN & AKTIVASI:', { x: 35, y: 64, size: 8, font: fontBold, color: rgb(0.06, 0.46, 0.43) });
    page.drawText('1. Buka aplikasi Warga SIM-RT di ponsel Anda, lalu pilih menu "Aktivasi Akun".', { x: 35, y: 52, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('2. Pindai QR di atas atau masukkan kode token secara manual.', { x: 35, y: 41, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('3. Verifikasi 4 digit terakhir NIK Kepala Keluarga Anda dan buat kata sandi akun.', { x: 35, y: 30, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generate Official E-Surat Pengantar RT PDF with Kop, Ed25519 signature & QR verification
   */
  public async generateSuratPengantarPdf(params: SuratPengantarParams): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

    const left = 50;
    let y = 790;

    const rtStr = params.kodeRt || '05';
    const rwStr = params.kodeRw || '02';
    const kelurahanStr = (params.namaKelurahan || 'Sukamaju').toUpperCase();
    const kecamatanStr = (params.namaKecamatan || 'Cilodong').toUpperCase();
    const kotaStr = (params.namaKota || 'Kota Depok').toUpperCase();
    const kodePosStr = params.kodePos || '16415';

    // Kop Surat
    page.drawText(`RUKUN TETANGGA ${rtStr} / RUKUN WARGA ${rwStr}`, {
      x: 150,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43),
    });
    y -= 18;
    page.drawText(`KELURAHAN ${kelurahanStr}, KECAMATAN ${kecamatanStr}, ${kotaStr}`, {
      x: 100,
      y,
      size: 9.5,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 14;
    page.drawText(`Sekretariat: Pos RT ${rtStr}/${rwStr} ${params.namaKecamatan || 'Cilodong'}, ${params.namaKota || 'Depok'} - Kode Pos ${kodePosStr}`, {
      x: 130,
      y,
      size: 8.5,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Horizontal Separator Line
    y -= 12;
    page.drawLine({
      start: { x: left, y },
      end: { x: 545, y },
      thickness: 2,
      color: rgb(0.06, 0.46, 0.43),
    });

    // Judul Surat
    y -= 35;
    page.drawText(params.jenisSurat.toUpperCase(), {
      x: 180,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 15;
    page.drawText(`Nomor: ${params.nomorSurat}`, {
      x: 210,
      y,
      size: 9.5,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Pembuka
    y -= 35;
    page.drawText(`Yang bertanda tangan di bawah ini Ketua RT ${rtStr} / RW ${rwStr} menerangkan bahwa:`, {
      x: left,
      y,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });

    // Biodata
    const biodata = [
      ['Nama Lengkap', `: ${params.namaWarga}`],
      ['NIK', `: ${params.nikMasked}`],
      ['Tempat / Tanggal Lahir', `: ${params.tempatTanggalLahir}`],
      ['Agama', `: ${params.agama}`],
      ['Pekerjaan', `: ${params.pekerjaan}`],
      ['Alamat Domisili', `: ${params.alamat}`],
      ['Keperluan', `: ${params.keperluan}`],
    ];

    y -= 25;
    for (const [label, val] of biodata) {
      page.drawText(label, { x: left + 20, y, size: 9.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(val, { x: left + 180, y, size: 9.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    }

    // Paragraf Penutup
    y -= 15;
    page.drawText(
      'Demikian surat pengantar ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
      {
        x: left,
        y,
        size: 9.5,
        font,
        color: rgb(0.15, 0.15, 0.15),
      }
    );

    // Tanda Tangan & QR Verification
    y -= 45;
    const kotaNama = params.namaKota || 'Depok';
    page.drawText(`${kotaNama}, ${params.tanggalSurat}`, {
      x: 380,
      y,
      size: 9.5,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 15;
    page.drawText(`Ketua RT ${rtStr} / RW ${rwStr},`, {
      x: 380,
      y,
      size: 9.5,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    // QR Code Verifikasi
    const qrDataUrl = await QRCode.toDataURL(params.verificationUrl, { margin: 1, width: 120 });
    const qrImage = await pdfDoc.embedPng(Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));

    page.drawImage(qrImage, {
      x: left + 20,
      y: y - 85,
      width: 80,
      height: 80,
    });

    page.drawText('Scan QR Code ini untuk', { x: left + 110, y: y - 35, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('verifikasi keaslian surat resmi', { x: left + 110, y: y - 47, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('Ed25519 Cryptographically Signed', { x: left + 110, y: y - 60, size: 7.5, font: fontBold, color: rgb(0.06, 0.46, 0.43) });

    // Nama Ketua RT
    page.drawText(params.namaKetuaRt, {
      x: 380,
      y: y - 80,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Cryptographic Signature Footer
    page.drawRectangle({
      x: left,
      y: 40,
      width: 495,
      height: 25,
      color: rgb(0.96, 0.97, 0.98),
    });

    page.drawText(`Digital Signature (Ed25519): ${params.signatureHex.substring(0, 56)}...`, {
      x: left + 10,
      y: 50,
      size: 7,
      font: fontMono,
      color: rgb(0.3, 0.3, 0.3),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generate Official Kwitansi Iuran RT PDF
   */
  public async generateKwitansiIuranPdf(params: KwitansiParams): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([500, 300]); // Kwitansi Landscape size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

    // Border
    page.drawRectangle({
      x: 10,
      y: 10,
      width: 480,
      height: 280,
      borderColor: rgb(0.06, 0.46, 0.43),
      borderWidth: 1.5,
      color: rgb(1, 1, 1),
    });

    const rtStr = params.kodeRt || '05';
    const rwStr = params.kodeRw || '02';

    // Header
    page.drawText(`KWITANSI PEMBAYARAN IURAN RT ${rtStr}/RW ${rwStr}`, {
      x: 25,
      y: 260,
      size: 12,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43),
    });
    page.drawText(`No: ${params.nomorKwitansi}`, {
      x: 350,
      y: 260,
      size: 9,
      font: fontMono,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawLine({
      start: { x: 25, y: 250 },
      end: { x: 475, y: 250 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Content
    const lines = [
      ['Telah terima dari', `: ${params.namaWarga}`],
      ['Blok / Rumah', `: ${params.blokRumah}`],
      ['Untuk Pembayaran', `: Iuran Warga Periode ${params.periode}`],
      ['Tanggal Bayar', `: ${params.tanggalBayar}`],
    ];

    let y = 225;
    for (const [label, val] of lines) {
      page.drawText(label, { x: 25, y, size: 9.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(val, { x: 160, y, size: 9.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 20;
    }

    // Nominal Box
    page.drawRectangle({
      x: 25,
      y: 85,
      width: 220,
      height: 35,
      color: rgb(0.9, 0.96, 0.95),
      borderColor: rgb(0.06, 0.46, 0.43),
      borderWidth: 1,
    });

    const nominalStr = `Rp ${params.nominal.toLocaleString('id-ID')},-`;
    page.drawText(nominalStr, {
      x: 40,
      y: 97,
      size: 14,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43),
    });

    // Bendahara signature
    page.drawText('Bendahara RT,', { x: 350, y: 120, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(params.namaBendahara, { x: 350, y: 70, size: 9.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    // Hash reference footer
    page.drawText(`Ledger Hash: ${params.hashReference.substring(0, 36)}...`, {
      x: 25,
      y: 25,
      size: 7,
      font: fontMono,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generate Sheet of 8 Offline Recovery Codes
   */
  public async generateOfflineRecoverySheet(username: string, codes: string[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 320]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    // Border
    page.drawRectangle({
      x: 15,
      y: 15,
      width: 370,
      height: 290,
      borderColor: rgb(0.43, 0.16, 0.85), // Violet-700
      borderWidth: 2,
      color: rgb(0.99, 0.99, 1),
    });

    // Header
    page.drawText('SIM-RT: KARTU KODE PEMULIHAN OFFLINE', {
      x: 35,
      y: 275,
      size: 11,
      font: fontBold,
      color: rgb(0.43, 0.16, 0.85),
    });

    page.drawText(`Akun: ${username}`, {
      x: 35,
      y: 255,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText('Simpan kartu ini di tempat yang aman. Setiap kode hanya berlaku 1 kali.', {
      x: 35,
      y: 240,
      size: 7.5,
      font,
      color: rgb(0.5, 0.2, 0.2),
    });

    // Codes 2-column grid
    let y = 195;
    for (let i = 0; i < codes.length; i++) {
      const col = i % 2;
      const x = col === 0 ? 45 : 210;

      page.drawRectangle({
        x: x - 5,
        y: y - 5,
        width: 140,
        height: 28,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.8, 0.9),
        borderWidth: 1,
      });

      page.drawText(`${i + 1}. [ ${codes[i]} ]`, {
        x: x + 10,
        y: y + 4,
        size: 11,
        font: fontMono,
        color: rgb(0.1, 0.1, 0.2),
      });

      if (col === 1) {
        y -= 38;
      }
    }

    page.drawText('* Gunakan kode ini jika Anda lupa password tanpa membutuhkan SMS/Email.', {
      x: 35,
      y: 35,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
