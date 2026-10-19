import React, { useState } from 'react';
import { User, Lock, KeyRound, ArrowRight, QrCode } from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { Button, notify } from '@simrt/ui-kit';

interface LoginPageProps {
  onGoToActivation: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onGoToActivation }) => {
  const { login, loginWithRecovery } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      notify.error({ title: 'Username Wajib Diisi', description: 'Silakan masukkan username akun warga Anda.' });
      return;
    }

    setIsLoading(true);
    try {
      if (isRecoveryMode) {
        if (!recoveryCode.trim()) {
          notify.error({ title: 'Kode Pemulihan Kosong', description: 'Masukkan 8 digit kode pemulihan offline Anda.' });
          return;
        }
        await loginWithRecovery(username.trim(), recoveryCode.trim());
        notify.success({
          title: 'Login Pemulihan Berhasil',
          description: 'Satu kode pemulihan telah terpakai dan dinonaktifkan.',
        });
      } else {
        if (!password) {
          notify.error({ title: 'Password Wajib Diisi', description: 'Silakan masukkan password akun Anda.' });
          return;
        }
        await login(username.trim(), password);
        notify.success({
          title: 'Selamat Datang',
          description: 'Berhasil masuk ke Super-App Warga SIM-RT.',
        });
      }
    } catch (err: any) {
      notify.error({
        title: 'Gagal Masuk',
        description: err.message || 'Kredensial tidak sesuai. Periksa kembali username dan password.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setUsername('warga_test');
    setPassword('WargaRT@2026!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto">
      {/* Brand Header */}
      <div className="pt-10 space-y-2 text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-teal-600 items-center justify-center font-black text-2xl text-white shadow-xl shadow-teal-900/50 mb-1">
          RT
        </div>
        <h1 className="text-xl font-black text-white tracking-tight">SIM-RT WARGA</h1>
        <p className="text-xs text-teal-400 font-mono">RT 05 / RW 02 Kel. Sukamaju, Cilodong</p>
      </div>

      {/* Login Card */}
      <div className="my-auto py-6">
        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">
              {isRecoveryMode ? 'Pemulihan Akun Offline' : 'Masuk ke Aplikasi Warga'}
            </h2>
            <p className="text-xs text-slate-400">
              {isRecoveryMode
                ? 'Gunakan 1 dari 8 kode pemulihan yang Anda simpan saat aktivasi'
                : 'Akses layanan administrasi mandiri, iuran, dan keamanan RT'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="warga-login-username" className="text-xs font-semibold text-slate-300">Username Warga:</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="warga-login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: warga_test"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            {!isRecoveryMode ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="warga-login-password" className="text-xs font-semibold text-slate-300">Password:</label>
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(true)}
                    className="text-[11px] text-teal-400 hover:underline font-medium"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="warga-login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="warga-recovery-code" className="text-xs font-semibold text-slate-300">8-Digit Kode Pemulihan:</label>
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(false)}
                    className="text-[11px] text-slate-400 hover:underline font-medium"
                  >
                    Batal (Pakai Password)
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="warga-recovery-code"
                    name="recoveryCode"
                    type="text"
                    autoComplete="one-time-code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="Contoh: 4F92A1B8"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-mono uppercase tracking-widest text-teal-300 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-bold"
              isLoading={isLoading}
            >
              Masuk Sekarang <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Autofill */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDemoFill}
              className="w-full py-1.5 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-teal-400 font-medium transition-colors"
            >
              Isi Otomatis Akun Uji: <strong>warga_test</strong>
            </button>
          </div>
        </div>
      </div>

      {/* Activation Callout */}
      <div className="pb-6 space-y-3 text-center">
        <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-800/40">
          <p className="text-xs text-slate-300 mb-2">Belum mengaktifkan akun keluarga Anda?</p>
          <Button
            variant="outline"
            size="md"
            className="w-full border-teal-500/40 text-teal-300 hover:bg-teal-900/30 font-semibold"
            onClick={onGoToActivation}
          >
            <QrCode className="w-4 h-4" /> Pindai Kartu Aktivasi QR RT
          </Button>
        </div>
      </div>
    </div>
  );
};
