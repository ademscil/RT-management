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
  const { user } = useAuth();
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

  const [kegiatanList, setKegiatanList] = useState<Array<{
    id: string;
    kategori: 'KEBERSIHAN' | 'SOSIAL' | 'KEAMANAN';
    judul: string;
    waktu: string;
    lokasi: string;
    badge: string;
    penanggungJawab: string;
  }>>([]);

  useEffect(() => {
    async function loadStatus() {
      try {
        const bills = await mobileApi.get<{ items: any[] }>('/keuangan/tagihan');
        if (bills && bills.items && bills.items.length > 0) {
          const latest = bills.items[0];
          setIuranStatus({
            isPaid: latest.status === 'PAID',
            bulan: latest.bulan ? `${latest.bulan} ${latest.tahun || ''}` : 'Bulan Berjalan',
            nominal: latest.nominal || 0,
          });
        } else {
          setIuranStatus(null);
        }
      } catch {
        setIuranStatus(null);
      }

      try {
        const rondaData = await mobileApi.get<Array<{ id: string; tanggal: string; shift: string; keterangan: string; pesertaWarga: string[] }>>('/operasional/ronda');
        if (rondaData && Array.isArray(rondaData) && rondaData.length > 0) {
          setKegiatanList(
            rondaData.map((r) => ({
              id: r.id,
              kategori: 'KEAMANAN',
              judul: `Jadwal Siskamling Shift ${r.shift}`,
              waktu: r.tanggal,
              lokasi: 'Pos Kamling Lingkungan RT',
              badge: 'Siskamling',
              penanggungJawab: r.pesertaWarga.length > 0 ? r.pesertaWarga.join(', ') : 'Regu Jaga',
            }))
          );
        } else {
          setKegiatanList([]);
        }
      } catch {
        setKegiatanList([]);
      }
    }
    loadStatus();
  }, []);

  const filteredKegiatan = kegiatanList.filter((k) => {
    if (activeCategory === 'SEMUA') return true;
    return k.kategori === activeCategory;
  });

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* 1. Civic Enterprise Header & Digital Resident Card */}
      <div className="relative bg-slate-900 text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-slate-800 overflow-hidden animate-rise-in">
        {/* Clean top accent rule */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-500 via-emerald-400 to-blue-500" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left Column: Greeting and Neighborhood Info */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/80 text-teal-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{todayFormatted} • RT 05 / RW 02 Sukamaju</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {getGreeting()}, <span className="text-teal-300">{user?.namaLengkap || 'Warga'}</span>
            </h1>

            <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
              Portal pelayanan mandiri warga terintegrasi. Akses surat pengantar resmi ber-QR, pantau transparansi kas RT, dan cek jadwal kegiatan gotong royong warga.
            </p>
          </div>

          {/* Right Column: Hero Digital Resident Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl p-4 bg-slate-950/80 border border-slate-800 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                    IDENTITAS RESMI WARGA
                  </span>
                  <h3 className="text-base font-black text-white tracking-wide mt-0.5">
                    {user?.blokRumah || 'Kavling Blok RT 05'}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    {user?.namaLengkap || user?.username}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-800/80 flex items-center justify-center text-teal-300 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-mono flex items-center gap-1.5 font-semibold text-[11px]">
                  <UserCheck className="w-3.5 h-3.5" /> Status: Terverifikasi
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('keluarga')}
                  className="text-xs font-bold text-teal-300 hover:text-teal-200 flex items-center gap-1 transition-colors"
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
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs hover:shadow-md active:scale-95 transition-all min-h-[115px] ${item.bg}`}
              >
                <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center mb-2 shadow-xs">
                  <Icon className="w-5 h-5" />
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
            {filteredKegiatan.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Belum ada agenda kegiatan warga terjadwal
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Jadwal kerja bakti, posyandu balita, dan siskamling ronda malam resmi dari pengurus RT akan otomatis tampil di sini.
                </p>
              </div>
            ) : (
              filteredKegiatan.map((item) => (
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
                        <Calendar className="w-4 h-4 text-teal-600 shrink-0" /> {item.waktu}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {item.lokasi}
                      </p>
                      <p className="flex items-center gap-2 text-slate-500">
                        <HeartHandshake className="w-4 h-4 text-slate-400 shrink-0" /> Koordinator:{' '}
                        {item.penanggungJawab}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right Column (Span 1): Iuran Status, Ronda Malam & Kontak Darurat */}
        <div className="space-y-4">
          {/* Iuran Bulanan Status Card */}
          {iuranStatus && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
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
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white shadow-sm border border-slate-800 space-y-3">
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

          {/* User Manual Download Link */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Buku Panduan SIM-RT</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Petunjuk resmi penggunaan aplikasi</p>
              </div>
            </div>
            <a
              href="/BUKU_PANDUAN_PENGGUNA_SIM_RT.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shrink-0 transition-colors"
            >
              Unduh PDF
            </a>
          </div>
        </div>
      </div>

      {/* Emergency Bottom Drawer / Modal */}
      <EmergencyContactsDrawer
        isOpen={emergencyDrawerOpen}
        onClose={() => setEmergencyDrawerOpen(false)}
      />
    </div>
  );
};
