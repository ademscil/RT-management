import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button.js';

export interface DestructiveActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmationKeyword?: string; // Default: 'KONFIRMASI'
  confirmButtonLabel?: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export const DestructiveActionDialog: React.FC<DestructiveActionDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmationKeyword = 'KONFIRMASI',
  confirmButtonLabel = 'Ya, Lanjutkan Aksi',
  onConfirm,
  isLoading = false,
}) => {
  const [typedInput, setTypedInput] = useState('');

  if (!isOpen) return null;

  const isMatched = typedInput.trim().toUpperCase() === confirmationKeyword.toUpperCase();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched) return;
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-950 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-red-600 font-semibold">Tindakan Destruktif & Permanen</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>

        <form onSubmit={handleConfirm} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Ketik kata <strong className="font-mono text-red-600">{confirmationKeyword}</strong> untuk menyetujui:
            </label>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={`Ketik "${confirmationKeyword}"`}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-600 outline-none uppercase"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="md"
              disabled={!isMatched || isLoading}
              isLoading={isLoading}
            >
              {confirmButtonLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
