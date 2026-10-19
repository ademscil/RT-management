import React, { useState, useEffect } from 'react';
import {
  Users,
  Home,
  Wallet,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@simrt/ui-kit';

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

export const DashboardPage: React.FC = () => {
  const [mapData, setMapData] = useState<BlockMapHouse[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<BlockMapHouse | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VULNERABILITY' | 'IURAN'>('ALL');
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

  return (
    <div className="space-y-6">
      {/* Top Welcome & Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Penduduk</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">{totalWarga} Jiwa</h4>
              <p className="text-xs text-teal-700 font-medium mt-1">Data Terverifikasi RT</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kavling / Rumah</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">{totalRumah} Unit</h4>
              <p className="text-xs text-slate-500 font-medium mt-1">Blok A & Blok B</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Home className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-amber-200 bg-amber-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Prioritas Tanggap Darurat</p>
              <h4 className="text-2xl font-black text-amber-900 mt-1">{housesWithVulnerability} Rumah</h4>
              <p className="text-xs text-amber-700 font-medium mt-1">Lansia / Disabilitas / Balita</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Kas Operasional</p>
              <h4 className="text-2xl font-black text-emerald-900 mt-1">Rp 8.500.000</h4>
              <p className="text-xs text-emerald-700 font-medium mt-1">Hash Chain Verified</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Wallet className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Command Center: Interactive SVG Block Map & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Block Map (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle>Denah Kavling Interaktif RT 05 / RW 02</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Klik salah satu rumah untuk melihat rincian penghuni & status</p>
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterMode('VULNERABILITY')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  filterMode === 'VULNERABILITY'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-700 hover:bg-amber-100/50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Tanggap Darurat
              </button>
              <button
                onClick={() => setFilterMode('IURAN')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterMode === 'IURAN' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Status Iuran
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* SVG Rendered Map */}
            <div className="relative w-full h-[380px] bg-slate-950 rounded-2xl p-6 overflow-hidden flex items-center justify-center border border-slate-800">
              <svg viewBox="0 0 700 350" className="w-full h-full">
                {/* Road / Street */}
                <rect x="50" y="150" width="600" height="50" fill="#1e293b" rx="6" />
                <line x1="60" y1="175" x2="640" y2="175" stroke="#475569" strokeWidth="2" strokeDasharray="10 10" />
                <text x="320" y="179" fill="#94a3b8" fontSize="11" fontFamily="sans-serif" fontWeight="bold">
                  JL. UTAMA RT 05 / RW 02
                </text>

                {/* Render Houses Grid */}
                {mapData.map((house, idx) => {
                  const isTopRow = house.gridX === 1;
                  const xPos = 80 + (idx % 3) * 190;
                  const yPos = isTopRow ? 40 : 220;
                  const isSelected = selectedHouse?.id === house.id;

                  // Determine color based on filter
                  let fillColor = '#0f766e'; // Default Teal
                  if (filterMode === 'VULNERABILITY') {
                    fillColor = house.vulnerabilities.anyVulnerability ? '#f59e0b' : '#334155';
                  } else if (filterMode === 'IURAN') {
                    fillColor = house.iuranStatus === 'PAID' ? '#15803d' : '#b91c1c';
                  } else {
                    if (house.statusHunian === 'DIHUNI_PENYEWA') fillColor = '#3b82f6';
                    if (house.statusHunian === 'KOSONG') fillColor = '#64748b';
                  }

                  return (
                    <g
                      key={house.id}
                      onClick={() => setSelectedHouse(house)}
                      className="cursor-pointer transition-transform hover:opacity-90"
                    >
                      {/* House Box */}
                      <rect
                        x={xPos}
                        y={yPos}
                        width="150"
                        height="85"
                        rx="12"
                        fill={fillColor}
                        stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)'}
                        strokeWidth={isSelected ? '3' : '1'}
                      />

                      {/* House Number Text */}
                      <text
                        x={xPos + 16}
                        y={yPos + 32}
                        fill="#ffffff"
                        fontSize="14"
                        fontFamily="sans-serif"
                        fontWeight="bold"
                      >
                        Blok {house.kodeBlok}/{house.nomorRumah}
                      </text>

                      {/* Head of Family */}
                      <text
                        x={xPos + 16}
                        y={yPos + 52}
                        fill="rgba(255,255,255,0.8)"
                        fontSize="10"
                        fontFamily="sans-serif"
                      >
                        {house.kepalaKeluarga.substring(0, 18)}
                      </text>

                      {/* Vulnerability Alert Beacon */}
                      {house.vulnerabilities.anyVulnerability && (
                        <circle
                          cx={xPos + 130}
                          cy={yPos + 20}
                          r="6"
                          fill="#ef4444"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-xs text-slate-600">
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
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Lansia/Disabilitas Terdaftar
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Split Inspector Panel (1 col) */}
        <div className="space-y-6">
          {/* Selected House Inspector */}
          <Card>
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Rincian Kavling</span>
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
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedHouse.kepalaKeluarga}</p>
                    <p className="text-xs text-slate-500">{selectedHouse.alamat}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-[11px] text-slate-500">Status Hunian</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedHouse.statusHunian}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-[11px] text-slate-500">Total Penghuni</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedHouse.totalPenghuni} Jiwa</p>
                    </div>
                  </div>

                  {/* Vulnerability Flags Alert */}
                  {selectedHouse.vulnerabilities.anyVulnerability ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Kategori Kerentanan Terdaftar:
                      </span>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedHouse.vulnerabilities.hasLansia && <Badge variant="warning">Lansia (60+)</Badge>}
                        {selectedHouse.vulnerabilities.hasDisabilitas && <Badge variant="destructive">Disabilitas</Badge>}
                        {selectedHouse.vulnerabilities.hasBalita && <Badge variant="default">Balita</Badge>}
                        {selectedHouse.vulnerabilities.hasIbuHamil && <Badge variant="success">Ibu Hamil</Badge>}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-500">
                      Tidak ada catatan kelompok rentan pada rumah ini.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Pilih salah satu rumah pada peta untuk memeriksa rincian.</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Blood Donor Finder (Emergency Medical Feature) */}
          <Card>
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-red-600" />
                <span>Pencarian Cepat Donor Darah</span>
              </CardTitle>
              <p className="text-xs text-slate-500">Tanggap darurat medis pencarian warga berdasarkan Golongan Darah</p>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {['A_POSITIF', 'B_POSITIF', 'AB_POSITIF', 'O_POSITIF'].map((gol) => (
                  <button
                    key={gol}
                    onClick={() => handleBloodSearch(gol)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      bloodTypeSearch === gol
                        ? 'bg-red-700 text-white shadow-sm'
                        : 'bg-red-50 text-red-800 hover:bg-red-100'
                    }`}
                  >
                    Gol. {gol.replace('_POSITIF', '+')}
                  </button>
                ))}
              </div>

              {donorResults.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                  <span className="text-xs font-semibold text-slate-600">Ditemukan {donorResults.length} Warga:</span>
                  {donorResults.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <strong className="text-slate-800">{d.namaLengkap}</strong>
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
