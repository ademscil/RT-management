import React, { useState } from 'react';
import { Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/auth-context.js';
import { Button, notify } from '@simrt/ui-kit';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      notify.error({ title: 'Validasi Gagal', description: 'Username dan password wajib diisi.' });
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      notify.success({
        title: 'Login Berhasil',
        description: 'Selamat datang di SIM-RT Command Center.',
      });
    } catch (err: any) {
      notify.error({
        title: 'Gagal Masuk',
        description: err.message,
        errorCode: err.code,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-teal-600 items-center justify-center font-black text-2xl text-white shadow-xl shadow-teal-900/40">
            RT
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">SIM-RT COMMAND CENTER</h1>
          <p className="text-xs text-teal-400 font-mono">RT 05 / RW 02 Kel. Sukamaju, Cilodong, Depok</p>
        </div>

        {/* Login Card */}
        <div className="p-7 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-100">Portal Masuk Pengurus RT</h2>
            <p className="text-xs text-slate-400">Sistem informasi rukun tetangga terenkripsi & terlindungi</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-login-username" className="text-xs font-semibold text-slate-300">
                Username:
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="admin-login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-login-password" className="text-xs font-semibold text-slate-300">
                Password:
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 outline-none transition-all font-medium"
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
              Masuk ke Command Center <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Akun Uji Pengurus RT:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('ketua_rt', 'KetuaRT@2026!')}
                className="p-1.5 text-center bg-slate-800/60 hover:bg-slate-800 rounded-lg text-[11px] font-medium text-teal-400 border border-slate-700/60 transition-colors"
              >
                Ketua RT
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('sekretaris_rt', 'Sekretaris@2026!')}
                className="p-1.5 text-center bg-slate-800/60 hover:bg-slate-800 rounded-lg text-[11px] font-medium text-teal-400 border border-slate-700/60 transition-colors"
              >
                Sekretaris
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('bendahara_rt', 'Bendahara@2026!')}
                className="p-1.5 text-center bg-slate-800/60 hover:bg-slate-800 rounded-lg text-[11px] font-medium text-teal-400 border border-slate-700/60 transition-colors"
              >
                Bendahara
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
