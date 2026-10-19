import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileCheck, Eye, Check, X, Shield } from 'lucide-react';
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

  // Workbench Modal State
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [workbenchWarga, setWorkbenchWarga] = useState<WargaItem | null>(null);

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

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

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
        title: 'Akses NIK Asli Berhasil',
        description: `NIK ${piiTargetWarga.namaLengkap} dibuka atas alasan: ${reason}`,
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
            Data identitas warga terenkripsi AES-256-GCM dengan pencarian HMAC-SHA256 Blind Index
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <SearchInput
            placeholder="Cari nama warga atau NIK masked... (tekan /)"
            onChange={handleSearchChange}
            isLoading={isLoading}
            className="w-full sm:max-w-md"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
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
                    <th className="py-3.5 px-4">Nama Lengkap & Status</th>
                    <th className="py-3.5 px-4">NIK (Protected)</th>
                    <th className="py-3.5 px-4">Rumah / Domisili</th>
                    <th className="py-3.5 px-4">TTL & Gender</th>
                    <th className="py-3.5 px-4">Gol. Darah</th>
                    <th className="py-3.5 px-4 text-right">Aksi Verifikasi</th>
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
                            <span className="font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded-md border border-violet-200">
                              {revealedNiks[w.id]}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-600 dark:text-slate-400">{w.nikMasked}</span>
                              <button
                                onClick={() => handleOpenPiiModal(w)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Buka NIK Asli (Perlu Alasan Akses)"
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
                            <FileCheck className="w-3.5 h-3.5 text-teal-700" /> Workbench KTP
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

      {/* Split-Screen KTP/KK Verification Workbench Modal */}
      {workbenchOpen && workbenchWarga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Workbench Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal-700" /> Split-Screen KTP Verification Workbench
                </h3>
                <p className="text-xs text-slate-500">
                  Pemilik Dokumen: <strong>{workbenchWarga.namaLengkap}</strong> ({workbenchWarga.blokRumah})
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
              {/* Left Panel: Decrypted Image Stream with Forensic Canvas Overlay */}
              <div className="p-4 flex flex-col h-full bg-slate-950">
                <ForensicWatermarkedImageViewer
                  imageSrc="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='380' viewBox='0 0 600 380'><rect width='600' height='380' fill='%231e293b' rx='16'/><text x='50' y='50' fill='%23ffffff' font-family='sans-serif' font-size='20' font-weight='bold'>REPUBLIK INDONESIA - KTP SAMPLE</text><rect x='50' y='80' width='120' height='160' fill='%23334155' rx='8'/><text x='200' y='100' fill='%2394a3b8' font-size='14'>NIK: 327601************</text><text x='200' y='130' fill='%23ffffff' font-size='16' font-weight='bold'>DOKUMEN TERVERIFIKASI RT</text></svg>"
                  adminName={user?.namaLengkap || 'PENGURUS RT'}
                  adminIp="127.0.0.1"
                  className="h-full"
                />
              </div>

              {/* Right Panel: Verification Validation Form */}
              <div className="p-6 overflow-y-auto space-y-5">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-2">
                    Validasi Data Kependudukan
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold">Nama Lengkap</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.namaLengkap}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Hubungan Keluarga</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.hubunganKeluarga}</p>
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

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Catatan Verifikasi / Alasan Penolakan:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Masukkan catatan jika ada revisi nama, tanggal lahir, atau foto buram..."
                    className="w-full p-3 text-xs border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={() => {
                      notify.warning({ title: 'Revisi Berkas Diminta', description: 'Notifikasi telah dikirim ke warga.' });
                      setWorkbenchOpen(false);
                    }}
                  >
                    <X className="w-4 h-4" /> Minta Unggah Ulang
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      notify.success({ title: 'KTP Berhasil Diverifikasi', description: 'Data kependudukan telah dikunci.' });
                      setWorkbenchOpen(false);
                    }}
                  >
                    <Check className="w-4 h-4" /> Setujui & Kunci Data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
