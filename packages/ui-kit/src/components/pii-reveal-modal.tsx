import React, { useState } from 'react';
import { ShieldAlert, Eye, Lock } from 'lucide-react';
import { Button } from './button.js';
import { PiiAccessReason, PiiAccessReasonSchema } from '@simrt/shared-types';

export interface PiiRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  wargaNama: string;
  field: 'NIK' | 'NO_KK' | 'FOTO_KTP' | 'FOTO_KK';
  onConfirm: (reason: PiiAccessReason) => Promise<void>;
  isLoading?: boolean;
}

export const PiiRevealModal: React.FC<PiiRevealModalProps> = ({
  isOpen,
  onClose,
  wargaNama,
  field,
  onConfirm,
  isLoading = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<PiiAccessReason>('VERIFIKASI_SURAT');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(selectedReason);
  };

  const reasonLabels: Record<PiiAccessReason, string> = {
    VERIFIKASI_SURAT: 'Verifikasi Permohonan Surat Pengantar',
    PEMUTAKHIRAN_DATA_KK: 'Pemutakhiran Data Warga / Kartu Keluarga',
    PENANGANAN_DARURAT: 'Penanganan Tanggap Darurat / Bantuan Warga',
    AUDIT_KEAMANAN: 'Pemeriksaan Integritas & Audit Keamanan',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-violet-700 dark:text-violet-300">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Konfirmasi Buka Akses PII</h3>
            <p className="text-xs text-slate-500">Data Sensitif Terenkripsi AES-256-GCM</p>
          </div>
        </div>

        <div className="p-3.5 bg-violet-50 dark:bg-violet-950/40 rounded-xl border border-violet-200 dark:border-violet-900 text-xs text-violet-900 dark:text-violet-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Akses Diawasi & Dicatat Kriptografis
          </p>
          <p>
            Membuka <strong>{field}</strong> milik <strong>{wargaNama}</strong> akan tercatat secara permanen di{' '}
            <em>Immutable Security Audit Log</em>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Pilih Alasan Pembukaan Akses:
            </label>
            <div className="space-y-2">
              {PiiAccessReasonSchema.options.map((reason) => (
                <label
                  key={reason}
                  htmlFor={`pii-access-reason-${reason}`}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/30 text-violet-900 dark:text-violet-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <input
                    id={`pii-access-reason-${reason}`}
                    type="radio"
                    name="accessReason"
                    aria-label={reasonLabels[reason]}
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-violet-700"
                  />
                  <span>{reasonLabels[reason]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" variant="pii" size="md" isLoading={isLoading}>
              <Eye className="w-4 h-4" /> Buka Data Asli
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
