import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/auth-context.js';
import { Sidebar, type AdminTab } from './components/layout/sidebar.js';
import { Header } from './components/layout/header.js';
import { AppToaster, AppErrorBoundary, OfflineModeBanner } from '@simrt/ui-kit';
import { API_ORIGIN } from './services/api.js';

// Route-based code splitting for instantaneous initial load
const DashboardPage = lazy(() => import('./pages/dashboard.js').then((m) => ({ default: m.DashboardPage })));
const KependudukanPage = lazy(() => import('./pages/kependudukan.js').then((m) => ({ default: m.KependudukanPage })));
const SuratPage = lazy(() => import('./pages/surat.js').then((m) => ({ default: m.SuratPage })));
const KeuanganPage = lazy(() => import('./pages/keuangan.js').then((m) => ({ default: m.KeuanganPage })));
const OnboardingPage = lazy(() => import('./pages/onboarding.js').then((m) => ({ default: m.OnboardingPage })));
const AuditPage = lazy(() => import('./pages/audit.js').then((m) => ({ default: m.AuditPage })));
const LoginPage = lazy(() => import('./pages/login.js').then((m) => ({ default: m.LoginPage })));

const ModuleFallback: React.FC = () => (
  <div className="p-12 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400 text-xs font-medium">
      <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      <span>Memuat modul sistem...</span>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    // Non-blocking background keep-warm ping to wake up Vercel serverless container early
    fetch(`${API_ORIGIN}/api/v1/health`, { cache: 'no-store' }).catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-teal-400 font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat SIM-RT Command Center...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<ModuleFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <OfflineModeBanner />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-slim">
          <AppErrorBoundary fallbackTitle="Terjadi Kesalahan pada Modul ERP Ini">
            <Suspense fallback={<ModuleFallback />}>
              {activeTab === 'dashboard' && <DashboardPage onNavigateTab={setActiveTab} />}
              {activeTab === 'kependudukan' && <KependudukanPage />}
              {activeTab === 'surat' && <SuratPage />}
              {activeTab === 'keuangan' && <KeuanganPage />}
              {activeTab === 'onboarding' && <OnboardingPage />}
              {activeTab === 'audit' && <AuditPage />}
            </Suspense>
          </AppErrorBoundary>
        </main>
      </div>

      <AppToaster position="bottom-right" expand />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppErrorBoundary fallbackTitle="Terjadi Masalah Fatal pada Aplikasi">
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </AppErrorBoundary>
  );
};
