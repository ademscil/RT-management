import { z } from 'zod';
import { PaginationQuerySchema } from './pagination.js';

export enum TipeTransaksiKas {
  IN = 'IN',
  OUT = 'OUT',
}

export enum StatusTagihanIuran {
  UNPAID = 'UNPAID',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

export const GenerateTagihanBulananSchema = z.object({
  bulan: z.coerce.number().int().min(1).max(12),
  tahun: z.coerce.number().int().min(2020).max(2050),
  nominalDefault: z.coerce.number().positive(),
});
export type GenerateTagihanBulananInput = z.infer<typeof GenerateTagihanBulananSchema>;

export const UploadBuktiIuranSchema = z.object({
  tagihanId: z.string().uuid(),
  catatanWarga: z.string().trim().max(255).optional(),
});
export type UploadBuktiIuranInput = z.infer<typeof UploadBuktiIuranSchema>;

export const VerifikasiIuranSchema = z.object({
  tagihanId: z.string().uuid(),
  isApproved: z.boolean(),
  alasanPenolakan: z.string().trim().max(255).optional(),
});
export type VerifikasiIuranInput = z.infer<typeof VerifikasiIuranSchema>;

export const CatatKasKeluarSchema = z.object({
  posKeuanganId: z.string().uuid(),
  nominal: z.coerce.number().positive(),
  deskripsi: z.string().trim().min(5).max(500),
});
export type CatatKasKeluarInput = z.infer<typeof CatatKasKeluarSchema>;

export interface HashChainVerificationResult {
  isChainValid: boolean;
  totalRecordsChecked: number;
  firstHash: string;
  lastHash: string;
  tamperedRecordId?: string;
  tamperedAtIndex?: number;
  verifiedAt: string;
}

export const TagihanQueryFilterSchema = PaginationQuerySchema.extend({
  status: z.nativeEnum(StatusTagihanIuran).optional(),
  rumahId: z.string().uuid().optional(),
  kkId: z.string().uuid().optional(),
  bulan: z.coerce.number().int().min(1).max(12).optional(),
  tahun: z.coerce.number().int().min(2020).max(2050).optional(),
});
export type TagihanQueryFilter = z.infer<typeof TagihanQueryFilterSchema>;

export const KasLedgerQueryFilterSchema = PaginationQuerySchema.extend({
  posKeuanganId: z.string().uuid().optional(),
  tipe: z.nativeEnum(TipeTransaksiKas).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type KasLedgerQueryFilter = z.infer<typeof KasLedgerQueryFilterSchema>;

