import { z } from 'zod';
import { PaginationQuerySchema } from './pagination.js';

export enum Gender {
  LAKI_LAKI = 'LAKI_LAKI',
  PEREMPUAN = 'PEREMPUAN',
}

export enum GolonganDarah {
  A_POSITIF = 'A_POSITIF',
  A_NEGATIF = 'A_NEGATIF',
  B_POSITIF = 'B_POSITIF',
  B_NEGATIF = 'B_NEGATIF',
  AB_POSITIF = 'AB_POSITIF',
  AB_NEGATIF = 'AB_NEGATIF',
  O_POSITIF = 'O_POSITIF',
  O_NEGATIF = 'O_NEGATIF',
  TIDAK_TAHU = 'TIDAK_TAHU',
}

export enum Agama {
  ISLAM = 'ISLAM',
  KRISTEN = 'KRISTEN',
  KATOLIK = 'KATOLIK',
  HINDU = 'HINDU',
  BUDDHA = 'BUDDHA',
  KHONGHUCU = 'KHONGHUCU',
  PENGHAYAT = 'PENGHAYAT',
}

export enum StatusPerkawinan {
  BELUM_KAWIN = 'BELUM_KAWIN',
  KAWIN = 'KAWIN',
  CERAI_HIDUP = 'CERAI_HIDUP',
  CERAI_MATI = 'CERAI_MATI',
}

export enum HubunganKeluarga {
  KEPALA_KELUARGA = 'KEPALA_KELUARGA',
  ISTRI = 'ISTRI',
  ANAK = 'ANAK',
  MENANTU = 'MENANTU',
  CUCU = 'CUCU',
  ORANG_TUA = 'ORANG_TUA',
  MERTUA = 'MERTUA',
  FAMILI_LAIN = 'FAMILI_LAIN',
  LAINNYA = 'LAINNYA',
}

export enum StatusKependudukan {
  TETAP = 'TETAP',
  KONTRAK = 'KONTRAK',
  KOS = 'KOS',
}

export enum StatusVerifikasiBerkas {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REJECTED = 'REJECTED',
}

export enum JenisMutasi {
  PINDAH_MASUK = 'PINDAH_MASUK',
  PINDAH_KELUAR = 'PINDAH_KELUAR',
  KELAHIRAN = 'KELAHIRAN',
  KEMATIAN = 'KEMATIAN',
}

export enum StatusHunianRumah {
  DIHUNI_PEMILIK = 'DIHUNI_PEMILIK',
  DIHUNI_PENYEWA = 'DIHUNI_PENYEWA',
  KOSONG = 'KOSONG',
}

// Schemas
export const WargaCreateSchema = z.object({
  namaLengkap: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  nik: z.string().trim().regex(/^\d{16}$/, 'NIK harus 16 digit angka'),
  tempatLahir: z.string().trim().min(2).max(100),
  tanggalLahir: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  gender: z.nativeEnum(Gender),
  golonganDarah: z.nativeEnum(GolonganDarah).default(GolonganDarah.TIDAK_TAHU),
  agama: z.nativeEnum(Agama),
  pendidikanTerakhir: z.string().trim().max(50).default('SMA/Sederajat'),
  pekerjaan: z.string().trim().max(100).default('Karyawan Swasta'),
  statusPerkawinan: z.nativeEnum(StatusPerkawinan),
  hubunganKeluarga: z.nativeEnum(HubunganKeluarga),
  statusKependudukan: z.nativeEnum(StatusKependudukan).default(StatusKependudukan.TETAP),
  isLansia: z.boolean().default(false),
  isDisabilitas: z.boolean().default(false),
  isBalita: z.boolean().default(false),
  isIbuHamil: z.boolean().default(false),
});
export type WargaCreateInput = z.infer<typeof WargaCreateSchema>;

export const KartuKeluargaCreateSchema = z.object({
  nomorKk: z.string().trim().regex(/^\d{16}$/, 'Nomor KK harus 16 digit angka'),
  rumahId: z.string().uuid(),
  alamatDomisili: z.string().trim().min(5).max(255),
  anggotaKeluarga: z.array(WargaCreateSchema).min(1, 'KK minimal memiliki 1 anggota keluarga'),
});
export type KartuKeluargaCreateInput = z.infer<typeof KartuKeluargaCreateSchema>;

export const WargaQueryFilterSchema = PaginationQuerySchema.extend({
  kkId: z.string().uuid().optional(),
  rumahId: z.string().uuid().optional(),
  gender: z.nativeEnum(Gender).optional(),
  golonganDarah: z.nativeEnum(GolonganDarah).optional(),
  isLansia: z.coerce.boolean().optional(),
  isDisabilitas: z.coerce.boolean().optional(),
  isBalita: z.coerce.boolean().optional(),
  isIbuHamil: z.coerce.boolean().optional(),
  statusKependudukan: z.nativeEnum(StatusKependudukan).optional(),
});
export type WargaQueryFilter = z.infer<typeof WargaQueryFilterSchema>;

export const RumahKavlingQueryFilterSchema = PaginationQuerySchema.extend({
  statusHunian: z.nativeEnum(StatusHunianRumah).optional(),
  hasVulnerability: z.coerce.boolean().optional(),
});
export type RumahKavlingQueryFilter = z.infer<typeof RumahKavlingQueryFilterSchema>;

