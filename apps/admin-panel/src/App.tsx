import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/auth-context.js';
import { Sidebar, type AdminTab } from './components/layout/sidebar.js';
import { Header } from './components/layout/header.js';
import { DashboardPage } from './pages/dashboard.js';
import { KependudukanPage } from './pages/kependudukan.js';
import { SuratPage } from './pages/surat.js';
import { KeuanganPage } from './pages/keuangan.js';
import { OnboardingPage } from './pages/onboarding.js';
import { AuditPage } from './pages/audit.js';
import { LoginPage } from './pages/login.js';
import { AppToaster, AppErrorBoundary, OfflineModeBanner } from '@simrt/ui-kit';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-teal-500 font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat SIM-RT Command Center...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <OfflineModeBanner />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AppErrorBoundary fallbackTitle="Terjadi Kesalahan pada Modul ERP Ini">
            {activeTab === 'dashboard' && <DashboardPage />}
            {activeTab === 'kependudukan' && <KependudukanPage />}
            {activeTab === 'surat' && <SuratPage />}
            {activeTab === 'keuangan' && <KeuanganPage />}
            {activeTab === 'onboarding' && <OnboardingPage />}
            {activeTab === 'audit' && <AuditPage />}
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
