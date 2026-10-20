import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/auth-context.js';
import { BottomNavigation, TabType } from './components/BottomNavigation.js';
import { AppLogo } from './components/AppLogo.js';
import { AppToaster, OfflineModeBanner, useSSE } from '@simrt/ui-kit';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import {
  Home,
  Users,
  FileText,
  Wallet,
  Bell,
  LogOut,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

// Lazy load tabs to ensure sub-second startup on mobile Android
const LoginPage = lazy(() => import('./pages/login/LoginPage.js').then((m) => ({ default: m.LoginPage })));
const ActivationPage = lazy(() => import('./pages/activation/ActivationPage.js').then((m) => ({ default: m.ActivationPage })));
const BerandaPage = lazy(() => import('./pages/beranda/BerandaPage.js').then((m) => ({ default: m.BerandaPage })));
const KeluargaPage = lazy(() => import('./pages/keluarga/KeluargaPage.js').then((m) => ({ default: m.KeluargaPage })));
const SuratPage = lazy(() => import('./pages/surat/SuratPage.js').then((m) => ({ default: m.SuratPage })));
const IuranPage = lazy(() => import('./pages/iuran/IuranPage.js').then((m) => ({ default: m.IuranPage })));
const NotifikasiPage = lazy(() => import('./pages/notifikasi/NotifikasiPage.js').then((m) => ({ default: m.NotifikasiPage })));

const MobileTabFallback: React.FC = () => (
  <div className="py-16 flex items-center justify-center">
    <div className="flex flex-col items-center gap-2.5 text-slate-500 text-xs">
      <div className="w-7 h-7 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      <span>Memuat data warga...</span>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading, token, user, logout } = useAuth();
  const [authView, setAuthView] = useState<'LOGIN' | 'ACTIVATION'>('LOGIN');
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // SSE Real-Time listener for resident notifications & API endpoint
  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'https://rt-management-six.vercel.app';

  // Initialize Native Android StatusBar (clean separation, dark icons on light app)
  useEffect(() => {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    }
  }, []);

  // Background keep-warm ping to pre-warm Vercel serverless container & DB pool
  useEffect(() => {
    fetch(`${apiUrl}/api/v1/health?warm=1`, { cache: 'no-store' }).catch(() => {});

    // Maintain warm container & database pool while mobile app / PWA is open
    const interval = setInterval(() => {
      fetch(`${apiUrl}/api/v1/health?warm=1`, { cache: 'no-store' }).catch(() => {});
    }, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [apiUrl]);

  // Stabilize SSE callback to prevent re-render loops
  const handleSseEvent = useCallback((_event: any) => {
    setUnreadCount((prev) => prev + 1);
  }, []);

  useSSE({
    url: `${apiUrl}/api/v1/notifications/stream`,
    token: isAuthenticated ? token : null,
    onEvent: handleSseEvent,
  });

  const desktopNavItems: Array<{ id: TabType; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'keluarga', label: 'Kartu Keluarga', icon: Users },
    { id: 'surat', label: 'E-Surat', icon: FileText },
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
      <Suspense fallback={<MobileTabFallback />}>
        {authView === 'LOGIN' ? (
          <LoginPage onGoToActivation={() => setAuthView('ACTIVATION')} />
        ) : (
          <ActivationPage onBackToLogin={() => setAuthView('LOGIN')} />
        )}
        <AppToaster position="top-center" offset={{ top: 20 }} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      <OfflineModeBanner />

      {/* Mobile Top Header with Brand Logo, Resident Identity, and Direct Logout */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AppLogo size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white truncate">
                  SIM-RT 05
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                  {user?.blokRumah || 'Warga'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user?.namaLengkap || user?.username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-xs"
            aria-label="Keluar dari Akun Warga"
            title="Keluar dari Akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Responsive Desktop Navigation Header */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Neighborhood Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <AppLogo size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  SIM-RT WARGA
                </span>
                <span className="hidden xl:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 whitespace-nowrap">
                  Portal Warga Digital
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                <MapPin className="w-3 h-3 text-teal-600 shrink-0" /> RT 05 / RW 02 Sukamaju, Cilodong
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="flex items-center gap-1.5 shrink-0" aria-label="Navigasi Utama Warga">
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
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
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

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                {user?.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="text-left hidden sm:block max-w-[140px] lg:max-w-[180px]">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block leading-tight truncate">
                  {user?.namaLengkap || user?.username}
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold block leading-none truncate">
                  {user?.blokRumah || 'Warga RT 05'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              title="Keluar dari Akun Warga"
              aria-label="Keluar dari Akun Warga"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Screen Area - Responsive Container with Suspense Lazy Loading */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:py-6">
        <Suspense fallback={<MobileTabFallback />}>
          {activeTab === 'beranda' && <BerandaPage onNavigateTab={(tab) => setActiveTab(tab)} />}
          {activeTab === 'keluarga' && <KeluargaPage />}
          {activeTab === 'surat' && <SuratPage />}
          {activeTab === 'iuran' && <IuranPage />}
          {activeTab === 'notifikasi' && <NotifikasiPage />}
        </Suspense>
      </main>

      {/* Desktop Civic Footer */}
      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800 py-4 bg-white/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
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

      <AppToaster position="top-center" offset={{ top: 72 }} />
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
