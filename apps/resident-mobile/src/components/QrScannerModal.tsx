import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Keyboard, AlertCircle } from 'lucide-react';
import { Button, notify } from '@simrt/ui-kit';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen || manualInputMode) return;

    let isMounted = true;
    const scannerId = 'qr-reader-viewport';

    const startScanner = async () => {
      try {
        setCameraError(null);
        const qrScanner = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              qrScanner.stop().catch(() => {});
              onScanSuccess(decodedText);
            }
          },
          () => {
            // Frame parse error - ignore standard scanning misses
          }
        );
      } catch (err: any) {
        if (isMounted) {
          setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan atau masukkan token secara manual.');
        }
      }
    };

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(startScanner, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen, manualInputMode, onScanSuccess]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualToken.trim();
    if (!cleaned) {
      notify.error({ title: 'Token Kosong', description: 'Silakan masukkan 24 karakter token aktivasi Anda.' });
      return;
    }
    onScanSuccess(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pindai Kartu Aktivasi QR</h3>
            <p className="text-[11px] text-slate-500">Arahkan kamera ke QR pada kartu cetak RT</p>
          </div>
          <button
            onClick={() => {
              if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(() => {});
              }
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scanner Viewport or Manual Input */}
        <div className="p-4 space-y-4">
          {!manualInputMode ? (
            <div>
              <div
                id="qr-reader-viewport"
                className="w-full h-64 bg-black rounded-2xl overflow-hidden relative border-2 border-teal-500/50"
              />
              {cameraError && (
                <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                      html5QrCodeRef.current.stop().catch(() => {});
                    }
                    setManualInputMode(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                >
                  <Keyboard className="w-3.5 h-3.5" /> Masukkan Token Manual (24 Karakter)
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="manual-token-activation-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Token Aktivasi Kartu RT:
                </label>
                <input
                  id="manual-token-activation-input"
                  name="manualToken"
                  type="text"
                  autoComplete="one-time-code"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Contoh: a1b2c3d4e5f6..."
                  className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none uppercase"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={() => setManualInputMode(false)}
                >
                  <Camera className="w-4 h-4" /> Buka Kamera
                </Button>
                <Button variant="primary" size="md" className="flex-1" type="submit">
                  Lanjutkan
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
