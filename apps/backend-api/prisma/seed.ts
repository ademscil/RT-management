import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { EnvelopeCryptoAdapter } from '../src/infrastructure/crypto/envelope-crypto.adapter.js';
import { HmacBlindIndexAdapter } from '../src/infrastructure/crypto/blind-index.adapter.js';
import { Ed25519SignerAdapter } from '../src/infrastructure/crypto/ed25519-signer.adapter.js';
import { HashChainService } from '../src/infrastructure/ledger/hash-chain.service.js';
import {
  PLAN_CATALOGUE,
  PlanCode,
  TenantStatus,
  slugifyTenantIdentity,
} from '@simrt/shared-types';

const prisma = new PrismaClient();
const cryptoAdapter = new EnvelopeCryptoAdapter();
const blindIndexAdapter = new HmacBlindIndexAdapter();
const signerAdapter = new Ed25519SignerAdapter();
const hashChainService = new HashChainService();

async function main() {
  console.log('Seeding SIM-RT database with production seed data...');

  // ---------------------------------------------------------------------------
  // 1. Tenant (RT) + Ed25519 digital signing keys
  // ---------------------------------------------------------------------------
  const { publicKeyPem, privateKeyPem } = signerAdapter.generateKeyPair();
  const encryptedPrivateKey = cryptoAdapter.encryptField(privateKeyPem);

  const SEED_SLUG = slugifyTenantIdentity('05', '02', 'Sukamaju', 'Kota Depok');

  let tenant = await prisma.rukunTetanggaConfig.findUnique({ where: { slug: SEED_SLUG } });
  if (!tenant) {
    tenant = await prisma.rukunTetanggaConfig.create({
      data: {
        slug: SEED_SLUG,
        kodeRt: '05',
        kodeRw: '02',
        namaKelurahan: 'Sukamaju',
        namaKecamatan: 'Cilodong',
        namaKota: 'Kota Depok',
        kodePos: '16415',
        status: TenantStatus.ACTIVE,
        planCode: PlanCode.FREE,
        ed25519PublicKey: publicKeyPem,
        ed25519PrivateKeyEnc: encryptedPrivateKey,
      },
    });
    console.log(`Tenant "${SEED_SLUG}" created with Ed25519 digital signature keypair.`);
  }

  // Every tenant-scoped row below is pinned to this id. `rtId` is the anchor of
  // the whole multi-tenant model, so it must be threaded through every write.
  const rtId = tenant.id;

  // ---------------------------------------------------------------------------
  // 1b. Subscription plan catalogue + the tenant's FREE subscription
  // ---------------------------------------------------------------------------
  const planIdByCode = new Map<string, string>();
  for (const [index, plan] of PLAN_CATALOGUE.entries()) {
    const row = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        tagline: plan.tagline,
        priceIdr: plan.priceIdr,
        billingCycle: plan.billingCycle,
        maxKartuKeluarga: plan.quota.maxKartuKeluarga,
        maxWarga: plan.quota.maxWarga,
        maxAdminUsers: plan.quota.maxAdminUsers,
        maxStorageMb: plan.quota.maxStorageMb,
        maxChildTenants: plan.quota.maxChildTenants,
        featuresJson: JSON.stringify(plan.features),
        sortOrder: index,
      },
      create: {
        code: plan.code,
        name: plan.name,
        tagline: plan.tagline,
        midtransSku: plan.midtransSku,
        priceIdr: plan.priceIdr,
        billingCycle: plan.billingCycle,
        maxKartuKeluarga: plan.quota.maxKartuKeluarga,
        maxWarga: plan.quota.maxWarga,
        maxAdminUsers: plan.quota.maxAdminUsers,
        maxStorageMb: plan.quota.maxStorageMb,
        maxChildTenants: plan.quota.maxChildTenants,
        featuresJson: JSON.stringify(plan.features),
        isPublic: true,
        sortOrder: index,
      },
    });
    planIdByCode.set(plan.code, row.id);
  }

  const freePlanId = planIdByCode.get(PlanCode.FREE);
  if (freePlanId) {
    await prisma.tenantSubscription.upsert({
      where: { rtId },
      update: {},
      create: {
        rtId,
        planId: freePlanId,
        planCode: PlanCode.FREE,
        status: 'ACTIVE',
        billingCycle: 'LIFETIME',
        // FREE is perpetual, so there is no term end and no grace window.
        endsAt: null,
        gracePeriodEndsAt: null,
        autoRenew: false,
      },
    });
    console.log(`${PLAN_CATALOGUE.length} subscription plans + FREE subscription seeded.`);
  }

  // 2. Pos Keuangan
  const posList = [
    { kodePosKas: 'POS-OPS', namaPos: 'Kas Operasional RT', saldoBerjalan: BigInt(5000000) },
    { kodePosKas: 'POS-SOS', namaPos: 'Kas Sosial & Duka', saldoBerjalan: BigInt(2500000) },
    { kodePosKas: 'POS-PAN', namaPos: 'Kas Kepanitiaan & Pembangunan', saldoBerjalan: BigInt(1000000) },
  ];

  for (const pos of posList) {
    await prisma.posKeuangan.upsert({
      where: { rtId_kodePosKas: { rtId, kodePosKas: pos.kodePosKas } },
      update: {},
      create: { ...pos, rtId },
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
      where: { rtId_kodeSurat: { rtId, kodeSurat: t.kodeSurat } },
      update: {},
      create: { ...t, rtId },
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
      where: { rtId_kodeBlok: { rtId, kodeBlok: r.kodeBlok } },
      update: {},
      create: { ...r, rtId },
    });
    rumahMap.set(r.kodeBlok, res.id);
  }
  console.log('5 Rumah Kavling seeded.');

  // 5. Initial Warga & Kartu Keluarga (Envelope Encryption + Blind Indexing)
  //
  // Two upsert helpers keep `rtId` from being repeated 16 times and make it
  // structurally impossible to add a resident without a tenant binding.
  const seedKk = async (noKk: string, kodeBlok: string) => {
    const noKkBlindIndex = blindIndexAdapter.computeBlindIndex(noKk);
    return prisma.kartuKeluarga.upsert({
      // Kartu Keluarga identity is unique PER TENANT.
      where: { rtId_noKkBlindIndex: { rtId, noKkBlindIndex } },
      update: {},
      create: {
        rtId,
        rumahId: rumahMap.get(kodeBlok)!,
        noKkEncrypted: cryptoAdapter.encryptField(noKk),
        noKkBlindIndex,
        noKkMasked: blindIndexAdapter.maskNoKk(noKk),
        statusDomisili: 'TETAP',
        statusVerifikasi: 'VERIFIED',
      },
    });
  };

  const seedWarga = async (
    kkId: string,
    nik: string,
    profile: {
      namaLengkap: string;
      tempatLahir: string;
      tanggalLahir: string;
      gender: string;
      golonganDarah: string;
      agama: string;
      pendidikanTerakhir: string;
      pekerjaan: string;
      statusPerkawinan: string;
      hubunganKeluarga: string;
      isLansia?: boolean;
    }
  ) => {
    const nikBlindIndex = blindIndexAdapter.computeBlindIndex(nik);
    return prisma.warga.upsert({
      // NIK identity is unique PER TENANT (a citizen may hold records in two RTs).
      where: { rtId_nikBlindIndex: { rtId, nikBlindIndex } },
      update: {},
      create: {
        rtId,
        kkId,
        nikEncrypted: cryptoAdapter.encryptField(nik),
        nikBlindIndex,
        nikMasked: blindIndexAdapter.maskNik(nik),
        ...profile,
        statusKependudukan: 'TETAP',
        isLansia: profile.isLansia ?? false,
      },
    });
  };

  // Warga 1: Ketua RT (Pak Bambang)
  const kkKetua = await seedKk('3276010101900001', 'A1');
  const wargaKetua = await seedWarga(kkKetua.id, '3276011508750001', {
    namaLengkap: 'Bambang Pamungkas, S.T.',
    tempatLahir: 'Semarang',
    tanggalLahir: '1975-08-15',
    gender: 'LAKI_LAKI',
    golonganDarah: 'O_POSITIF',
    agama: 'ISLAM',
    pendidikanTerakhir: 'S1 Teknik',
    pekerjaan: 'Wiraswasta',
    statusPerkawinan: 'KAWIN',
    hubunganKeluarga: 'KEPALA_KELUARGA',
  });

  // Warga 2: Sekretaris (Pak Agus)
  const kkSekretaris = await seedKk('3276010101900002', 'A2');
  const wargaSekretaris = await seedWarga(kkSekretaris.id, '3276012003820002', {
    namaLengkap: 'Agus Setiawan, S.Kom.',
    tempatLahir: 'Jakarta',
    tanggalLahir: '1982-03-20',
    gender: 'LAKI_LAKI',
    golonganDarah: 'A_POSITIF',
    agama: 'ISLAM',
    pendidikanTerakhir: 'S1 Sistem Informasi',
    pekerjaan: 'Software Engineer',
    statusPerkawinan: 'KAWIN',
    hubunganKeluarga: 'KEPALA_KELUARGA',
  });

  // Warga 3: Bendahara (Bu Dewi)
  const kkBendahara = await seedKk('3276010101900003', 'B1');
  const wargaBendahara = await seedWarga(kkBendahara.id, '3276011005850003', {
    namaLengkap: 'Dewi Lestari, S.E.',
    tempatLahir: 'Bandung',
    tanggalLahir: '1985-05-10',
    gender: 'PEREMPUAN',
    golonganDarah: 'B_POSITIF',
    agama: 'ISLAM',
    pendidikanTerakhir: 'S1 Akuntansi',
    pekerjaan: 'Akuntan Publik',
    statusPerkawinan: 'KAWIN',
    hubunganKeluarga: 'KEPALA_KELUARGA',
  });

  // Warga 4: Warga Biasa (Lansia — flagged vulnerable for the care dashboard)
  const kkLansia = await seedKk('3276010101900004', 'A3');
  const wargaLansia = await seedWarga(kkLansia.id, '3276010101540004', {
    namaLengkap: 'Mbah Joyo Sudarsono',
    tempatLahir: 'Yogyakarta',
    tanggalLahir: '1954-01-01',
    gender: 'LAKI_LAKI',
    golonganDarah: 'AB_POSITIF',
    agama: 'ISLAM',
    pendidikanTerakhir: 'SMP',
    pekerjaan: 'Pensiunan',
    statusPerkawinan: 'CERAI_MATI',
    hubunganKeluarga: 'KEPALA_KELUARGA',
    isLansia: true,
  });

  // 6. User Accounts with Argon2id Password Hashing
  const defaultAccounts = [
    {
      wargaId: wargaKetua.id,
      username: 'superuser',
      password: 'SuperUser@2026!',
      role: 'SUPERUSER',
    },
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
      // Username is unique PER TENANT — the same login name may exist in two RTs.
      where: { rtId_username: { rtId, username: acc.username } },
      update: { role: acc.role },
      create: {
        rtId,
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
            rtId,
            userId: user.id,
            codeHash,
          },
        });
      }
    }
  }
  console.log('User accounts created: ketua_rt, sekretaris_rt, bendahara_rt, warga_test.');

  // 7. Genesis Record for the tenant's Security Audit chain
  const auditCount = await prisma.securityAuditLog.count({ where: { rtId } });
  if (auditCount === 0) {
    const genesisTime = new Date().toISOString();
    const genesisRowHash = hashChainService.computeRowHash(
      HashChainService.GENESIS_HASH,
      'GENESIS-AUDIT',
      'SYSTEM',
      // Must match AuditLogService.hashPayload(): `ACTION:targetId:accessReason`
      'SYSTEM_INITIALIZATION:SYSTEM:Initial setup of SIM-RT cryptographic ledger',
      genesisTime
    );

    await prisma.securityAuditLog.create({
      data: {
        id: 'GENESIS-AUDIT',
        rtId,
        sequence: 1,
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
        // Must equal the instant fed into computeRowHash above, or the chain
        // fails verification on the very first row.
        createdAt: new Date(genesisTime),
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
