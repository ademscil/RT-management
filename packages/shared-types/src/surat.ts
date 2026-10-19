import { z } from 'zod';
import { PaginationQuerySchema } from './pagination.js';

export enum StatusPengajuanSurat {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  VERIFIED_SEKRETARIS = 'VERIFIED_SEKRETARIS',
  SIGNED_KETUA_RT = 'SIGNED_KETUA_RT',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export const AjukanSuratSchema = z.object({
  jenisSuratId: z.string().uuid(),
  keperluan: z.string().trim().min(5, 'Keperluan surat minimal 5 karakter').max(500),
  keteranganTambahan: z.string().trim().max(1000).optional(),
});
export type AjukanSuratInput = z.infer<typeof AjukanSuratSchema>;

export const VerifikasiSekretarisSchema = z.object({
  suratId: z.string().uuid(),
  isApproved: z.boolean(),
  catatan: z.string().trim().max(500).optional(),
});
export type VerifikasiSekretarisInput = z.infer<typeof VerifikasiSekretarisSchema>;

export const TandaTanganKetuaRTSchema = z.object({
  suratId: z.string().uuid(),
  nomorSuratResmi: z.string().trim().min(3).max(100),
  catatan: z.string().trim().max(500).optional(),
});
export type TandaTanganKetuaRTInput = z.infer<typeof TandaTanganKetuaRTSchema>;

export const SuratQueryFilterSchema = PaginationQuerySchema.extend({
  status: z.nativeEnum(StatusPengajuanSurat).optional(),
  pemohonWargaId: z.string().uuid().optional(),
  jenisSuratId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type SuratQueryFilter = z.infer<typeof SuratQueryFilterSchema>;

