import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  QrCode,
  ShieldCheck,
  LogOut,
  Type,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { Badge } from '@simrt/ui-kit';

export type AdminTab =
  | 'dashboard'
  | 'kependudukan'
  | 'surat'
  | 'keuangan'
  | 'onboarding'
  | 'audit';

interface SidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isElderFont, setIsElderFont] = useState(false);

  const toggleElderFont = () => {
    const next = !isElderFont;
    setIsElderFont(next);
    if (next) {
      document.documentElement.classList.add('text-elder');
    } else {
      document.documentElement.classList.remove('text-elder');
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Command Center & Peta', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
    { id: 'kependudukan', label: 'Data Kependudukan & KK', icon: <Users className="w-5 h-5 shrink-0" /> },
    { id: 'surat', label: 'Maker-Checker E-Surat', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { id: 'keuangan', label: 'Buku Kas & Matriks Iuran', icon: <Wallet className="w-5 h-5 shrink-0" /> },
    { id: 'onboarding', label: 'Cetak Kartu Aktivasi QR', icon: <QrCode className="w-5 h-5 shrink-0" /> },
    { id: 'audit', label: 'Security & Audit Ledger', icon: <ShieldCheck className="w-5 h-5 shrink-0" /> },
  ];

  return (
    <aside
      className={`relative flex flex-col justify-between bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center font-black text-lg text-white shadow-md shrink-0">
              RT
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="text-sm font-bold text-white tracking-wide">SIM-RT ERP</h1>
                <p className="text-[11px] text-teal-400 font-mono">RT 05 / RW 02 Depok</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Perkecil Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {isCollapsed && (
          <div className="flex justify-center py-2 border-b border-slate-800">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Perluas Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                {item.icon}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile & Accessibility Controls */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {/* Elder text size toggle */}
        <button
          onClick={toggleElderFont}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
            isElderFont ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:bg-slate-800'
          } ${isCollapsed ? 'justify-center' : ''}`}
          title="Mode Ukuran Teks Ramah Lansia (125%)"
        >
          <Type className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Teks Ramah Lansia {isElderFont ? '(Aktif)' : ''}</span>}
        </button>

        {/* User profile info */}
        {!isCollapsed && (
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 truncate">{user?.namaLengkap || 'Pengurus RT'}</span>
              <Badge variant="pii" className="text-[10px] py-0 px-1.5">
                {user?.role || 'ADMIN'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">@{user?.username}</p>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Keluar dari Sistem"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
};
