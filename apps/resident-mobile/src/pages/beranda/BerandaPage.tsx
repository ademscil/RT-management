import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Moon,
  FileText,
  Wallet,
  Users,
  Bell,
  Megaphone,
  CheckCircle2,
  Sparkles,
  Accessibility,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { mobileApi } from '../../services/api.js';
import { Card, CardContent, Badge } from '@simrt/ui-kit';
import { EmergencyContactsDrawer } from '../../components/EmergencyContactsDrawer.js';
import type { TabType } from '../../components/BottomNavigation.js';

interface BerandaPageProps {
  onNavigateTab: (tab: TabType) => void;
}

export const BerandaPage: React.FC<BerandaPageProps> = ({ onNavigateTab }) => {
  const { user, isElderMode, toggleElderMode } = useAuth();
  const [emergencyDrawerOpen, setEmergencyDrawerOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Array<{ id: string; judul: string; isi: string; tanggal: string }>>([]);
  const [nextRonda, setNextRonda] = useState<{ tanggal: string; jam: string; pos: string } | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Fetch public announcements & agenda
        const agenda = await mobileApi.get<any[]>('/operasional/agenda');
        if (agenda && agenda.length > 0) {
          setAnnouncements(
            agenda.map((a) => ({
              id: a.id,
              judul: a.judul,
              isi: a.deskripsi,
              tanggal: new Date(a.tanggalMulai).toLocaleDateString('id-ID'),
            }))
          );
        } else {
          setAnnouncements([
            {
              id: '1',
              judul: 'Kerja Bakti Saluran Air Lingkungan RT 05',
              isi: 'Minggu pagi pukul 07.00 WIB. Harap membawa cangkul & sapu lidi untuk kebersihan bersama.',
              tanggal: 'Minggu ini',
            },
          ]);
        }

        // Set next ronda
        setNextRonda({
          tanggal: 'Sabtu, 24 Okt 2026',
          jam: '22:00 - 04:00 WIB',
          pos: 'Pos Kamling RT 05 (Depan Taman)',
        });
      } catch {
        // Graceful fallback
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-4 pb-20">
      {/* Top App Bar with Resident Greeting & Elder Mode Toggle */}
      <div className="bg-gradient-to-br from-teal-800 to-teal-950 text-white p-5 rounded-b-3xl shadow-xl space-y-4 pt-safe">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600/60 border border-teal-400/40 flex items-center justify-center font-black text-lg text-white shadow-inner">
              RT
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-900 text-teal-300 border border-teal-700/50">
                  {user?.blokRumah || 'RT 05 / RW 02'}
                </span>
                <span className="text-[10px] text-teal-300 font-mono">Kel. Sukamaju</span>
              </div>
              <h2 className="text-base font-black text-white mt-0.5 truncate max-w-[200px]">
                {user?.namaLengkap || user?.username}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Elder text mode toggle */}
            <button
              onClick={toggleElderMode}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                isElderMode
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'bg-teal-900/80 text-teal-200 hover:bg-teal-900 border border-teal-700/60'
              }`}
              title="Perbesar Tulisan (Ramah Lansia)"
            >
              <Accessibility className="w-4 h-4" />
              <span className="text-[10px] font-bold">{isElderMode ? '125%' : 'A+'}</span>
            </button>
          </div>
        </div>

        {/* Emergency SOS Banner Button */}
        <button
          onClick={() => setEmergencyDrawerOpen(true)}
          className="w-full p-3 bg-red-600/90 hover:bg-red-600 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-red-900/40 border border-red-500/50 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-left">
              <span className="text-xs font-black block tracking-wide uppercase">Kontak Darurat RT 05</span>
              <span className="text-[11px] text-red-200">Ketua RT • Satpam • Damkar • Ambulans</span>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-red-800/80">SOS</span>
        </button>
      </div>

      <div className="px-4 space-y-4">
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { id: 'surat', label: 'E-Surat', icon: FileText, color: 'text-teal-700 bg-teal-50 dark:bg-teal-950/40' },
            { id: 'iuran', label: 'Bayar Kas', icon: Wallet, color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40' },
            { id: 'keluarga', label: 'Data KK', icon: Users, color: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40' },
            { id: 'notifikasi', label: 'Notifikasi', icon: Bell, color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40' },
          ].map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => onNavigateTab(act.id as TabType)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-teal-500 active:scale-95 transition-all text-center"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 ${act.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {act.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ronda Malam Information Card */}
        {nextRonda && (
          <Card className="border-teal-200 dark:border-teal-900/60 bg-gradient-to-r from-teal-50/70 to-emerald-50/40 dark:from-slate-900 dark:to-teal-950/30">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-900/30">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-teal-900 dark:text-teal-200">Jadwal Ronda Malam</span>
                    <Badge variant="success">Aktif</Badge>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    {nextRonda.tanggal} ({nextRonda.jam})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{nextRonda.pos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pengumuman & Broadcast Warga */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-teal-700" /> Pengumuman Resmi Pengurus
            </h3>
            <span className="text-[10px] text-teal-700 font-semibold">Tersiar ke Seluruh Warga</span>
          </div>

          <div className="space-y-2.5">
            {announcements.map((ann) => (
              <Card key={ann.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {ann.judul}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">{ann.tanggal}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {ann.isi}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Standar Kebersihan & Keamanan Lingkungan */}
        <Card className="bg-slate-900 text-slate-100 border-slate-800">
          <CardContent className="p-4 space-y-2">
            <h4 className="text-xs font-bold flex items-center gap-1.5 text-teal-400">
              <CheckCircle2 className="w-4 h-4 text-teal-400" /> Kebijakan Keamanan Lingkungan RT 05
            </h4>
            <ul className="text-[11px] text-slate-300 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="text-teal-400 font-bold">•</span>
                <span>Tamu menginap &gt; 24 jam wajib melapor melalui menu <strong>E-Surat</strong> atau langsung ke Pos Ronda.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-400 font-bold">•</span>
                <span>Pintu portal gerbang utama ditutup pukul 23:00 WIB setiap malam demi keamanan warga.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Drawer */}
      <EmergencyContactsDrawer
        isOpen={emergencyDrawerOpen}
        onClose={() => setEmergencyDrawerOpen(false)}
      />
    </div>
  );
};
