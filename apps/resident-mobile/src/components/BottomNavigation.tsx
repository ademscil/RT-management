import React from 'react';
import { Home, Users, FileText, Wallet, Bell } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export type TabType = 'beranda' | 'keluarga' | 'surat' | 'iuran' | 'notifikasi';

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
}) => {
  const triggerHaptic = async () => {
    if (Capacitor.isPluginAvailable('Haptics')) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // Fallback
      }
    }
  };

  const navItems: Array<{ id: TabType; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'keluarga', label: 'Keluarga', icon: Users },
    { id: 'surat', label: 'E-Surat', icon: FileText },
    { id: 'iuran', label: 'Iuran Kas', icon: Wallet },
    { id: 'notifikasi', label: 'Pesan', icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-[max(env(safe-area-inset-bottom),12px)] px-3">
      <nav className="pointer-events-auto max-w-md mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 transition-all">
        <div className="grid grid-cols-5 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  onChangeTab(item.id);
                }}
                className={`relative flex flex-col items-center justify-center rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-400 font-bold bg-teal-50/80 dark:bg-teal-950/50'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 active:scale-90 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-300 ${
                      isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                  />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-opacity ${
                    isActive ? 'opacity-100 font-bold' : 'opacity-80'
                  }`}
                >
                  {item.label}
                </span>

                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-teal-600 dark:bg-teal-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
