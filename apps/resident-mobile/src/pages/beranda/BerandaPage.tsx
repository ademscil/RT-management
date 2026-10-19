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
  PhoneCall,
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
    <div className="space-y-6 pb-24 md:pb-8">
      {/* 1. App Header with Warm Neighborhood Greeting & Digital Resident Card */}
      <div className="relative bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />
        <div className="absolute top-20 -left-12 w-36 h-36 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Left Column: Greeting and Neighborhood Info */}
          <div className="space-y-4">
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
                  <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight">
                    {getGreeting()},{' '}
                    <span className="text-teal-200">
                      {user?.namaLengkap ? user.namaLengkap.split(' ')[0] : 'Warga'}
                    </span>
                  </h1>
                </div>
              </div>

              {/* Mobile-only elder mode toggle */}
              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={toggleElderMode}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                    isElderMode
                      ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                      : 'bg-teal-900/60 hover:bg-teal-800/80 text-teal-200 border border-teal-700/60'
                  }`}
                  title="Mode Tulisan Besar untuk Orang Tua"
                  aria-label="Mode Tulisan Besar untuk Orang Tua"
                >
                  <Accessibility className="w-4 h-4" />
                  <span className="text-[11px]">{isElderMode ? '125%' : 'A+'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Selamat datang di portal pelayanan digital warga RT 05 / RW 02 Sukamaju. Anda dapat mengurus surat pengantar, mengecek iuran kas, dan melihat jadwal kegiatan warga secara mandiri.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-3.5 py-2 rounded-xl bg-teal-900/40 border border-teal-700/40 text-teal-200/90">
              <span>{todayFormatted}</span>
              <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Lingkungan Aman & Kondusif
              </span>
            </div>
          </div>

          {/* Right Column: Hero Digital Resident Card (Glassmorphism ID) */}
          <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-900/95 via-teal-950/90 to-slate-900/95 border border-teal-500/30 shadow-2xl backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-400 block">
                    KARTU IDENTITAS WARGA RESMI
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-wide mt-0.5">
                    {user?.blokRumah || 'Kavling Blok RT 05'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium">
                    {user?.namaLengkap || user?.username}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-teal-800/50 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-inner">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="pt-3 border-t border-teal-800/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-teal-300 font-mono">
                  <UserCheck className="w-4 h-4 text-teal-400" />
                  <span>Status: Terverifikasi</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('keluarga')}
                  className="text-xs font-bold text-white hover:text-teal-300 flex items-center gap-1 transition-colors"
                >
                  Lihat KK Digital <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions 4 Civic Services */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-1">
          Layanan Cepat Warga
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          {[
            {
              id: 'surat',
              title: 'E-Surat',
              desc: 'Pengantar RT Mandiri',
              icon: FileText,
              bg: 'bg-teal-50 hover:bg-teal-100/80 dark:bg-teal-950/40 dark:hover:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800',
            },
            {
              id: 'iuran',
              title: 'Iuran Kas',
              desc: 'Bayar & Cek Riwayat',
              icon: Wallet,
              bg: 'bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
            },
            {
              id: 'keluarga',
              title: 'Data KK',
              desc: 'Anggota Keluarga',
              icon: Users,
              bg: 'bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800',
            },
            {
              id: 'darurat',
              title: 'Kontak SOS',
              desc: 'Bantuan Siaga 24 Jam',
              icon: ShieldAlert,
              bg: 'bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
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
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs hover:shadow-md active:scale-95 transition-all ${item.bg}`}
              >
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center mb-2 shadow-xs">
                  <Icon className="w-6 h-6" />
                </div>
                <strong className="text-sm font-bold leading-tight block text-slate-900 dark:text-slate-100">
                  {item.title}
                </strong>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none mt-1">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Responsive Main Grid: 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (Span 2): Mading Digital Warga */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Mading Digital Warga RT 05
              </h3>
            </div>
            <span className="text-[11px] text-teal-700 dark:text-teal-400 font-bold">
              {filteredKegiatan.length} Kegiatan Terjadwal
            </span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === chip.id
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredKegiatan.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {item.badge}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">RT 05 Sukamaju</span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {item.judul}
                  </h4>

                  <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                      <Calendar className="w-4 h-4 text-teal-600 flex-shrink-0" /> {item.waktu}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" /> {item.lokasi}
                    </p>
                    <p className="flex items-center gap-2 text-slate-500">
                      <HeartHandshake className="w-4 h-4 text-slate-400 flex-shrink-0" /> Koordinator:{' '}
                      {item.penanggungJawab}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column (Span 1): Iuran Status, Ronda Malam & Kontak Darurat */}
        <div className="space-y-4">
          {/* Iuran Bulanan Status Card */}
          {iuranStatus && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
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
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Iuran Kas ({iuranStatus.bulan})
                    </h4>
                    <Badge variant={iuranStatus.isPaid ? 'success' : 'warning'}>
                      {iuranStatus.isPaid ? 'Lunas' : 'Belum Bayar'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Rp {iuranStatus.nominal.toLocaleString('id-ID')} / bulan
                  </p>
                </div>
              </div>

              <Button
                variant={iuranStatus.isPaid ? 'outline' : 'primary'}
                size="sm"
                onClick={() => onNavigateTab('iuran')}
                className="w-full text-xs font-bold mt-1"
              >
                {iuranStatus.isPaid ? 'Lihat Kwitansi Resmi' : 'Konfirmasi Pembayaran'}
              </Button>
            </div>
          )}

          {/* Jadwal Siskamling / Ronda Malam Interaktif */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shadow-md border border-slate-800 space-y-3">
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
              <p className="text-slate-200 font-medium leading-relaxed">
                Bpk. Bambang (A1-01), Bpk. Hendra (B3-08), Bpk. Joko (B2-04), dan Anda.
              </p>
            </div>
          </div>

          {/* Quick SOS Card */}
          <div className="p-4 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300">
                Layanan Siaga Darurat 24 Jam
              </h4>
            </div>
            <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
              Butuh bantuan darurat keamanan, ambulans, pemadam, atau kontak pengurus RT?
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmergencyDrawerOpen(true)}
              className="w-full text-xs font-bold flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Buka Kontak Darurat
            </Button>
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
