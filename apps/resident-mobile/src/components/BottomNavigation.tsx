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
        // Ignore haptics failure on unsupported platforms
      }
    }
  };

  const navItems: Array<{ id: TabType; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'keluarga', label: 'Keluarga', icon: Users },
    { id: 'surat', label: 'E-Surat', icon: FileText },
    { id: 'iuran', label: 'Iuran & Kas', icon: Wallet },
    { id: 'notifikasi', label: 'Kotak Masuk', icon: Bell, badge: unreadCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[max(env(safe-area-inset-bottom),8px)] shadow-lg transition-transform duration-200">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
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
              className={`flex flex-col items-center justify-center relative py-1 transition-colors ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-bold'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
