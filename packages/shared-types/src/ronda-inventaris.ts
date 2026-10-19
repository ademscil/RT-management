import { z } from 'zod';
import { PaginationQuerySchema } from './pagination.js';

export enum StatusAduan {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum StatusPeminjaman {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
}

export const BuatJadwalRondaSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.string().trim().default('Malam (22:00 - 04:00)'),
  pesertaWargaIds: z.array(z.string().uuid()).min(1, 'Minimal 1 petugas ronda'),
  keterangan: z.string().trim().max(255).optional(),
});
export type BuatJadwalRondaInput = z.infer<typeof BuatJadwalRondaSchema>;

export const TambahInventarisSchema = z.object({
  namaBarang: z.string().trim().min(3).max(100),
  kodeBarang: z.string().trim().min(2).max(50),
  kategori: z.string().trim().max(50).default('Umum'),
  jumlahTotal: z.coerce.number().int().positive(),
  kondisiBaik: z.coerce.number().int().nonnegative(),
  lokasiPenyimpanan: z.string().trim().max(100).default('Pos RT'),
});
export type TambahInventarisInput = z.infer<typeof TambahInventarisSchema>;

export const PinjamInventarisSchema = z.object({
  inventarisId: z.string().uuid(),
  jumlah: z.coerce.number().int().positive(),
  tanggalPinjam: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tanggalRencanaKembali: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  keperluan: z.string().trim().min(5).max(255),
});
export type PinjamInventarisInput = z.infer<typeof PinjamInventarisSchema>;

export const BuatTiketAduanSchema = z.object({
  kategori: z.string().trim().min(3).max(50),
  judul: z.string().trim().min(5).max(100),
  deskripsi: z.string().trim().min(10).max(1000),
});
export type BuatTiketAduanInput = z.infer<typeof BuatTiketAduanSchema>;

export const TiketAduanQueryFilterSchema = PaginationQuerySchema.extend({
  status: z.nativeEnum(StatusAduan).optional(),
  kategori: z.string().optional(),
});
export type TiketAduanQueryFilter = z.infer<typeof TiketAduanQueryFilterSchema>;

