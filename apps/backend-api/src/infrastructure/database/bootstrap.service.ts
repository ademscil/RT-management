import { hash } from '@node-rs/argon2';
import { EnvelopeCryptoAdapter } from '../crypto/envelope-crypto.adapter.js';
import { HmacBlindIndexAdapter } from '../crypto/blind-index.adapter.js';

export class BootstrapService {
  /**
   * Provisions or ensures a root SUPERUSER account exists in the database
   */
  public static async ensureSuperuser(prisma: any): Promise<{ created: boolean; username: string }> {
    if (!prisma) return { created: false, username: 'superuser' };

    const superuserUsername = 'superuser';
    const existing = await prisma.user.findUnique({
      where: { username: superuserUsername },
    });

    if (existing) {
      if (existing.role !== 'SUPERUSER') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'SUPERUSER' },
        });
      }
      return { created: false, username: superuserUsername };
    }

    // 1. Ensure ROOT house
    let rootHouse = await prisma.rumahKavling.findUnique({
      where: { kodeBlok: 'ROOT' },
    });
    if (!rootHouse) {
      rootHouse = await prisma.rumahKavling.create({
        data: {
          kodeBlok: 'ROOT',
          nomorRumah: '00',
          alamat: 'Pusat Kendali Operasional SIM-RT',
          gridX: 0,
          gridY: 0,
          statusHunian: 'DIHUNI_PEMILIK',
          hasVulnerability: false,
        },
      });
    }

    // 2. Ensure ROOT KK
    const cryptoAdapter = new EnvelopeCryptoAdapter();
    const blindIndexAdapter = new HmacBlindIndexAdapter();
    const noKk = '9999999999999999';
    const noKkBlind = blindIndexAdapter.computeBlindIndex(noKk);

    let rootKk = await prisma.kartuKeluarga.findUnique({
      where: { noKkBlindIndex: noKkBlind },
    });
    if (!rootKk) {
      rootKk = await prisma.kartuKeluarga.create({
        data: {
          rumahId: rootHouse.id,
          noKkEncrypted: cryptoAdapter.encryptField(noKk),
          noKkBlindIndex: noKkBlind,
          noKkMasked: '999999******9999',
          statusDomisili: 'TETAP',
          statusVerifikasi: 'VERIFIED',
        },
      });
    }

    // 3. Ensure ROOT Warga
    const nik = '9999999999999999';
    const nikBlind = blindIndexAdapter.computeBlindIndex(nik);

    let rootWarga = await prisma.warga.findUnique({
      where: { nikBlindIndex: nikBlind },
    });
    if (!rootWarga) {
      rootWarga = await prisma.warga.create({
        data: {
          kkId: rootKk.id,
          namaLengkap: 'Administrator Utama (Superuser)',
          nikEncrypted: cryptoAdapter.encryptField(nik),
          nikBlindIndex: nikBlind,
          nikMasked: '999999******9999',
          tempatLahir: 'Depok',
          tanggalLahir: '1990-01-01',
          gender: 'LAKI_LAKI',
          golonganDarah: 'O_POSITIF',
          agama: 'ISLAM',
          statusPernikahan: 'MENIKAH',
          pekerjaan: 'Administrator Sistem',
          statusHubungan: 'KEPALA_KELUARGA',
        },
      });
    }

    // 4. Create Superuser account
    const superuserPassword = 'SuperUser@2026!';
    const passwordHash = await hash(superuserPassword, {
      memoryCost: 65536,
      timeCost: 3,
    });

    const user = await prisma.user.create({
      data: {
        wargaId: rootWarga.id,
        username: superuserUsername,
        passwordHash,
        role: 'SUPERUSER',
        isActive: true,
      },
    });

    // Seed Recovery Codes for Superuser
    for (let i = 1; i <= 8; i++) {
      const rawCode = `SU${i}987654`.substring(0, 8);
      const codeHash = await hash(rawCode);
      await prisma.recoveryCode.create({
        data: {
          userId: user.id,
          codeHash,
        },
      });
    }

    return { created: true, username: superuserUsername };
  }

  /**
   * Purges all hardcoded demo houses, demo residents, and demo login accounts
   */
  public static async purgeDummyData(prisma: any): Promise<{ deletedDemoUsers: number; deletedDemoHouses: number }> {
    if (!prisma) return { deletedDemoUsers: 0, deletedDemoHouses: 0 };

    // 1. Delete dummy demo users
    const demoUsernames = ['ketua_rt', 'sekretaris_rt', 'bendahara_rt', 'warga_test'];
    const usersToDelete = await prisma.user.findMany({
      where: { username: { in: demoUsernames } },
      select: { id: true },
    });

    for (const u of usersToDelete) {
      await prisma.recoveryCode.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.inAppNotification.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }

    // 2. Delete dummy houses and associated KK/Warga
    const demoBlok = ['A1', 'A2', 'A3', 'B1', 'B2'];
    const housesToDelete = await prisma.rumahKavling.findMany({
      where: { kodeBlok: { in: demoBlok } },
      include: {
        kartuKeluarga: {
          include: {
            warga: true,
          },
        },
      },
    });

    for (const house of housesToDelete) {
      // Delete bills
      await prisma.tagihanIuran.deleteMany({ where: { rumahId: house.id } }).catch(() => {});
      await prisma.onboardingInvite.deleteMany({ where: { rumahId: house.id } }).catch(() => {});

      for (const kk of house.kartuKeluarga) {
        for (const w of kk.warga) {
          // Delete letters
          await prisma.permohonanSurat.deleteMany({ where: { wargaId: w.id } }).catch(() => {});
          // Delete user
          await prisma.user.deleteMany({ where: { wargaId: w.id } }).catch(() => {});
          // Delete warga
          await prisma.warga.delete({ where: { id: w.id } }).catch(() => {});
        }
        await prisma.kartuKeluarga.delete({ where: { id: kk.id } }).catch(() => {});
      }
      await prisma.rumahKavling.delete({ where: { id: house.id } }).catch(() => {});
    }

    return {
      deletedDemoUsers: usersToDelete.length,
      deletedDemoHouses: housesToDelete.length,
    };
  }
}
