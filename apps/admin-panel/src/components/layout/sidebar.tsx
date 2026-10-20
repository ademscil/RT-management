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

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navSections: NavSection[] = [
    {
      title: 'TATA KELOLA WARGA',
      items: [
        {
          id: 'dashboard',
          label: 'Beranda & Denah RT',
          icon: <LayoutDashboard className="w-4 h-4" />,
          iconColor: 'text-teal-400',
          iconBg: 'bg-teal-950/60',
          iconBorder: 'border-teal-700/60',
        },
        {
          id: 'kependudukan',
          label: 'Kependudukan & KK',
          icon: <Users className="w-4 h-4" />,
          iconColor: 'text-blue-400',
          iconBg: 'bg-blue-950/60',
          iconBorder: 'border-blue-700/60',
        },
        {
          id: 'surat',
          label: 'Pelayanan E-Surat',
          icon: <FileText className="w-4 h-4" />,
          iconColor: 'text-emerald-400',
          iconBg: 'bg-emerald-950/60',
          iconBorder: 'border-emerald-700/60',
        },
      ],
    },
    {
      title: 'KEUANGAN & AUDIT',
      items: [
        {
          id: 'keuangan',
          label: 'Keuangan & Iuran RT',
          icon: <Wallet className="w-4 h-4" />,
          iconColor: 'text-amber-400',
          iconBg: 'bg-amber-950/60',
          iconBorder: 'border-amber-700/60',
        },
        {
          id: 'onboarding',
          label: 'Aktivasi Akun (Cetak QR)',
          icon: <QrCode className="w-4 h-4" />,
          iconColor: 'text-purple-400',
          iconBg: 'bg-purple-950/60',
          iconBorder: 'border-purple-700/60',
        },
        {
          id: 'audit',
          label: 'Catatan Aktivitas RT',
          icon: <ShieldCheck className="w-4 h-4" />,
          iconColor: 'text-rose-400',
          iconBg: 'bg-rose-950/60',
          iconBorder: 'border-rose-700/60',
        },
      ],
    },
  ];

  const roleLabel: Record<string, string> = {
    SUPERUSER: 'Superuser / Root Admin',
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
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
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
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700/70 bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-xs"
              title="Perkecil Sidebar"
              aria-label="Perkecil Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {isCollapsed && (
          <div className="flex justify-center py-2.5 border-b border-slate-800/80">
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700/70 bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-xs"
              title="Perluas Sidebar"
              aria-label="Perluas Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="p-3 space-y-4">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed ? (
                <div className="flex items-center gap-2 px-2.5 py-1">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    {section.title}
                  </span>
                  <span className="flex-1 h-[1px] bg-gradient-to-r from-slate-700 to-transparent" />
                </div>
              ) : (
                <div className="h-[1px] bg-slate-800 my-2 mx-2" />
              )}

              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-xs border border-slate-700/80'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    } ${isCollapsed ? 'justify-center p-2' : ''}`}
                  >
                    {/* Semantic Icon Wrapper */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                        isActive
                          ? `${item.iconBg} ${item.iconColor} ${item.iconBorder} ring-2 ring-teal-500/20`
                          : 'bg-slate-800/90 text-slate-400 border-slate-700/50'
                      }`}
                    >
                      {item.icon}
                    </div>

                    {!isCollapsed && (
                      <span className={`truncate text-left ${isActive ? 'text-white font-bold' : ''}`}>
                        {item.label}
                      </span>
                    )}

                    {isActive && !isCollapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Profile Controls */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {/* Unduh Buku Panduan PDF */}
        <a
          href="/BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-teal-400 hover:bg-teal-950/40 hover:text-teal-300 transition-colors border border-teal-800/40 ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Unduh Buku Panduan Pengguna (PDF)"
        >
          <FileText className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Buku Panduan PDF</span>}
        </a>

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
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Keluar dari Sistem"
          aria-label="Keluar dari Sistem"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
};
