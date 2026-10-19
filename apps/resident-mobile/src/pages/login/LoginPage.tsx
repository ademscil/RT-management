import React, { useState } from 'react';
import { User, Lock, KeyRound, ArrowRight, QrCode, FileText, Wallet, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { Button, notify } from '@simrt/ui-kit';
import { AppLogo } from '../../components/AppLogo.js';

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
          description: 'Berhasil masuk ke Portal Warga SIM-RT.',
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
    setPassword('WargaTest@2026!');
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-12">
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Desktop Brand Showcase (Visible on lg screens) */}
        <div className="lg:col-span-7 space-y-6 hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-500/30 text-teal-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Portal Layanan Resmi Warga RT 05 / RW 02
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AppLogo size="lg" />
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">SIM-RT WARGA ONLINE</h1>
                <p className="text-xs text-teal-400 font-medium">Kel. Sukamaju, Kec. Cilodong, Kota Depok</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Sistem administrasi mandiri rukun tetangga berbasis enkripsi modern. Akses surat pengantar 24 jam, transparansi kas & iuran, serta pantau jadwal ronda langsung dari peramban web Anda.
            </p>
          </div>

          {/* Key Feature Cards */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center border border-teal-800/40">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white">E-Surat Mandiri</h3>
              <p className="text-[11px] text-slate-400 leading-normal">Pengajuan surat pengantar ber-QR Code resmi 24 jam.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center border border-emerald-800/40">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white">Kas Transparan</h3>
              <p className="text-[11px] text-slate-400 leading-normal">Pantau saldo kas lingkungan dan tagihan iuran bulanan.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center border border-amber-800/40">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white">Privasi Aman</h3>
              <p className="text-[11px] text-slate-400 leading-normal">Data NIK & KK terenkripsi standar UU PDP tanpa nomor HP.</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" /> Kompatibel di Ponsel, Tablet, dan Komputer Desktop
            </span>
            <span className="text-teal-400 font-semibold text-[11px]">Tampilan Responsif</span>
          </div>
        </div>

        {/* Right Login Card (Mobile centered, Desktop 5 columns) */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto space-y-5">
          {/* Mobile-only Header */}
          <div className="lg:hidden text-center space-y-2 mb-2">
            <div className="flex justify-center mb-1">
              <AppLogo size="xl" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">SIM-RT WARGA</h1>
            <p className="text-xs text-teal-400 font-medium">RT 05 / RW 02 Kel. Sukamaju, Cilodong</p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-900/90 rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">
                {isRecoveryMode ? 'Pemulihan Akun Offline' : 'Masuk ke Portal Warga'}
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
                className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-teal-400 font-medium transition-colors text-center block"
              >
                Isi Otomatis Akun Uji: <strong className="text-white">warga_test</strong> (WargaTest@2026!)
              </button>
            </div>
          </div>

          {/* Activation Callout */}
          <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-800/40 text-center space-y-2">
            <p className="text-xs text-slate-300">Belum mengaktifkan akun keluarga Anda?</p>
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
    </div>
  );
};
