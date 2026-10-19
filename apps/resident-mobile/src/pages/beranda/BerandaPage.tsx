import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Moon,
  FileText,
  Wallet,
  Users,
  CheckCircle2,
  Calendar,
  MapPin,
  ChevronRight,
  Accessibility,
  HeartHandshake,
  ShieldCheck,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { mobileApi } from '../../services/api.js';
import { Card, CardContent, Badge, Button } from '@simrt/ui-kit';
import { EmergencyContactsDrawer } from '../../components/EmergencyContactsDrawer.js';
import type { TabType } from '../../components/BottomNavigation.js';

interface BerandaPageProps {
  onNavigateTab: (tab: TabType) => void;
}

export const BerandaPage: React.FC<BerandaPageProps> = ({ onNavigateTab }) => {
  const { user, isElderMode, toggleElderMode } = useAuth();
  const [emergencyDrawerOpen, setEmergencyDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'SEMUA' | 'KEBERSIHAN' | 'SOSIAL' | 'KEAMANAN'>('SEMUA');
  const [iuranStatus, setIuranStatus] = useState<{ isPaid: boolean; bulan: string; nominal: number } | null>(null);

  // Time-based Indonesian greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Selamat pagi';
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  useEffect(() => {
    async function loadStatus() {
      try {
        const bills = await mobileApi.get<{ items: any[] }>('/keuangan/tagihan');
        if (bills && bills.items && bills.items.length > 0) {
          const latest = bills.items[0];
          setIuranStatus({
            isPaid: latest.status === 'PAID',
            bulan: 'Oktober 2026',
            nominal: latest.nominal,
          });
        } else {
          setIuranStatus({
            isPaid: true,
            bulan: 'Oktober 2026',
            nominal: 50000,
          });
        }
      } catch {
        setIuranStatus({
          isPaid: true,
          bulan: 'Oktober 2026',
          nominal: 50000,
        });
      }
    }
    loadStatus();
  }, []);

  const kegiatanList = [
    {
      id: '1',
      kategori: 'KEBERSIHAN',
      judul: 'Kerja Bakti Bersih Saluran Air & Fogging Nyamuk',
      waktu: 'Minggu, 25 Okt 2026 • 07:00 WIB',
      lokasi: 'Sepanjang Jalur Utama Blok A & B',
      badge: 'Gotong Royong',
      penanggungJawab: 'Bpk. Suhendra (Seksi Lingkungan)',
    },
    {
      id: '2',
      kategori: 'SOSIAL',
      judul: 'Posyandu Balita & Pemeriksaan Tensi Lansia Melati',
      waktu: 'Selasa, 27 Okt 2026 • 08:30 WIB',
      lokasi: 'Balai Warga RT 05 / RW 02',
      badge: 'Kesehatan Warga',
      penanggungJawab: 'Ibu Ratna (Kader Posyandu)',
    },
    {
      id: '3',
      kategori: 'KEAMANAN',
      judul: 'Ronda Gabungan & Pengecekan Lampu Jalan Mati',
      waktu: 'Sabtu, 24 Okt 2026 • 22:00 WIB',
      lokasi: 'Pos Kamling Depan Gapura',
      badge: 'Siskamling',
      penanggungJawab: 'Bpk. Bambang (Ketua RT)',
    },
  ];

  const filteredKegiatan = kegiatanList.filter((k) => {
    if (activeCategory === 'SEMUA') return true;
    return k.kategori === activeCategory;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* 1. App Header with Warm Neighborhood Greeting */}
      <div className="relative bg-gradient-to-b from-teal-900 via-teal-950 to-slate-950 text-white pt-safe pb-8 px-5 rounded-b-[2.5rem] shadow-xl overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />
        <div className="absolute top-20 -left-12 w-36 h-36 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 p-0.5 shadow-md shadow-teal-900/50">
                <div className="w-full h-full bg-teal-950 rounded-[14px] flex items-center justify-center font-black text-white text-base">
                  RT
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-teal-300/90 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-teal-400" /> RT 05 / RW 02 Sukamaju
                </p>
                <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">
                  {getGreeting()},{' '}
                  <span className="text-teal-200">
                    {user?.namaLengkap ? user.namaLengkap.split(' ')[0] : 'Warga'}
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleElderMode}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                  isElderMode
                    ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                    : 'bg-teal-900/60 hover:bg-teal-800/80 text-teal-200 border border-teal-700/60'
                }`}
                title="Mode Tulisan Besar untuk Orang Tua"
              >
                <Accessibility className="w-4 h-4" />
                <span className="text-[11px]">{isElderMode ? '125%' : 'A+'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-teal-900/40 border border-teal-700/40 text-teal-200/90">
            <span>{todayFormatted}</span>
            <span className="flex items-center gap-1 text-emerald-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              Lingkungan Aman & Kondusif
            </span>
          </div>

          {/* 2. Hero Digital Resident Card (Glassmorphism ID) */}
          <div className="relative rounded-3xl p-5 bg-gradient-to-br from-slate-900/95 via-teal-950/90 to-slate-900/95 border border-teal-500/30 shadow-2xl backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-400 block">
                    KARTU IDENTITAS WARGA RESMI
                  </span>
                  <h3 className="text-lg font-black text-white tracking-wide mt-0.5">
                    {user?.blokRumah || 'Kavling Blok RT 05'}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    {user?.namaLengkap || user?.username}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-teal-800/50 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-inner">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="pt-3 border-t border-teal-800/50 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-teal-300 font-mono">
                  <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Status: Terverifikasi</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('keluarga')}
                  className="text-xs font-bold text-white hover:text-teal-300 flex items-center gap-0.5"
                >
                  Lihat KK Digital <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-3">
        {/* 3. Quick Actions 4 Civic Services */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            {
              id: 'surat',
              title: 'E-Surat',
              desc: 'Pengantar RT',
              icon: FileText,
              bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200/80',
            },
            {
              id: 'iuran',
              title: 'Iuran Kas',
              desc: 'Bayar & Cek',
              icon: Wallet,
              bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80',
            },
            {
              id: 'keluarga',
              title: 'Data KK',
              desc: 'Keluarga',
              icon: Users,
              bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80',
            },
            {
              id: 'darurat',
              title: 'Kontak SOS',
              desc: 'Bantuan Cepat',
              icon: ShieldAlert,
              bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80',
              action: () => setEmergencyDrawerOpen(true),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.action) item.action();
                  else onNavigateTab(item.id as TabType);
                }}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm active:scale-95 transition-all ${item.bg}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center mb-1.5 shadow-xs">
                  <Icon className="w-5 h-5" />
                </div>
                <strong className="text-xs font-bold leading-tight block text-slate-900 dark:text-slate-100">
                  {item.title}
                </strong>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none mt-0.5">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4. Iuran Bulanan Status Card */}
        {iuranStatus && (
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  iuranStatus.isPaid
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'
                }`}
              >
                {iuranStatus.isPaid ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Iuran Warga ({iuranStatus.bulan})
                  </h4>
                  <Badge variant={iuranStatus.isPaid ? 'success' : 'warning'}>
                    {iuranStatus.isPaid ? 'Lunas' : 'Belum Bayar'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Nominal: Rp {iuranStatus.nominal.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <Button
              variant={iuranStatus.isPaid ? 'outline' : 'primary'}
              size="sm"
              onClick={() => onNavigateTab('iuran')}
              className="text-xs font-bold"
            >
              {iuranStatus.isPaid ? 'Kwitansi' : 'Bayar'}
            </Button>
          </div>
        )}

        {/* 5. Jadwal Siskamling / Ronda Malam Interaktif */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shadow-md border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-800/60 text-teal-300 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Jadwal Siskamling / Ronda</h4>
                <p className="text-[11px] text-teal-300 font-medium">Sabtu malam, 24 Oktober 2026</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-800/80 text-teal-200 border border-teal-600/40">
              22:00 - 04:00 WIB
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Rekan Jaga Satu Regu:
            </span>
            <p className="text-slate-200 font-medium">
              Bpk. Bambang (A1-01), Bpk. Hendra (B3-08), Bpk. Joko (B2-04), dan Anda.
            </p>
          </div>
        </div>

        {/* 6. Mading Warga RT (Pengumuman & Agenda Komunitas) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Mading Digital Warga RT 05
              </h3>
            </div>
            <span className="text-[11px] text-teal-700 font-bold">3 Kegiatan Terjadwal</span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'SEMUA', label: 'Semua Agenda' },
              { id: 'KEBERSIHAN', label: 'Kerja Bakti' },
              { id: 'SOSIAL', label: 'Posyandu & Sosial' },
              { id: 'KEAMANAN', label: 'Keamanan' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveCategory(chip.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === chip.id
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filteredKegiatan.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {item.badge}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">RT 05 Sukamaju</span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {item.judul}
                  </h4>

                  <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" /> {item.waktu}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.lokasi}
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <HeartHandshake className="w-3.5 h-3.5 text-slate-400" /> Koordinator:{' '}
                      {item.penanggungJawab}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Emergency Bottom Drawer */}
      <EmergencyContactsDrawer
        isOpen={emergencyDrawerOpen}
        onClose={() => setEmergencyDrawerOpen(false)}
      />
    </div>
  );
};
