import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileCheck, Eye, Check, X, Shield, PlusCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/auth-context.js';
import {
  Card,
  CardContent,
  Button,
  Badge,
  SearchInput,
  PaginationControl,
  PiiRevealModal,
  ForensicWatermarkedImageViewer,
  SkeletonTable,
  EmptyStateCard,
  notify,
} from '@simrt/ui-kit';
import type { PaginationMeta, PiiAccessReason } from '@simrt/shared-types';

interface WargaItem {
  id: string;
  namaLengkap: string;
  nikMasked: string;
  tempatLahir: string;
  tanggalLahir: string;
  gender: string;
  golonganDarah: string;
  agama: string;
  pekerjaan: string;
  statusPerkawinan: string;
  hubunganKeluarga: string;
  statusKependudukan: string;
  isLansia: boolean;
  isDisabilitas: boolean;
  blokRumah: string;
  alamatDomisili: string;
  statusVerifikasiKk: string;
}

interface HouseOption {
  id: string;
  kodeBlok: string;
  nomorRumah: string;
  kartuKeluarga: Array<{ id: string }>;
}

export const KependudukanPage: React.FC = () => {
  const { user } = useAuth();
  const [wargaList, setWargaList] = useState<WargaItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [search, setSearch] = useState('');
  const [golDarahFilter, setGolDarahFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // PII Reveal Modal State
  const [piiModalOpen, setPiiModalOpen] = useState(false);
  const [piiTargetWarga, setPiiTargetWarga] = useState<WargaItem | null>(null);
  const [revealedNiks, setRevealedNiks] = useState<Record<string, string>>({});
  const [isRevealing, setIsRevealing] = useState(false);

  // Workbench Modal State (Periksa Dokumen)
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [workbenchWarga, setWorkbenchWarga] = useState<WargaItem | null>(null);

  // Tambah Warga Baru Modal State
  const [tambahModalOpen, setTambahModalOpen] = useState(false);
  const [houses, setHouses] = useState<HouseOption[]>([]);
  const [formNama, setFormNama] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formTempatLahir, setFormTempatLahir] = useState('Depok');
  const [formTanggalLahir, setFormTanggalLahir] = useState('1990-01-01');
  const [formGender, setFormGender] = useState('LAKI_LAKI');
  const [formGolDarah, setFormGolDarah] = useState('O_POSITIF');
  const [formAgama, setFormAgama] = useState('ISLAM');
  const [formPekerjaan, setFormPekerjaan] = useState('Karyawan Swasta');
  const [formHubungan, setFormHubungan] = useState('KEPALA_KELUARGA');
  const [formStatusKawin, setFormStatusKawin] = useState('KAWIN');
  const [formStatusKependudukan, setFormStatusKependudukan] = useState('TETAP');
  const [formSelectedKkId, setFormSelectedKkId] = useState('');
  const [formIsLansia, setFormIsLansia] = useState(false);
  const [formIsDisabilitas, setFormIsDisabilitas] = useState(false);
  const [formIsBalita, setFormIsBalita] = useState(false);
  const [isSavingWarga, setIsSavingWarga] = useState(false);

  const fetchWarga = useCallback(
    async (page: number, limit: number, query: string, golDarah: string) => {
      setIsLoading(true);
      try {
        const res = await api.get<{ items: WargaItem[]; meta: PaginationMeta }>('/kependudukan/warga', {
          page,
          limit,
          search: query || undefined,
          golonganDarah: golDarah || undefined,
        });
        setWargaList(res.items);
        setMeta(res.meta);
      } catch (err: any) {
        notify.error({
          title: 'Gagal Memuat Data Warga',
          description: err.message,
        });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchWarga(meta.page, meta.limit, search, golDarahFilter);
  }, [fetchWarga, meta.page, meta.limit, search, golDarahFilter]);

  // Load houses for Tambah Warga
  useEffect(() => {
    async function loadHouses() {
      try {
        const res = await api.get<any[]>('/kependudukan/map');
        if (res && res.length > 0) {
          // fetch KKs list
          const kkRes = await api.get<{ items: Array<{ id: string; blokRumah: string; kepalaKeluarga: string }> }>('/kependudukan/kk');
          if (kkRes.items && kkRes.items.length > 0) {
            setFormSelectedKkId(kkRes.items[0].id);
            setHouses(kkRes.items.map((k) => ({
              id: k.id,
              kodeBlok: k.blokRumah,
              nomorRumah: k.kepalaKeluarga,
              kartuKeluarga: [{ id: k.id }],
            })));
          }
        }
      } catch {
        // Silently fallback
      }
    }
    loadHouses();
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setMeta((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleOpenPiiModal = (warga: WargaItem) => {
    setPiiTargetWarga(warga);
    setPiiModalOpen(true);
  };

  const handleConfirmPii = async (reason: PiiAccessReason) => {
    if (!piiTargetWarga) return;
    setIsRevealing(true);
    try {
      const res = await api.post<{ value: string; auditId: string }>('/kependudukan/reveal-pii', {
        wargaId: piiTargetWarga.id,
        field: 'NIK',
        reason,
      });

      setRevealedNiks((prev) => ({ ...prev, [piiTargetWarga.id]: res.value }));
      setPiiModalOpen(false);

      notify.security({
        title: 'NIK Lengkap Terbuka',
        description: `NIK ${piiTargetWarga.namaLengkap} dibuka untuk keperluan: ${reason}`,
        auditId: res.auditId,
      });
    } catch (err: any) {
      notify.error({
        title: 'Gagal Membuka NIK',
        description: err.message,
        errorCode: err.code,
      });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleOpenWorkbench = (warga: WargaItem) => {
    setWorkbenchWarga(warga);
    setWorkbenchOpen(true);
  };

  const handleSaveWarga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama || !formNik || formNik.length !== 16 || !formSelectedKkId) {
      notify.error({
        title: 'Data Belum Lengkap',
        description: 'Nama Lengkap, NIK 16 digit, dan Kartu Keluarga wajib diisi.',
      });
      return;
    }

    setIsSavingWarga(true);
    try {
      await api.post('/kependudukan/warga', {
        kkId: formSelectedKkId,
        namaLengkap: formNama,
        nik: formNik,
        tempatLahir: formTempatLahir,
        tanggalLahir: formTanggalLahir,
        gender: formGender,
        golonganDarah: formGolDarah,
        agama: formAgama,
        pendidikanTerakhir: 'S1',
        pekerjaan: formPekerjaan,
        statusPerkawinan: formStatusKawin,
        hubunganKeluarga: formHubungan,
        statusKependudukan: formStatusKependudukan,
        isLansia: formIsLansia,
        isDisabilitas: formIsDisabilitas,
        isBalita: formIsBalita,
        isIbuHamil: false,
      });

      setTambahModalOpen(false);
      setFormNama('');
      setFormNik('');
      notify.success({
        title: 'Warga Berhasil Ditambahkan',
        description: `Data ${formNama} telah tersimpan di Buku Induk Kependudukan RT.`,
      });

      fetchWarga(meta.page, meta.limit, search, golDarahFilter);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menambahkan Warga', description: err.message });
    } finally {
      setIsSavingWarga(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-700" />
            Buku Induk Kependudukan RT 05 / RW 02
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Data kependudukan warga tersimpan aman dan terenkripsi sesuai UU Perlindungan Data Pribadi (UU PDP)
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setTambahModalOpen(true)}
          className="text-xs font-bold"
        >
          <PlusCircle className="w-4 h-4" /> Daftarkan Warga Baru
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <SearchInput
            placeholder="Cari nama warga, NIK, atau nomor rumah... (tekan /)"
            onChange={handleSearchChange}
            isLoading={isLoading}
            className="w-full sm:max-w-md"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              id="filter-golongan-darah"
              name="golDarahFilter"
              aria-label="Filter Golongan Darah"
              value={golDarahFilter}
              onChange={(e) => {
                setGolDarahFilter(e.target.value);
                setMeta((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-600 outline-none"
            >
              <option value="">Semua Gol. Darah</option>
              <option value="A_POSITIF">Gol. A+</option>
              <option value="B_POSITIF">Gol. B+</option>
              <option value="AB_POSITIF">Gol. AB+</option>
              <option value="O_POSITIF">Gol. O+</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={8} columns={6} />
            </div>
          ) : wargaList.length === 0 ? (
            <EmptyStateCard
              title="Tidak Ada Data Warga Ditemukan"
              description="Coba ubah kata kunci pencarian atau reset filter golongan darah."
              actionLabel="Reset Pencarian"
              onAction={() => {
                setSearch('');
                setGolDarahFilter('');
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-3.5 px-4">Nama Lengkap & Hubungan</th>
                    <th className="py-3.5 px-4">Nomor NIK</th>
                    <th className="py-3.5 px-4">Kavling / Domisili</th>
                    <th className="py-3.5 px-4">TTL & Kelamin</th>
                    <th className="py-3.5 px-4">Gol. Darah</th>
                    <th className="py-3.5 px-4 text-right">Tindakan Berkas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {wargaList.map((w) => {
                    const isRevealed = !!revealedNiks[w.id];
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{w.namaLengkap}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant={w.hubunganKeluarga === 'KEPALA_KELUARGA' ? 'default' : 'outline'} className="text-[10px]">
                              {w.hubunganKeluarga.replace('_', ' ')}
                            </Badge>
                            {w.isLansia && <Badge variant="warning" className="text-[10px]">Lansia</Badge>}
                            {w.isDisabilitas && <Badge variant="destructive" className="text-[10px]">Disabilitas</Badge>}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          {isRevealed ? (
                            <span className="font-bold text-teal-800 bg-teal-50 px-2 py-1 rounded-md border border-teal-200">
                              {revealedNiks[w.id]}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-600 dark:text-slate-400">{w.nikMasked}</span>
                              <button
                                onClick={() => handleOpenPiiModal(w)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Buka NIK Lengkap (Keperluan Administrasi)"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <strong className="text-slate-900 dark:text-slate-200">{w.blokRumah}</strong>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">{w.alamatDomisili}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <div>{w.tempatLahir}, {w.tanggalLahir}</div>
                          <span className="text-[11px] text-slate-500">{w.gender === 'LAKI_LAKI' ? 'Laki-Laki' : 'Perempuan'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge variant="destructive" className="font-mono text-[10px]">
                            {w.golonganDarah.replace('_POSITIF', '+').replace('_NEGATIF', '-')}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenWorkbench(w)}
                            className="text-xs"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-teal-700" /> Periksa Berkas
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="border-t border-slate-100 dark:border-slate-800 p-2">
            <PaginationControl
              meta={meta}
              onPageChange={(p) => setMeta((prev) => ({ ...prev, page: p }))}
              onLimitChange={(l) => setMeta((prev) => ({ ...prev, limit: l, page: 1 }))}
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* PII Reveal Confirmation Modal */}
      {piiTargetWarga && (
        <PiiRevealModal
          isOpen={piiModalOpen}
          onClose={() => setPiiModalOpen(false)}
          wargaNama={piiTargetWarga.namaLengkap}
          field="NIK"
          onConfirm={handleConfirmPii}
          isLoading={isRevealing}
        />
      )}

      {/* MODAL: Periksa Berkas KTP/KK Warga */}
      {workbenchOpen && workbenchWarga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal-700" /> Pemeriksaan & Pencocokan Berkas Dokumen Warga
                </h3>
                <p className="text-xs text-slate-500">
                  Warga: <strong>{workbenchWarga.namaLengkap}</strong> ({workbenchWarga.blokRumah})
                </p>
              </div>
              <button
                onClick={() => setWorkbenchOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Panels */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {/* Left Panel: Foto Dokumen */}
              <div className="p-4 flex flex-col h-full bg-slate-950">
                <ForensicWatermarkedImageViewer
                  imageSrc="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='380' viewBox='0 0 600 380'><rect width='600' height='380' fill='%231e293b' rx='16'/><text x='50' y='50' fill='%23ffffff' font-family='sans-serif' font-size='20' font-weight='bold'>REPUBLIK INDONESIA - KTP SAMPLE</text><rect x='50' y='80' width='120' height='160' fill='%23334155' rx='8'/><text x='200' y='100' fill='%2394a3b8' font-size='14'>NIK: 327601************</text><text x='200' y='130' fill='%23ffffff' font-size='16' font-weight='bold'>DOKUMEN TERVERIFIKASI RT</text></svg>"
                  adminName={user?.namaLengkap || 'PENGURUS RT'}
                  adminIp="127.0.0.1"
                  className="h-full"
                />
              </div>

              {/* Right Panel: Form Validasi */}
              <div className="p-6 overflow-y-auto space-y-5">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-2">
                    Cocokkan Data Fisik dengan Buku Induk
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold">Nama Lengkap</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.namaLengkap}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Hubungan Keluarga</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.hubunganKeluarga.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Tempat, Tanggal Lahir</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {workbenchWarga.tempatLahir}, {workbenchWarga.tanggalLahir}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Pekerjaan</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.pekerjaan}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label htmlFor="catatan-verifikasi-berkas" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Catatan Verifikasi / Alasan Perbaikan:
                  </label>
                  <textarea
                    id="catatan-verifikasi-berkas"
                    name="catatanVerifikasi"
                    rows={3}
                    placeholder="Masukkan catatan jika ada perbaikan nama, ejaan tanggal lahir, atau foto kurang jelas..."
                    className="w-full p-3 text-xs border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={() => {
                      notify.warning({ title: 'Revisi Diminta', description: 'Permintaan perbaikan berkas telah dicatat.' });
                      setWorkbenchOpen(false);
                    }}
                  >
                    <X className="w-4 h-4" /> Minta Unggah Ulang
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      notify.success({ title: 'Berkas Sah Diverifikasi', description: 'Data kependudukan telah diverifikasi oleh pengurus.' });
                      setWorkbenchOpen(false);
                    }}
                  >
                    <Check className="w-4 h-4" /> Setujui Berkas Warga
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Daftarkan Warga Baru Manual */}
      {tambahModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Daftarkan Warga Baru ke Buku Induk
                  </h3>
                  <p className="text-[11px] text-slate-500">Pendaftaran manual untuk warga baru atau pendatang</p>
                </div>
              </div>
              <button onClick={() => setTambahModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarga} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="warga-baru-kk-id" className="font-semibold text-slate-700 dark:text-slate-300">Pilih Rumah / Kartu Keluarga:</label>
                <select
                  id="warga-baru-kk-id"
                  name="kkId"
                  value={formSelectedKkId}
                  onChange={(e) => setFormSelectedKkId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.kodeBlok} - KK: {h.nomorRumah}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-nama" className="font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap (Sesuai KTP):</label>
                  <input
                    id="warga-baru-nama"
                    name="namaLengkap"
                    type="text"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="warga-baru-nik" className="font-semibold text-slate-700 dark:text-slate-300">NIK (16 Digit):</label>
                  <input
                    id="warga-baru-nik"
                    name="nik"
                    type="text"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value.replace(/\D/g, '').substring(0, 16))}
                    placeholder="Contoh: 3276012304900001"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-tempat-lahir" className="font-semibold text-slate-700 dark:text-slate-300">Tempat Lahir:</label>
                  <input
                    id="warga-baru-tempat-lahir"
                    name="tempatLahir"
                    type="text"
                    value={formTempatLahir}
                    onChange={(e) => setFormTempatLahir(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-tanggal-lahir" className="font-semibold text-slate-700 dark:text-slate-300">Tanggal Lahir:</label>
                  <input
                    id="warga-baru-tanggal-lahir"
                    name="tanggalLahir"
                    type="date"
                    value={formTanggalLahir}
                    onChange={(e) => setFormTanggalLahir(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-gender" className="font-semibold text-slate-700 dark:text-slate-300">Jenis Kelamin:</label>
                  <select
                    id="warga-baru-gender"
                    name="gender"
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="LAKI_LAKI">Laki-Laki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-gol-darah" className="font-semibold text-slate-700 dark:text-slate-300">Gol. Darah:</label>
                  <select
                    id="warga-baru-gol-darah"
                    name="golDarah"
                    value={formGolDarah}
                    onChange={(e) => setFormGolDarah(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  >
                    <option value="A_POSITIF">A+</option>
                    <option value="B_POSITIF">B+</option>
                    <option value="AB_POSITIF">AB+</option>
                    <option value="O_POSITIF">O+</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-hubungan" className="font-semibold text-slate-700 dark:text-slate-300">Hubungan:</label>
                  <select
                    id="warga-baru-hubungan"
                    name="hubungan"
                    value={formHubungan}
                    onChange={(e) => setFormHubungan(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="KEPALA_KELUARGA">Kepala Keluarga</option>
                    <option value="ISTRI">Istri</option>
                    <option value="ANAK">Anak</option>
                    <option value="FAMILI_LAIN">Famili Lain</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-pekerjaan" className="font-semibold text-slate-700 dark:text-slate-300">Pekerjaan:</label>
                  <input
                    id="warga-baru-pekerjaan"
                    name="pekerjaan"
                    type="text"
                    value={formPekerjaan}
                    onChange={(e) => setFormPekerjaan(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-agama" className="font-semibold text-slate-700 dark:text-slate-300">Agama:</label>
                  <select
                    id="warga-baru-agama"
                    name="agama"
                    value={formAgama}
                    onChange={(e) => setFormAgama(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="ISLAM">Islam</option>
                    <option value="KRISTEN">Kristen</option>
                    <option value="KATOLIK">Katolik</option>
                    <option value="HINDU">Hindu</option>
                    <option value="BUDDHA">Buddha</option>
                    <option value="KONGHUCU">Konghucu</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-status-kawin" className="font-semibold text-slate-700 dark:text-slate-300">Status Kawin:</label>
                  <select
                    id="warga-baru-status-kawin"
                    name="statusKawin"
                    value={formStatusKawin}
                    onChange={(e) => setFormStatusKawin(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="KAWIN">Kawin</option>
                    <option value="BELUM_KAWIN">Belum Kawin</option>
                    <option value="CERAI_HIDUP">Cerai Hidup</option>
                    <option value="CERAI_MATI">Cerai Mati</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="warga-baru-status-kependudukan" className="font-semibold text-slate-700 dark:text-slate-300">Status Kependudukan:</label>
                <select
                  id="warga-baru-status-kependudukan"
                  name="statusKependudukan"
                  value={formStatusKependudukan}
                  onChange={(e) => setFormStatusKependudukan(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                >
                  <option value="TETAP">Warga Tetap</option>
                  <option value="KONTRAK">Warga Kontrak / Kos</option>
                  <option value="DOMISILI">Warga Domisili Sementara</option>
                </select>
              </div>

              {/* Vulnerability Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4">
                <label htmlFor="warga-baru-is-lansia" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="warga-baru-is-lansia"
                    name="isLansia"
                    type="checkbox"
                    checked={formIsLansia}
                    onChange={(e) => setFormIsLansia(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Lansia (60+ thn)</span>
                </label>
                <label htmlFor="warga-baru-is-disabilitas" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="warga-baru-is-disabilitas"
                    name="isDisabilitas"
                    type="checkbox"
                    checked={formIsDisabilitas}
                    onChange={(e) => setFormIsDisabilitas(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Disabilitas</span>
                </label>
                <label htmlFor="warga-baru-is-balita" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="warga-baru-is-balita"
                    name="isBalita"
                    type="checkbox"
                    checked={formIsBalita}
                    onChange={(e) => setFormIsBalita(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Balita</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setTambahModalOpen(false)} disabled={isSavingWarga}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSavingWarga}>
                  Simpan Data Warga
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
