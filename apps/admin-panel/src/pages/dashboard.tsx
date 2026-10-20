import React, { useState, useEffect } from 'react';
import {
  Users,
  Home,
  Wallet,
  AlertTriangle,
  HeartPulse,
  FileText,
  CheckCircle,
  ArrowRight,
  MapPin,
  List,
  Search,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/auth-context.js';
import type { AdminTab } from '../components/layout/sidebar.js';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@simrt/ui-kit';

interface BlockMapHouse {
  id: string;
  kodeBlok: string;
  nomorRumah: string;
  alamat: string;
  gridX: number;
  gridY: number;
  statusHunian: string;
  iuranStatus: string;
  totalPenghuni: number;
  vulnerabilities: {
    hasLansia: boolean;
    hasDisabilitas: boolean;
    hasBalita: boolean;
    hasIbuHamil: boolean;
    anyVulnerability: boolean;
  };
  kepalaKeluarga: string;
}

interface DashboardPageProps {
  onNavigateTab?: (tab: AdminTab) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const [mapData, setMapData] = useState<BlockMapHouse[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<BlockMapHouse | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VULNERABILITY' | 'IURAN'>('ALL');
  const [viewMode, setViewMode] = useState<'MAP' | 'TABLE'>('MAP');
  const [houseSearch, setHouseSearch] = useState('');

  // Pending action counts
  const [pendingSuratSign, setPendingSuratSign] = useState(0);
  const [pendingSuratVerify, setPendingSuratVerify] = useState(0);
  const [pendingIuran, setPendingIuran] = useState(0);

  // Blood donor quick search
  const [bloodTypeSearch, setBloodTypeSearch] = useState<string>('');
  const [donorResults, setDonorResults] = useState<Array<{ namaLengkap: string; golonganDarah: string; blokRumah: string }>>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const houses = await api.get<BlockMapHouse[]>('/kependudukan/map');
        setMapData(houses);
        if (houses.length > 0) {
          setSelectedHouse(houses[0]);
        }
      } catch (err) {
        console.error('Failed to load map data:', err);
      }

      // Load action counts
      try {
        const suratVerifyRes = await api.get<{ meta: { total: number } }>('/surat', { status: 'SUBMITTED', limit: 1 });
        setPendingSuratVerify(suratVerifyRes.meta?.total || 0);

        const suratSignRes = await api.get<{ meta: { total: number } }>('/surat', { status: 'VERIFIED_SEKRETARIS', limit: 1 });
        setPendingSuratSign(suratSignRes.meta?.total || 0);

        const iuranRes = await api.get<{ meta: { total: number } }>('/keuangan/tagihan', { status: 'PENDING_VERIFICATION', limit: 1 });
        setPendingIuran(iuranRes.meta?.total || 0);
      } catch (err) {
        console.error('Failed to load pending counts:', err);
      }
    }
    loadData();
  }, []);

  const handleBloodSearch = async (golDarah: string) => {
    setBloodTypeSearch(golDarah);
    if (!golDarah) {
      setDonorResults([]);
      return;
    }
    try {
      const res = await api.get<{ items: Array<{ namaLengkap: string; golonganDarah: string; blokRumah: string }> }>(
        '/kependudukan/warga',
        { golonganDarah: golDarah, limit: 10 }
      );
      setDonorResults(res.items);
    } catch {
      setDonorResults([]);
    }
  };

  const totalWarga = mapData.reduce((acc, h) => acc + h.totalPenghuni, 0);
  const totalRumah = mapData.length;
  const housesWithVulnerability = mapData.filter((h) => h.vulnerabilities.anyVulnerability).length;

  const filteredHouses = mapData.filter((h) => {
    if (houseSearch) {
      const q = houseSearch.toLowerCase();
      const matchBlok = `${h.kodeBlok}/${h.nomorRumah}`.toLowerCase().includes(q);
      const matchNama = h.kepalaKeluarga.toLowerCase().includes(q);
      const matchAlamat = h.alamat.toLowerCase().includes(q);
      if (!matchBlok && !matchNama && !matchAlamat) return false;
    }
    if (filterMode === 'VULNERABILITY') {
      return h.vulnerabilities.anyVulnerability;
    }
    if (filterMode === 'IURAN') {
      return h.iuranStatus !== 'PAID';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Greeting & Action Hub - Civic Enterprise Benchmark */}
      <div className="relative bg-slate-900 rounded-2xl p-6 text-white shadow-xs border border-slate-800 overflow-hidden animate-rise-in">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-500 via-emerald-400 to-blue-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-800 text-teal-300 border border-slate-700">
                Selamat Datang, {user?.namaLengkap || 'Pengurus RT'}
              </span>
              <span className="text-xs text-slate-400 font-mono">RT 05 / RW 02 Depok</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black mt-2 tracking-tight">
              Pusat Pelayanan & Antrean Administrasi Warga
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Periksa tugas dan permohonan warga yang memerlukan persetujuan Anda hari ini.
            </p>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {pendingSuratSign > 0 && (
              <button
                onClick={() => onNavigateTab && onNavigateTab('surat')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-md animate-pulse"
              >
                <FileText className="w-4 h-4" />
                <span>{pendingSuratSign} Surat Butuh TTD</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}

            {pendingSuratVerify > 0 && (
              <button
                onClick={() => onNavigateTab && onNavigateTab('surat')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md"
              >
                <FileText className="w-4 h-4" />
                <span>{pendingSuratVerify} Surat Butuh Cek</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}

            {pendingIuran > 0 && (
              <button
                onClick={() => onNavigateTab && onNavigateTab('keuangan')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md"
              >
                <Wallet className="w-4 h-4" />
                <span>{pendingIuran} Iuran Menunggu Acc</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}

            {pendingSuratSign === 0 && pendingSuratVerify === 0 && pendingIuran === 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-emerald-400 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Semua antrean administrasi beres</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Ringkasan Wilayah RT (Enterprise Benchmark) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card-enterprise stat-card-teal">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Penduduk</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{totalWarga} Jiwa</h4>
              <p className="text-xs text-teal-700 dark:text-teal-400 font-medium mt-1">Terdaftar di Buku Induk</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800/60 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="stat-card-enterprise stat-card-blue">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kavling / Rumah</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{totalRumah} Unit</h4>
              <p className="text-xs text-slate-500 font-medium mt-1">Blok A & Blok B Terdata</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
              <Home className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="stat-card-enterprise stat-card-amber">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Prioritas Darurat</p>
              <h4 className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1 tabular-nums">{housesWithVulnerability} Rumah</h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1">Lansia / Disabilitas / Balita</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="stat-card-enterprise stat-card-green">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kas Operasional RT</p>
              <h4 className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1 tabular-nums">Rp 8.500.000</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1">Buku Kas Sah & Terkunci</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Denah Interaktif & Rincian Rumah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Block Map / Table (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <span>Denah Kavling & Rumah RT 05 / RW 02</span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik salah satu rumah untuk melihat rincian anggota keluarga & status iuran
              </p>
            </div>

            {/* View Mode Toggle & Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('MAP')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'MAP'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Peta Visual"
                >
                  <MapPin className="w-3.5 h-3.5" /> Peta
                </button>
                <button
                  onClick={() => setViewMode('TABLE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'TABLE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Daftar Tabel"
                >
                  <List className="w-3.5 h-3.5" /> Tabel
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="dashboard-search-house"
                  name="houseSearch"
                  type="search"
                  role="searchbox"
                  aria-label="Cari nomor rumah atau nama kepala keluarga"
                  autoComplete="off"
                  value={houseSearch}
                  onChange={(e) => setHouseSearch(e.target.value)}
                  placeholder="Cari no. rumah / nama kepala keluarga..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filterMode === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilterMode('VULNERABILITY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                    filterMode === 'VULNERABILITY'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-700 hover:bg-amber-100/50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Tanggap Darurat
                </button>
                <button
                  onClick={() => setFilterMode('IURAN')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filterMode === 'IURAN'
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Belum Iuran
                </button>
              </div>
            </div>

            {/* View 1: Visual Block Map */}
            {viewMode === 'MAP' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredHouses.map((house) => {
                    const isSelected = selectedHouse?.id === house.id;
                    let bgColor = 'bg-teal-700 text-white';
                    let borderColor = 'border-teal-800';

                    if (house.statusHunian === 'DIHUNI_PENYEWA') {
                      bgColor = 'bg-blue-600 text-white';
                      borderColor = 'border-blue-700';
                    } else if (house.statusHunian === 'KOSONG') {
                      bgColor = 'bg-slate-600 text-white';
                      borderColor = 'border-slate-700';
                    }

                    if (filterMode === 'VULNERABILITY') {
                      bgColor = house.vulnerabilities.anyVulnerability ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300';
                    } else if (filterMode === 'IURAN') {
                      bgColor = house.iuranStatus === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white';
                    }

                    return (
                      <div
                        key={house.id}
                        onClick={() => setSelectedHouse(house)}
                        className={`cursor-pointer p-3 rounded-2xl border-2 transition-all select-none relative ${bgColor} ${borderColor} ${
                          isSelected ? 'ring-4 ring-offset-2 ring-teal-500 shadow-lg scale-[1.02]' : 'hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black tracking-wider uppercase font-mono">
                            Blok {house.kodeBlok}/{house.nomorRumah}
                          </span>
                          {house.vulnerabilities.anyVulnerability && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" title="Lansia/Disabilitas" />
                          )}
                        </div>

                        <p className="text-[11px] font-semibold truncate mt-1 opacity-90">
                          {house.kepalaKeluarga}
                        </p>

                        <div className="flex items-center justify-between text-[10px] mt-2 pt-1 border-t border-white/20">
                          <span>{house.totalPenghuni} Jiwa</span>
                          <span className="font-bold">
                            {house.iuranStatus === 'PAID' ? 'Iuran Lunas' : 'Belum Lunas'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredHouses.length === 0 && (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl text-xs text-slate-500">
                    Tidak ada rumah yang sesuai dengan kriteria pencarian atau filter ini.
                  </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-teal-700" /> Dihuni Pemilik
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-blue-600" /> Dihuni Penyewa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500" /> Prioritas Tanggap Darurat
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> Lansia/Disabilitas
                  </span>
                </div>
              </div>
            )}

            {/* View 2: Tabular List */}
            {viewMode === 'TABLE' && (
              <div className="overflow-x-auto scrollbar-slim border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Blok / No</th>
                      <th className="py-2.5 px-3">Kepala Keluarga</th>
                      <th className="py-2.5 px-3">Status Hunian</th>
                      <th className="py-2.5 px-3">Penghuni</th>
                      <th className="py-2.5 px-3">Status Iuran</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHouses.map((house) => (
                      <tr
                        key={house.id}
                        onClick={() => setSelectedHouse(house)}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          selectedHouse?.id === house.id ? 'bg-teal-50/60 dark:bg-teal-950/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold font-mono">
                          Blok {house.kodeBlok}/{house.nomorRumah}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {house.kepalaKeluarga}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[11px] text-slate-500">
                            {house.statusHunian.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{house.totalPenghuni} Jiwa</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={house.iuranStatus === 'PAID' ? 'success' : 'destructive'} className="text-[10px]">
                            {house.iuranStatus === 'PAID' ? 'Lunas' : 'Belum Lunas'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedHouse(house)} className="text-[11px] py-1 px-2">
                            Pilih
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected House Inspector & Blood Search (1 col) */}
        <div className="space-y-6">
          {/* Selected House Inspector */}
          <Card>
            <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Rincian Rumah Terpilih</span>
                {selectedHouse && (
                  <Badge variant="outline" className="font-mono">
                    Blok {selectedHouse.kodeBlok}/{selectedHouse.nomorRumah}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {selectedHouse ? (
                <>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase">Kepala Keluarga</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{selectedHouse.kepalaKeluarga}</p>
                    <p className="text-xs text-slate-500">{selectedHouse.alamat}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-500">Status Hunian</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedHouse.statusHunian.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-500">Total Penghuni</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedHouse.totalPenghuni} Jiwa</p>
                    </div>
                  </div>

                  {/* Vulnerability Flags Alert */}
                  {selectedHouse.vulnerabilities.anyVulnerability ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Kategori Warga Prioritas:
                      </span>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedHouse.vulnerabilities.hasLansia && <Badge variant="warning">Lansia (60+)</Badge>}
                        {selectedHouse.vulnerabilities.hasDisabilitas && <Badge variant="destructive">Disabilitas</Badge>}
                        {selectedHouse.vulnerabilities.hasBalita && <Badge variant="default">Balita</Badge>}
                        {selectedHouse.vulnerabilities.hasIbuHamil && <Badge variant="success">Ibu Hamil</Badge>}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs text-slate-500">
                      Tidak ada catatan kelompok rentan di rumah ini.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Pilih salah satu rumah pada denah untuk memeriksa data penghuni.</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Blood Donor Finder */}
          <Card>
            <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-red-600" />
                <span>Pencarian Cepat Donor Darah Warga</span>
              </CardTitle>
              <p className="text-xs text-slate-500">Tanggap darurat medis pencarian warga berdasarkan Golongan Darah</p>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {['A_POSITIF', 'B_POSITIF', 'AB_POSITIF', 'O_POSITIF'].map((gol) => (
                  <button
                    key={gol}
                    onClick={() => handleBloodSearch(gol)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      bloodTypeSearch === gol
                        ? 'bg-red-700 text-white shadow-sm'
                        : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 hover:bg-red-100'
                    }`}
                  >
                    Gol. {gol.replace('_POSITIF', '+')}
                  </button>
                ))}
              </div>

              {donorResults.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 max-h-48 overflow-y-auto">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Ditemukan {donorResults.length} Warga Terdaftar:
                  </span>
                  {donorResults.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">{d.namaLengkap}</strong>
                        <p className="text-slate-500">{d.blokRumah}</p>
                      </div>
                      <Badge variant="destructive" className="font-mono">
                        {d.golonganDarah.replace('_POSITIF', '+')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
