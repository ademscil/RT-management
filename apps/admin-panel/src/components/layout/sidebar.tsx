import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  QrCode,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { AppLogo } from '../AppLogo.js';

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

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Beranda & Denah RT', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
    { id: 'kependudukan', label: 'Kependudukan & KK', icon: <Users className="w-5 h-5 shrink-0" /> },
    { id: 'surat', label: 'Pelayanan E-Surat', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { id: 'keuangan', label: 'Keuangan & Iuran RT', icon: <Wallet className="w-5 h-5 shrink-0" /> },
    { id: 'onboarding', label: 'Aktivasi Akun (Cetak QR)', icon: <QrCode className="w-5 h-5 shrink-0" /> },
    { id: 'audit', label: 'Catatan Aktivitas RT', icon: <ShieldCheck className="w-5 h-5 shrink-0" /> },
  ];

  const roleLabel: Record<string, string> = {
    KETUA_RT: 'Ketua RT',
    SEKRETARIS: 'Sekretaris RT',
    BENDAHARA: 'Bendahara RT',
    ADMIN: 'Pengurus RT',
    WARGA: 'Warga',
  };

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
            <AppLogo size="sm" />
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="text-sm font-bold text-white tracking-wide">SIM-RT 05 / RW 02</h1>
                <p className="text-[11px] text-teal-400 font-medium">Kel. Sukamaju, Depok</p>
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

      {/* Bottom Profile Controls */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {/* User profile info */}
        {!isCollapsed ? (
          <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
              {user?.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-200 truncate block leading-tight" title={user?.namaLengkap || 'Pengurus RT'}>
                {user?.namaLengkap || 'Pengurus RT'}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-900/90 text-teal-200 border border-teal-700/60 shrink-0 whitespace-nowrap leading-none">
                  {roleLabel[user?.role || ''] || user?.role || 'Pengurus'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono truncate leading-none">
                  @{user?.username}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-8 h-8 rounded-lg bg-teal-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs cursor-default"
              title={`${user?.namaLengkap || 'Pengurus RT'} (${roleLabel[user?.role || ''] || 'Pengurus'})`}
            >
              {user?.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : 'P'}
            </div>
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
