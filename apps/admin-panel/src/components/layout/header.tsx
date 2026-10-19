import React, { useState } from 'react';
import { Bell, Radio } from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { useSSE, Badge } from '@simrt/ui-kit';

export const Header: React.FC = () => {
  const { token, user } = useAuth();
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  const apiUrl = (import.meta as any).env?.VITE_API_URL || '';
  const { isConnected, unreadCount, clearUnreadCount } = useSSE({
    url: `${apiUrl}/api/v1/notifications/stream`,
    token,
  });

  const toggleInbox = () => {
    setIsInboxOpen(!isInboxOpen);
    if (!isInboxOpen) {
      clearUnreadCount();
    }
  };

  return (
    <header className="relative flex items-center justify-between px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 z-20">
      {/* Title & Organization Info */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Rukun Tetangga 05 / RW 02
            <Badge variant="success" className="text-[10px] py-0">
              Data Resmi RT
            </Badge>
          </h2>
          <p className="text-xs text-slate-500">Kel. Sukamaju, Kec. Cilodong, Kota Depok</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Real-time Connection Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
          title={isConnected ? 'Koneksi Notifikasi Langsung Terhubung (SSE Real-Time)' : 'Sistem Aktif & Terlindungi'}
        >
          <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isConnected ? 'animate-pulse' : ''}`} />
          <Radio className="w-3.5 h-3.5" />
          <span>{isConnected ? 'Terhubung' : 'Aktif'}</span>
        </div>

        {/* In-App Notification Bell */}
        <div className="relative">
          <button
            onClick={toggleInbox}
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Kotak Masuk Notifikasi Pengurus"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Drawer */}
          {isInboxOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Kotak Masuk Notifikasi</span>
                <span className="text-xs text-teal-700 font-medium cursor-pointer hover:underline" onClick={clearUnreadCount}>
                  Tandai Dibaca
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Sistem Aktif & Terlindungi</span>
                    <span className="text-[10px] text-slate-400">Baru saja</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Koneksi data real-time aktif. Seluruh pengajuan surat dan konfirmasi iuran dari warga akan langsung masuk.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
            {user?.namaLengkap.charAt(0) || 'A'}
          </div>
        </div>
      </div>
    </header>
  );
};
