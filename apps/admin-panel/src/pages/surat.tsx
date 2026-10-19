import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, XCircle, PenTool, ShieldCheck } from 'lucide-react';
import { api } from '../services/api.js';
import {
  Card,
  CardContent,
  Button,
  Badge,
  SearchInput,
  PaginationControl,
  SkeletonTable,
  EmptyStateCard,
  notify,
} from '@simrt/ui-kit';
import type { PaginationMeta } from '@simrt/shared-types';

interface SuratItem {
  id: string;
  nomorTiket: string;
  nomorSuratResmi: string | null;
  jenisSuratNama: string;
  pemohonNama: string;
  pemohonNikMasked: string;
  blokRumah: string;
  keperluan: string;
  status: string;
  catatanRevisi: string | null;
  verificationHash: string | null;
  createdAt: string;
}

export const SuratPage: React.FC = () => {
  const [suratList, setSuratList] = useState<SuratItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [activeStatusTab, setActiveStatusTab] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Signing Modal State
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<SuratItem | null>(null);
  const [nomorSuratInput, setNomorSuratInput] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  const fetchSurat = useCallback(
    async (page: number, limit: number, query: string, status: string) => {
      setIsLoading(true);
      try {
        const res = await api.get<{ items: SuratItem[]; meta: PaginationMeta }>('/surat', {
          page,
          limit,
          search: query || undefined,
          status: status || undefined,
        });
        setSuratList(res.items);
        setMeta(res.meta);
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Surat', description: err.message });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchSurat(meta.page, meta.limit, search, activeStatusTab);
  }, [fetchSurat, meta.page, meta.limit, search, activeStatusTab]);

  const handleVerifySecretary = async (suratId: string, isApproved: boolean) => {
    try {
      await api.post('/surat/verifikasi', {
        suratId,
        isApproved,
        catatan: isApproved ? 'Lolos verifikasi administrasi.' : 'Berkas belum memenuhi persyaratan.',
      });

      notify.success({
        title: isApproved ? 'Surat Telah Diverifikasi' : 'Surat Ditolak',
        description: 'Status surat diperbarui & notifikasi SSE terkirim ke pemohon.',
      });

      fetchSurat(meta.page, meta.limit, search, activeStatusTab);
    } catch (err: any) {
      notify.error({ title: 'Gagal Verifikasi', description: err.message });
    }
  };

  const handleOpenSignModal = (surat: SuratItem) => {
    setSelectedSurat(surat);
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const currentMonth = romanMonths[new Date().getMonth()];
    const currentYear = new Date().getFullYear();
    setNomorSuratInput(`045/RT05-RW02/SKP/${currentMonth}/${currentYear}`);
    setSignModalOpen(true);
  };

  const handleExecuteSign = async () => {
    if (!selectedSurat) return;
    setIsSigning(true);
    try {
      const res = await api.post<{ verificationHash: string; signatureHex: string }>('/surat/tanda-tangan', {
        suratId: selectedSurat.id,
        nomorSuratResmi: nomorSuratInput,
      });

      setSignModalOpen(false);
      notify.success({
        title: 'Surat Berhasil Ditandatangani Kriptografis',
        description: `Tanda tangan digital Ed25519 & PDF resmi telah dibuat (#${res.verificationHash.substring(0, 8)}).`,
      });

      fetchSurat(meta.page, meta.limit, search, activeStatusTab);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menandatangani Surat', description: err.message });
    } finally {
      setIsSigning(false);
    }
  };

  const statusBadges: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'pii' }> = {
    SUBMITTED: { label: 'Diajukan', variant: 'warning' },
    VERIFIED_SEKRETARIS: { label: 'Siap Tanda Tangan', variant: 'pii' },
    SIGNED_KETUA_RT: { label: 'Ditandatangani (Resmi)', variant: 'success' },
    REJECTED: { label: 'Ditolak', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-teal-700" />
          Maker-Checker E-Surat Pengantar RT
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Alur berjenjang: Verifikasi Sekretaris RT $\to$ Tanda Tangan Kriptografis Ed25519 oleh Ketua RT $\to$ PDF Cetak Ber-QR
        </p>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: '', label: 'Semua Status' },
          { id: 'SUBMITTED', label: 'Menunggu Verifikasi Sekretaris' },
          { id: 'VERIFIED_SEKRETARIS', label: 'Menunggu Tanda Tangan Ketua' },
          { id: 'SIGNED_KETUA_RT', label: 'Selesai Ditandatangani' },
          { id: 'REJECTED', label: 'Ditolak' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveStatusTab(tab.id);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeStatusTab === tab.id
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <SearchInput
            placeholder="Cari nomor tiket, nama pemohon, atau keperluan..."
            onChange={(val) => {
              setSearch(val);
              setMeta((prev) => ({ ...prev, page: 1 }));
            }}
            isLoading={isLoading}
            className="w-full sm:max-w-md"
          />
        </CardContent>
      </Card>

      {/* Letters Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={6} columns={6} />
            </div>
          ) : suratList.length === 0 ? (
            <EmptyStateCard
              title="Tidak Ada Pengajuan Surat"
              description="Belum ada permohonan surat pengantar dari warga pada kategori ini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">No. Tiket & Tanggal</th>
                    <th className="py-3.5 px-4">Jenis Surat</th>
                    <th className="py-3.5 px-4">Pemohon & Rumah</th>
                    <th className="py-3.5 px-4">Keperluan</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi Maker-Checker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {suratList.map((s) => {
                    const badge = statusBadges[s.status] || { label: s.status, variant: 'default' };
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono">
                          <strong className="text-slate-900 dark:text-slate-100">{s.nomorTiket}</strong>
                          <p className="text-[11px] text-slate-400">{new Date(s.createdAt).toLocaleDateString('id-ID')}</p>
                          {s.nomorSuratResmi && (
                            <span className="text-[11px] font-bold text-teal-700 block mt-0.5">
                              {s.nomorSuratResmi}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-200">
                          {s.jenisSuratNama}
                        </td>

                        <td className="py-3.5 px-4">
                          <strong>{s.pemohonNama}</strong>
                          <p className="text-[11px] text-slate-500">{s.blokRumah}</p>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs truncate" title={s.keperluan}>
                          {s.keperluan}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Sekretaris Verification */}
                          {s.status === 'SUBMITTED' && (
                            <>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleVerifySecretary(s.id, false)}
                              >
                                <XCircle className="w-3.5 h-3.5" /> Tolak
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleVerifySecretary(s.id, true)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verifikasi
                              </Button>
                            </>
                          )}

                          {/* Chairman Digital Signature */}
                          {s.status === 'VERIFIED_SEKRETARIS' && (
                            <Button
                              variant="pii"
                              size="sm"
                              onClick={() => handleOpenSignModal(s)}
                            >
                              <PenTool className="w-3.5 h-3.5" /> Tanda Tangan Ed25519
                            </Button>
                          )}

                          {/* Completed Letter QR Verification Check */}
                          {s.status === 'SIGNED_KETUA_RT' && s.verificationHash && (
                            <a
                              href={`/api/v1/surat/verify/${s.verificationHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Cek Verifikasi QR
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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

      {/* Chairman Digital Signature Modal */}
      {signModalOpen && selectedSurat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tanda Tangan Digital Ketua RT
                </h3>
                <p className="text-xs text-slate-500">Kriptografi Ed25519 & Penerbitan Nomor Surat</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
              <p>
                Pemohon: <strong>{selectedSurat.pemohonNama}</strong> ({selectedSurat.blokRumah})
              </p>
              <p>Jenis Surat: {selectedSurat.jenisSuratNama}</p>
              <p>Keperluan: {selectedSurat.keperluan}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nomor Surat Resmi Kedinasan:
              </label>
              <input
                type="text"
                value={nomorSuratInput}
                onChange={(e) => setNomorSuratInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-700 outline-none font-bold text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="outline" size="md" onClick={() => setSignModalOpen(false)} disabled={isSigning}>
                Batal
              </Button>
              <Button variant="pii" size="md" onClick={handleExecuteSign} isLoading={isSigning}>
                <PenTool className="w-4 h-4" /> Bubuhkan TTD Digital
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
