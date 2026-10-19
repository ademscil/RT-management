import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { EnvelopeCryptoAdapter } from '../src/infrastructure/crypto/envelope-crypto.adapter.js';
import { HmacBlindIndexAdapter } from '../src/infrastructure/crypto/blind-index.adapter.js';
import { Ed25519SignerAdapter } from '../src/infrastructure/crypto/ed25519-signer.adapter.js';
import { HashChainService } from '../src/infrastructure/ledger/hash-chain.service.js';

const prisma = new PrismaClient();
const cryptoAdapter = new EnvelopeCryptoAdapter();
const blindIndexAdapter = new HmacBlindIndexAdapter();
const signerAdapter = new Ed25519SignerAdapter();
const hashChainService = new HashChainService();

async function main() {
  console.log('Seeding SIM-RT database with production seed data...');

  // 1. Rukun Tetangga Config & Ed25519 Digital Signing Keys
  const { publicKeyPem, privateKeyPem } = signerAdapter.generateKeyPair();
  const encryptedPrivateKey = cryptoAdapter.encryptField(privateKeyPem);

  const existingConfig = await prisma.rukunTetanggaConfig.findFirst();
  if (!existingConfig) {
    await prisma.rukunTetanggaConfig.create({
      data: {
        kodeRt: '05',
        kodeRw: '02',
        namaKelurahan: 'Sukamaju',
        namaKecamatan: 'Cilodong',
        namaKota: 'Kota Depok',
        kodePos: '16415',
        ed25519PublicKey: publicKeyPem,
        ed25519PrivateKeyEnc: encryptedPrivateKey,
      },
    });
    console.log('RT 05/02 Config created with Ed25519 digital signature keypair.');
  }

  // 2. Pos Keuangan
  const posList = [
    { kodePosKas: 'POS-OPS', namaPos: 'Kas Operasional RT', saldoBerjalan: BigInt(5000000) },
    { kodePosKas: 'POS-SOS', namaPos: 'Kas Sosial & Duka', saldoBerjalan: BigInt(2500000) },
    { kodePosKas: 'POS-PAN', namaPos: 'Kas Kepanitiaan & Pembangunan', saldoBerjalan: BigInt(1000000) },
  ];

  for (const pos of posList) {
    await prisma.posKeuangan.upsert({
      where: { kodePosKas: pos.kodePosKas },
      update: {},
      create: pos,
    });
  }
  console.log('3 Pos Keuangan initialized (Operasional, Sosial, Kepanitiaan).');

  // 3. Jenis Surat Templates
  const templates = [
    {
      kodeSurat: 'SK-PENGANTAR',
      namaSurat: 'Surat Pengantar Umum',
      formatNomor: '{NO}/RT05-RW02/SKP/{BULAN}/{TAHUN}',
      templateHtml: '<p>Surat pengantar umum untuk keperluan administrasi warga.</p>',
      syaratDokumen: JSON.stringify(['KTP', 'KK']),
    },
    {
      kodeSurat: 'SK-KTP',
      namaSurat: 'Surat Pengantar Pembuatan KTP / KK',
      formatNomor: '{NO}/RT05-RW02/KTP/{BULAN}/{TAHUN}',
      templateHtml: '<p>Surat pengantar untuk pengurusan dokumen kependudukan ke kelurahan.</p>',
      syaratDokumen: JSON.stringify(['FOTO_KTP_LAMA', 'FOTO_KK']),
    },
    {
      kodeSurat: 'SK-DOMISILI',
      namaSurat: 'Surat Keterangan Domisili Tinggal',
      formatNomor: '{NO}/RT05-RW02/SKD/{BULAN}/{TAHUN}',
      templateHtml: '<p>Surat keterangan resmi bahwa warga berdomisili di RT 05/02.</p>',
      syaratDokumen: JSON.stringify(['KTP', 'BUKTI_SEWA_RUMAH']),
    },
    {
      kodeSurat: 'SK-USAHA',
      namaSurat: 'Surat Keterangan Usaha (SKU)',
      formatNomor: '{NO}/RT05-RW02/SKU/{BULAN}/{TAHUN}',
      templateHtml: '<p>Surat keterangan kepemilikan usaha di lingkungan RT 05/02.</p>',
      syaratDokumen: JSON.stringify(['KTP', 'FOTO_USAHA']),
    },
    {
      kodeSurat: 'SK-KEMATIAN',
      namaSurat: 'Surat Keterangan Kematian & Santunan Duka',
      formatNomor: '{NO}/RT05-RW02/SKM/{BULAN}/{TAHUN}',
      templateHtml: '<p>Surat keterangan kematian warga dan pencairan santunan duka.</p>',
      syaratDokumen: JSON.stringify(['SURAT_DOKTER_RS']),
    },
  ];

  for (const t of templates) {
    await prisma.jenisSuratTemplate.upsert({
      where: { kodeSurat: t.kodeSurat },
      update: {},
      create: t,
    });
  }
  console.log('5 Standard E-Surat templates seeded.');

  // 4. Rumah / Kavling
  const rumahData = [
    { kodeBlok: 'A1', nomorRumah: '01', alamat: 'Jl. Melati Blok A1 No. 01', gridX: 1, gridY: 1, statusHunian: 'DIHUNI_PEMILIK', hasVulnerability: false },
    { kodeBlok: 'A2', nomorRumah: '02', alamat: 'Jl. Melati Blok A1 No. 02', gridX: 1, gridY: 2, statusHunian: 'DIHUNI_PEMILIK', hasVulnerability: false },
    { kodeBlok: 'A3', nomorRumah: '03', alamat: 'Jl. Melati Blok A1 No. 03', gridX: 1, gridY: 3, statusHunian: 'DIHUNI_PEMILIK', hasVulnerability: true }, // Lansia
    { kodeBlok: 'B1', nomorRumah: '01', alamat: 'Jl. Mawar Blok B1 No. 01', gridX: 2, gridY: 1, statusHunian: 'DIHUNI_PEMILIK', hasVulnerability: false },
    { kodeBlok: 'B2', nomorRumah: '02', alamat: 'Jl. Mawar Blok B1 No. 02', gridX: 2, gridY: 2, statusHunian: 'DIHUNI_PENYEWA', hasVulnerability: false },
  ];

  const rumahMap = new Map<string, string>();
  for (const r of rumahData) {
    const res = await prisma.rumahKavling.upsert({
      where: { kodeBlok: r.kodeBlok },
      update: {},
      create: r,
    });
    rumahMap.set(r.kodeBlok, res.id);
  }
  console.log('5 Rumah Kavling seeded.');

  // 5. Initial Warga & Kartu Keluarga (with Envelope Encryption & Blind Indexing)
  // Warga 1: Ketua RT (Pak Bambang)
  const noKk1 = '3276010101900001';
  const nik1 = '3276011508750001';

  let kkKetua = await prisma.kartuKeluarga.findUnique({
    where: { noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk1) },
  });

  if (!kkKetua) {
    kkKetua = await prisma.kartuKeluarga.create({
      data: {
        rumahId: rumahMap.get('A1')!,
        noKkEncrypted: cryptoAdapter.encryptField(noKk1),
        noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk1),
        noKkMasked: blindIndexAdapter.maskNoKk(noKk1),
        statusDomisili: 'TETAP',
        statusVerifikasi: 'VERIFIED',
      },
    });
  }

  let wargaKetua = await prisma.warga.findUnique({
    where: { nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik1) },
  });

  if (!wargaKetua) {
    wargaKetua = await prisma.warga.create({
      data: {
        kkId: kkKetua.id,
        namaLengkap: 'Bambang Pamungkas, S.T.',
        nikEncrypted: cryptoAdapter.encryptField(nik1),
        nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik1),
        nikMasked: blindIndexAdapter.maskNik(nik1),
        tempatLahir: 'Semarang',
        tanggalLahir: '1975-08-15',
        gender: 'LAKI_LAKI',
        golonganDarah: 'O_POSITIF',
        agama: 'ISLAM',
        pendidikanTerakhir: 'S1 Teknik',
        pekerjaan: 'Wiraswasta',
        statusPerkawinan: 'KAWIN',
        hubunganKeluarga: 'KEPALA_KELUARGA',
        statusKependudukan: 'TETAP',
      },
    });
  }

  // Warga 2: Sekretaris (Pak Agus)
  const noKk2 = '3276010101900002';
  const nik2 = '3276012003820002';

  let kkSekretaris = await prisma.kartuKeluarga.findUnique({
    where: { noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk2) },
  });
  if (!kkSekretaris) {
    kkSekretaris = await prisma.kartuKeluarga.create({
      data: {
        rumahId: rumahMap.get('A2')!,
        noKkEncrypted: cryptoAdapter.encryptField(noKk2),
        noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk2),
        noKkMasked: blindIndexAdapter.maskNoKk(noKk2),
        statusDomisili: 'TETAP',
        statusVerifikasi: 'VERIFIED',
      },
    });
  }

  let wargaSekretaris = await prisma.warga.findUnique({
    where: { nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik2) },
  });
  if (!wargaSekretaris) {
    wargaSekretaris = await prisma.warga.create({
      data: {
        kkId: kkSekretaris.id,
        namaLengkap: 'Agus Setiawan, S.Kom.',
        nikEncrypted: cryptoAdapter.encryptField(nik2),
        nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik2),
        nikMasked: blindIndexAdapter.maskNik(nik2),
        tempatLahir: 'Jakarta',
        tanggalLahir: '1982-03-20',
        gender: 'LAKI_LAKI',
        golonganDarah: 'A_POSITIF',
        agama: 'ISLAM',
        pendidikanTerakhir: 'S1 Sistem Informasi',
        pekerjaan: 'Software Engineer',
        statusPerkawinan: 'KAWIN',
        hubunganKeluarga: 'KEPALA_KELUARGA',
        statusKependudukan: 'TETAP',
      },
    });
  }

  // Warga 3: Bendahara (Bu Dewi)
  const noKk3 = '3276010101900003';
  const nik3 = '3276011005850003';

  let kkBendahara = await prisma.kartuKeluarga.findUnique({
    where: { noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk3) },
  });
  if (!kkBendahara) {
    kkBendahara = await prisma.kartuKeluarga.create({
      data: {
        rumahId: rumahMap.get('B1')!,
        noKkEncrypted: cryptoAdapter.encryptField(noKk3),
        noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk3),
        noKkMasked: blindIndexAdapter.maskNoKk(noKk3),
        statusDomisili: 'TETAP',
        statusVerifikasi: 'VERIFIED',
      },
    });
  }

  let wargaBendahara = await prisma.warga.findUnique({
    where: { nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik3) },
  });
  if (!wargaBendahara) {
    wargaBendahara = await prisma.warga.create({
      data: {
        kkId: kkBendahara.id,
        namaLengkap: 'Dewi Lestari, S.E.',
        nikEncrypted: cryptoAdapter.encryptField(nik3),
        nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik3),
        nikMasked: blindIndexAdapter.maskNik(nik3),
        tempatLahir: 'Bandung',
        tanggalLahir: '1985-05-10',
        gender: 'PEREMPUAN',
        golonganDarah: 'B_POSITIF',
        agama: 'ISLAM',
        pendidikanTerakhir: 'S1 Akuntansi',
        pekerjaan: 'Akuntan Publik',
        statusPerkawinan: 'KAWIN',
        hubunganKeluarga: 'KEPALA_KELUARGA',
        statusKependudukan: 'TETAP',
      },
    });
  }

  // Warga 4: Warga Biasa (Lansia)
  const noKk4 = '3276010101900004';
  const nik4 = '3276010101540004';
  let kkLansia = await prisma.kartuKeluarga.findUnique({
    where: { noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk4) },
  });
  if (!kkLansia) {
    kkLansia = await prisma.kartuKeluarga.create({
      data: {
        rumahId: rumahMap.get('A3')!,
        noKkEncrypted: cryptoAdapter.encryptField(noKk4),
        noKkBlindIndex: blindIndexAdapter.computeBlindIndex(noKk4),
        noKkMasked: blindIndexAdapter.maskNoKk(noKk4),
        statusDomisili: 'TETAP',
        statusVerifikasi: 'VERIFIED',
      },
    });
  }
  let wargaLansia = await prisma.warga.findUnique({
    where: { nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik4) },
  });
  if (!wargaLansia) {
    wargaLansia = await prisma.warga.create({
      data: {
        kkId: kkLansia.id,
        namaLengkap: 'Mbah Joyo Sudarsono',
        nikEncrypted: cryptoAdapter.encryptField(nik4),
        nikBlindIndex: blindIndexAdapter.computeBlindIndex(nik4),
        nikMasked: blindIndexAdapter.maskNik(nik4),
        tempatLahir: 'Yogyakarta',
        tanggalLahir: '1954-01-01',
        gender: 'LAKI_LAKI',
        golonganDarah: 'AB_POSITIF',
        agama: 'ISLAM',
        pendidikanTerakhir: 'SMP',
        pekerjaan: 'Pensiunan',
        statusPerkawinan: 'CERAI_MATI',
        hubunganKeluarga: 'KEPALA_KELUARGA',
        statusKependudukan: 'TETAP',
        isLansia: true,
      },
    });
  }

  // 6. User Accounts with Argon2id Password Hashing
  const defaultAccounts = [
    {
      wargaId: wargaKetua.id,
      username: 'ketua_rt',
      password: 'KetuaRT@2026!',
      role: 'KETUA_RT',
    },
    {
      wargaId: wargaSekretaris.id,
      username: 'sekretaris_rt',
      password: 'Sekretaris@2026!',
      role: 'SEKRETARIS',
    },
    {
      wargaId: wargaBendahara.id,
      username: 'bendahara_rt',
      password: 'Bendahara@2026!',
      role: 'BENDAHARA',
    },
    {
      wargaId: wargaLansia.id,
      username: 'warga_test',
      password: 'WargaTest@2026!',
      role: 'WARGA',
    },
  ];

  for (const acc of defaultAccounts) {
    const passwordHash = await hash(acc.password, {
      memoryCost: 65536, // 64MB
      timeCost: 3,
    });

    const user = await prisma.user.upsert({
      where: { username: acc.username },
      update: { role: acc.role },
      create: {
        wargaId: acc.wargaId,
        username: acc.username,
        passwordHash,
        role: acc.role,
        isActive: true,
      },
    });

    // Seed 8 Recovery Codes per User
    const existingCodes = await prisma.recoveryCode.count({ where: { userId: user.id } });
    if (existingCodes === 0) {
      for (let i = 1; i <= 8; i++) {
        const rawCode = `RC${i}${Math.floor(100000 + Math.random() * 900000)}`.substring(0, 8);
        const codeHash = await hash(rawCode);
        await prisma.recoveryCode.create({
          data: {
            userId: user.id,
            codeHash,
          },
        });
      }
    }
  }
  console.log('User accounts created: ketua_rt, sekretaris_rt, bendahara_rt, warga_test.');

  // 7. Genesis Record for Security Audit Logs & Kas Ledger
  const auditCount = await prisma.securityAuditLog.count();
  if (auditCount === 0) {
    const genesisTime = new Date().toISOString();
    const genesisRowHash = hashChainService.computeRowHash(
      HashChainService.GENESIS_HASH,
      'GENESIS-AUDIT',
      'SYSTEM',
      'SYSTEM_INITIALIZATION',
      genesisTime
    );

    await prisma.securityAuditLog.create({
      data: {
        id: 'GENESIS-AUDIT',
        actorUserId: 'SYSTEM',
        actorRole: 'SYSTEM',
        actionType: 'SYSTEM_INITIALIZATION',
        targetEntity: 'SYSTEM',
        targetId: 'SYSTEM',
        accessReason: 'Initial setup of SIM-RT cryptographic ledger',
        ipAddress: '127.0.0.1',
        userAgent: 'SIM-RT Seed Runner',
        prevHash: HashChainService.GENESIS_HASH,
        rowHash: genesisRowHash,
      },
    });
    console.log('Genesis Security Audit Log created with verified hash-chain.');
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
