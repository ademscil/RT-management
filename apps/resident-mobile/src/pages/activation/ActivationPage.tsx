import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { QrCode, Lock, CheckCircle2, Copy, ShieldAlert, ArrowRight, KeyRound } from 'lucide-react';
import { mobileApi } from '../../services/api.js';
import { useAuth } from '../../context/auth-context.js';
import { Button, notify } from '@simrt/ui-kit';
import { QrScannerModal } from '../../components/QrScannerModal.js';

interface ActivationPageProps {
  onBackToLogin: () => void;
}

export const ActivationPage: React.FC<ActivationPageProps> = ({ onBackToLogin }) => {
  const { setAuthSession } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [houseInfo, setHouseInfo] = useState<{ blokRumah: string; nomorKkMasked: string } | null>(null);

  // Password Setup State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Recovery Codes Generated
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [hasConfirmedSave, setHasConfirmedSave] = useState(false);
  const [activeSession, setActiveSession] = useState<{ token: string; user: any } | null>(null);

  const handleScanSuccess = async (rawScanned: string) => {
    setIsScannerOpen(false);
    // If QR contains a URL or JSON, extract the 24-character token
    let token = rawScanned;
    if (rawScanned.includes('token=')) {
      const match = rawScanned.match(/token=([a-f0-9]{24})/i);
      if (match) token = match[1];
    } else if (rawScanned.length > 24) {
      const match = rawScanned.match(/([a-f0-9]{24})/i);
      if (match) token = match[1];
    }

    setTokenInput(token);
    await verifyToken(token);
  };

  const verifyToken = async (token: string) => {
    setIsLoading(true);
    try {
      const res = await mobileApi.post<{
        blokRumah: string;
        nomorKkMasked: string;
      }>('/onboarding/verify-invite', { token });

      setHouseInfo(res);
      setStep(2);
      notify.success({
        title: 'Kartu QR Terverifikasi',
        description: `Blok rumah: ${res.blokRumah}. Silakan buat password baru Anda.`,
      });
    } catch (err: any) {
      notify.error({
        title: 'Verifikasi Kartu Gagal',
        description: err.message || 'Token tidak valid atau sudah pernah digunakan sebelumnya.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      notify.error({ title: 'Password Terlalu Pendek', description: 'Minimal 8 karakter.' });
      return;
    }
    if (password !== confirmPassword) {
      notify.error({ title: 'Password Tidak Cocok', description: 'Konfirmasi password harus sama persis.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await mobileApi.post<{
        accessToken: string;
        user: any;
        recoveryCodes: string[];
      }>('/onboarding/claim-invite', {
        token: tokenInput,
        password,
      });

      setRecoveryCodes(res.recoveryCodes);
      setActiveSession({ token: res.accessToken, user: res.user });
      setStep(3);

      // Celebratory Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      notify.success({
        title: 'Akun Warga Aktif!',
        description: 'Wajib salin & simpan 8 Kode Pemulihan Offline Anda.',
      });
    } catch (err: any) {
      notify.error({ title: 'Gagal Aktivasi Akun', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAllCodes = () => {
    const text = [
      '=== KODE PEMULIHAN OFFLINE SIM-RT 05/02 ===',
      `Blok Rumah: ${houseInfo?.blokRumah || 'RT 05/02'}`,
      `Tanggal Aktivasi: ${new Date().toLocaleDateString('id-ID')}`,
      '-------------------------------------------',
      ...recoveryCodes.map((code, i) => `${i + 1}. ${code}`),
      '-------------------------------------------',
      'SIMPAN DI TEMPAT AMAN SECARA FISIK ATAU OFFLINE.',
      'DAPAT DIGUNAKAN MASING-MASING 1 KALI UNTUK LOGIN JIKA LUPA PASSWORD.',
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    notify.success({
      title: 'Kode Disalin ke Clipboard',
      description: 'Simpan di catatan pribadi Anda yang aman.',
    });
  };

  const handleFinishAndEnterApp = () => {
    if (!hasConfirmedSave) {
      notify.error({
        title: 'Konfirmasi Wajib',
        description: 'Anda harus mencentang pernyataan bahwa kode telah disimpan.',
      });
      return;
    }

    if (activeSession) {
      setAuthSession(activeSession.token, activeSession.user);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-teal-600 items-center justify-center text-white shadow-lg shadow-teal-900/50 mb-1">
            <QrCode className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">Aktivasi Mandiri Warga RT</h1>
          <p className="text-xs text-teal-400 font-medium">RT 05 / RW 02 Kel. Sukamaju, Cilodong</p>
        </div>

        {/* Step Contents */}
        <div>
          {step === 1 && (
            <div className="bg-slate-900/90 rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl space-y-5">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white">Langkah 1: Pindai Kartu Fisik</h2>
              <p className="text-xs text-slate-400">
                Gunakan kamera HP untuk memindai kartu QR yang dibagikan Pengurus RT ke rumah Anda.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-lg shadow-teal-900/40"
              onClick={() => setIsScannerOpen(true)}
            >
              <QrCode className="w-5 h-5" /> Buka Kamera Pindai QR
            </Button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-500 font-medium">atau ketik manual</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <div className="space-y-3">
              <input
                id="warga-activation-token"
                name="activationToken"
                type="text"
                autoComplete="one-time-code"
                aria-label="Token Aktivasi Warga 24 Digit"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="24 digit token aktivasi..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-center tracking-widest text-teal-300 placeholder:text-slate-600 uppercase focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => verifyToken(tokenInput)}
                isLoading={isLoading}
                disabled={!tokenInput.trim()}
              >
                Verifikasi Token <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && houseInfo && (
          <form
            onSubmit={handleCreatePassword}
            className="bg-slate-800/90 rounded-3xl p-6 border border-slate-700/80 shadow-2xl space-y-4"
          >
            <div className="p-3 bg-teal-950/60 border border-teal-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-700/50 flex items-center justify-center text-teal-300">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-white">Alamat: {houseInfo.blokRumah}</p>
                <p className="text-slate-400 font-mono">No. KK: {houseInfo.nomorKkMasked}</p>
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white">Langkah 2: Buat Password Akun</h2>
              <p className="text-xs text-slate-400">
                Password ini digunakan untuk masuk ke Super-App Warga dan mengelola data keluarga.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="warga-new-password" className="text-xs font-semibold text-slate-300">Password Baru:</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="warga-new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="warga-confirm-password" className="text-xs font-semibold text-slate-300">Konfirmasi Password:</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="warga-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-bold"
              isLoading={isLoading}
            >
              Aktifkan Akun & Buat Kunci <KeyRound className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        {step === 3 && (
          <div className="bg-slate-800/95 rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h2 className="text-sm font-black text-white">8 Kode Pemulihan Offline</h2>
                <p className="text-[11px] text-amber-300/90 font-medium">
                  Satu-satunya cara login jika Anda lupa password!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              {recoveryCodes.map((c, i) => (
                <div
                  key={i}
                  className="p-2 bg-slate-900 rounded-lg text-center font-mono text-xs font-bold text-teal-400 border border-slate-800 select-all"
                >
                  <span className="text-slate-600 mr-1.5 text-[10px]">{i + 1}.</span>
                  {c}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="md"
              className="w-full bg-slate-900 hover:bg-slate-850"
              onClick={handleCopyAllCodes}
            >
              <Copy className="w-4 h-4" /> {copiedCodes ? 'Kode Telah Disalin!' : 'Salin Semua Kode'}
            </Button>

            <label htmlFor="activation-confirm-save-code" className="flex items-start gap-2.5 p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/60 cursor-pointer">
              <input
                id="activation-confirm-save-code"
                name="confirmSaveCode"
                type="checkbox"
                checked={hasConfirmedSave}
                onChange={(e) => setHasConfirmedSave(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-teal-600 rounded"
              />
              <span className="text-[11px] text-slate-300 font-medium leading-tight">
                Saya telah mencatat/menyimpan 8 kode pemulihan ini di tempat aman.
              </span>
            </label>

            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold"
              onClick={handleFinishAndEnterApp}
              disabled={!hasConfirmedSave}
            >
              Masuk ke Beranda Warga <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="text-center pb-4">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs text-slate-400 hover:text-teal-400 font-medium"
        >
          Sudah punya akun? <strong>Kembali ke Halaman Masuk</strong>
        </button>
      </div>
      </div>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
};
