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

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading, token } = useAuth();
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

      {/* Main Tab Screen Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {activeTab === 'beranda' && <BerandaPage onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'keluarga' && <KeluargaPage />}
        {activeTab === 'surat' && <SuratPage />}
        {activeTab === 'iuran' && <IuranPage />}
        {activeTab === 'notifikasi' && <NotifikasiPage />}
      </main>

      {/* Thumb-friendly Ergonomic Bottom Navigation Bar */}
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
