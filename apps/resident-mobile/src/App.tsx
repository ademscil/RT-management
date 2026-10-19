import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/auth-context.js';
import { LoginPage } from './pages/login/LoginPage.js';
import { ActivationPage } from './pages/activation/ActivationPage.js';
import { BerandaPage } from './pages/beranda/BerandaPage.js';
import { KeluargaPage } from './pages/keluarga/KeluargaPage.js';
import { SuratPage } from './pages/surat/SuratPage.js';
import { IuranPage } from './pages/iuran/IuranPage.js';
import { NotifikasiPage } from './pages/notifikasi/NotifikasiPage.js';
import { BottomNavigation, TabType } from './components/BottomNavigation.js';
import { AppToaster, OfflineModeBanner, useSSE, notify } from '@simrt/ui-kit';
import {
  Home,
  Users,
  FileText,
  Wallet,
  Bell,
  Accessibility,
  LogOut,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading, token, user, logout, isElderMode, toggleElderMode } = useAuth();
  const [authView, setAuthView] = useState<'LOGIN' | 'ACTIVATION'>('LOGIN');
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [unreadCount, setUnreadCount] = useState<number>(2);

  // SSE Real-Time listener for resident notifications
  const apiUrl = (import.meta as any).env?.VITE_API_URL || '';
  useSSE({
    url: `${apiUrl}/api/v1/notifications/stream`,
    token: isAuthenticated ? token : null,
    onEvent: (event) => {
      setUnreadCount((prev) => prev + 1);
      notify.info({
        title: event.title || 'Notifikasi Baru SIM-RT',
        description: event.message || 'Ada informasi baru dari Pengurus RT.',
      });
    },
  });

  const desktopNavItems: Array<{ id: TabType; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'keluarga', label: 'Kartu Keluarga', icon: Users },
    { id: 'surat', label: 'Layanan Surat', icon: FileText },
    { id: 'iuran', label: 'Iuran Kas', icon: Wallet },
    { id: 'notifikasi', label: 'Pemberitahuan', icon: Bell, badge: unreadCount },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {authView === 'LOGIN' ? (
          <LoginPage onGoToActivation={() => setAuthView('ACTIVATION')} />
        ) : (
          <ActivationPage onBackToLogin={() => setAuthView('LOGIN')} />
        )}
        <AppToaster position="top-center" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      <OfflineModeBanner />

      {/* Responsive Desktop Navigation Header */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Neighborhood Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 p-0.5 shadow-md shadow-teal-900/20">
              <div className="w-full h-full bg-teal-950 rounded-[10px] flex items-center justify-center font-black text-white text-sm">
                RT
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  SIM-RT WARGA
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Portal Warga Digital
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-teal-600" /> RT 05 / RW 02 Sukamaju, Cilodong, Depok
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="flex items-center gap-1" aria-label="Navigasi Utama Warga">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id === 'notifikasi') {
                      setUnreadCount(0);
                    }
                  }}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-[18px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleElderMode}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isElderMode
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
              title="Mode Tulisan Besar untuk Orang Tua"
              aria-label="Mode Tulisan Besar untuk Orang Tua"
            >
              <Accessibility className="w-4 h-4" />
              <span>{isElderMode ? 'Lansia Aktif' : 'Mode Lansia (A+)'}</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-black flex items-center justify-center text-xs shadow-xs">
                {user?.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="text-left">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block leading-tight">
                  {user?.namaLengkap || user?.username}
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold block leading-none">
                  {user?.blokRumah || 'Warga RT 05'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Keluar dari Akun Warga"
              aria-label="Keluar dari Akun Warga"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Screen Area - Responsive Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {activeTab === 'beranda' && <BerandaPage onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'keluarga' && <KeluargaPage />}
        {activeTab === 'surat' && <SuratPage />}
        {activeTab === 'iuran' && <IuranPage />}
        {activeTab === 'notifikasi' && <NotifikasiPage />}
      </main>

      {/* Desktop Civic Footer */}
      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800 py-4 bg-white/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p>© 2026 Rukun Tetangga 05 / RW 02 Kelurahan Sukamaju, Kecamatan Cilodong, Kota Depok</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Terenkripsi AES-256-GCM
            </span>
          </div>
        </div>
      </footer>

      {/* Ergonomic Bottom Navigation Bar (Mobile-only) */}
      <BottomNavigation
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'notifikasi') {
            setUnreadCount(0);
          }
        }}
        unreadCount={unreadCount}
      />

      <AppToaster position="top-center" />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};
