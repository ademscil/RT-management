import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  CheckCircle2,
  PenTool,
  Printer,
  PlusCircle,
  Eye,
  X,
  QrCode,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/auth-context.js';
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

interface TemplateSurat {
  id: string;
  kodeSurat: string;
  namaSurat: string;
  formatNomor: string;
}

interface WargaOption {
  id: string;
  namaLengkap: string;
  blokRumah: string;
}

export const SuratPage: React.FC = () => {
  const { user } = useAuth();
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

  // A4 Letter Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<SuratItem | null>(null);
  const [nomorSuratInput, setNomorSuratInput] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  // Walk-in / Direct Letter Modal State
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSurat[]>([]);
  const [wargaOptions, setWargaOptions] = useState<WargaOption[]>([]);
  const [selectedWargaId, setSelectedWargaId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [walkinKeperluan, setWalkinKeperluan] = useState('');
  const [isSubmittingWalkin, setIsSubmittingWalkin] = useState(false);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setMeta((prev) => ({ ...prev, page: 1 }));
  }, []);

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

  // Load templates & warga for walk-in modal
  useEffect(() => {
    async function loadWalkinData() {
      try {
        const [tmplRes, wargaRes] = await Promise.allSettled([
          api.get<TemplateSurat[]>('/surat/templates'),
          api.get<{ items: WargaOption[] }>('/kependudukan/warga', { limit: 100 }),
        ]);

        if (tmplRes.status === 'fulfilled') {
          const tmpl = tmplRes.value;
          setTemplates(tmpl);
          if (tmpl.length > 0) setSelectedTemplateId(tmpl[0].id);
        }

        if (wargaRes.status === 'fulfilled') {
          const w = wargaRes.value;
          setWargaOptions(w.items);
          if (w.items.length > 0) setSelectedWargaId(w.items[0].id);
        }
      } catch {
        // Silently fallback
      }
    }
    loadWalkinData();
  }, []);

  const handleVerifySecretary = async (suratId: string, isApproved: boolean) => {
    try {
      await api.post('/surat/verifikasi', {
        suratId,
        isApproved,
        catatan: isApproved ? 'Lolos verifikasi berkas administrasi.' : 'Berkas belum memenuhi persyaratan.',
      });

      notify.success({
        title: isApproved ? 'Surat Telah Diverifikasi' : 'Surat Ditolak',
        description: isApproved
          ? 'Surat diteruskan ke antrean Ketua RT untuk ditandatangani.'
          : 'Catatan penolakan telah diteruskan ke pemohon.',
      });

      fetchSurat(meta.page, meta.limit, search, activeStatusTab);
      if (previewModalOpen) setPreviewModalOpen(false);
    } catch (err: any) {
      notify.error({ title: 'Gagal Verifikasi', description: err.message });
    }
  };

  const handleOpenPreviewModal = (surat: SuratItem) => {
    setSelectedSurat(surat);
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const currentMonth = romanMonths[new Date().getMonth()];
    const currentYear = new Date().getFullYear();
    setNomorSuratInput(surat.nomorSuratResmi || `045/RT05-RW02/SKP/${currentMonth}/${currentYear}`);
    setPreviewModalOpen(true);
  };

  const handleExecuteSign = async () => {
    if (!selectedSurat) return;
    setIsSigning(true);
    try {
      const res = await api.post<{ verificationHash: string; signatureHex: string }>('/surat/tanda-tangan', {
        suratId: selectedSurat.id,
        nomorSuratResmi: nomorSuratInput,
      });

      setPreviewModalOpen(false);
      notify.success({
        title: 'Surat Resmi Berhasil Diterbitkan',
        description: `Tanda tangan digital Ketua RT & Kode QR resmi tersemat (#${res.verificationHash.substring(0, 8)}).`,
      });

      fetchSurat(meta.page, meta.limit, search, activeStatusTab);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menandatangani Surat', description: err.message });
    } finally {
      setIsSigning(false);
    }
  };

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWargaId || !selectedTemplateId || !walkinKeperluan) {
      notify.error({ title: 'Data Belum Lengkap', description: 'Mohon isi semua data permohonan surat.' });
      return;
    }

    setIsSubmittingWalkin(true);
    try {
      await api.post('/surat/ajukan', {
        jenisSuratId: selectedTemplateId,
        keperluan: walkinKeperluan,
      });

      setWalkinModalOpen(false);
      setWalkinKeperluan('');
      notify.success({
        title: 'Permohonan Surat Berhasil Dibuat',
        description: 'Surat telah masuk ke antrean verifikasi RT.',
      });

      fetchSurat(meta.page, meta.limit, search, activeStatusTab);
    } catch (err: any) {
      notify.error({ title: 'Gagal Membuat Surat', description: err.message });
    } finally {
      setIsSubmittingWalkin(false);
    }
  };

  const statusBadges: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'pii' }> = {
    SUBMITTED: { label: 'Perlu Cek Sekretaris', variant: 'warning' },
    VERIFIED_SEKRETARIS: { label: 'Siap TTD Ketua RT', variant: 'default' },
    SIGNED_KETUA_RT: { label: 'Resmi Ditandatangani', variant: 'success' },
    REJECTED: { label: 'Ditolak', variant: 'destructive' },
  };

  const isKetuaRt = user?.role === 'KETUA_RT';
  const isSekretaris = user?.role === 'SEKRETARIS';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-teal-700" />
            Pelayanan Surat Pengantar Warga
          </h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Alur pengajuan:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Verifikasi Berkas Sekretaris RT</span>
            <span className="text-teal-600 font-bold">→</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Tanda Tangan Digital Ketua RT</span>
            <span className="text-teal-600 font-bold">→</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Cetak Surat Ber-QR</span>
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setWalkinModalOpen(true)}
          className="text-xs font-bold"
        >
          <PlusCircle className="w-4 h-4" /> Buat Surat Langsung (Warga Datang)
        </Button>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: '', label: 'Semua Status' },
          { id: 'SUBMITTED', label: 'Menunggu Cek Sekretaris' },
          { id: 'VERIFIED_SEKRETARIS', label: 'Menunggu TTD Ketua RT' },
          { id: 'SIGNED_KETUA_RT', label: 'Selesai / Siap Cetak' },
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
            placeholder="Cari nomor surat, tiket, nama pemohon, atau keperluan..."
            onChange={handleSearchChange}
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
              actionLabel="Buat Surat Baru"
              onAction={() => setWalkinModalOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">No. Tiket / Tanggal</th>
                    <th className="py-3.5 px-4">Jenis Surat</th>
                    <th className="py-3.5 px-4">Pemohon & Rumah</th>
                    <th className="py-3.5 px-4">Keperluan</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Tindakan Pengurus</th>
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
                          {/* Tombol Preview Surat Fisik A4 */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPreviewModal(s)}
                            className="text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-teal-700" /> Pratinjau Surat
                          </Button>

                          {/* Tombol Cepat Sekretaris */}
                          {s.status === 'SUBMITTED' && (isSekretaris || isKetuaRt) && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleVerifySecretary(s.id, true)}
                              className="text-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                            </Button>
                          )}

                          {/* Tombol Tanda Tangan Ketua RT */}
                          {s.status === 'VERIFIED_SEKRETARIS' && isKetuaRt && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenPreviewModal(s)}
                              className="text-xs bg-violet-700 hover:bg-violet-800"
                            >
                              <PenTool className="w-3.5 h-3.5" /> Tanda Tangan
                            </Button>
                          )}

                          {/* Selesai: Cetak */}
                          {s.status === 'SIGNED_KETUA_RT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPreviewModal(s)}
                              className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                            >
                              <Printer className="w-3.5 h-3.5" /> Cetak
                            </Button>
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

      {/* MODAL 1: A4 Surat Fisik Preview & Signing Modal */}
      {previewModalOpen && selectedSurat && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-8 overflow-hidden">
            {/* Top Toolbar */}
            <div className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Pratinjau Lembar Surat Resmi RT 05 / RW 02 (Standar A4)
                </span>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* A4 Paper Document Canvas Preview */}
            <div className="p-6 md:p-8 overflow-y-auto max-h-[70vh] bg-slate-200/60 dark:bg-slate-950/70 flex justify-center">
              <div className="w-full max-w-xl bg-white text-slate-900 shadow-xl border border-slate-300 p-8 rounded-sm font-serif text-xs leading-relaxed select-text">
                {/* Kop Surat Resmi RT */}
                <div className="text-center border-b-2 border-black pb-3 mb-5">
                  <h3 className="font-bold text-sm tracking-wider uppercase">
                    RUKUN TETANGGA 05 / RUKUN WARGA 02
                  </h3>
                  <h4 className="font-bold text-xs uppercase">
                    KELURAHAN SUKAMAJU, KECAMATAN CILODONG, KOTA DEPOK
                  </h4>
                  <p className="text-[10px] italic font-sans text-slate-600 mt-0.5">
                    Alamat: Jl. Utama RT 05/02 Sukamaju, Cilodong, Kota Depok, Jawa Barat 16415
                  </p>
                </div>

                {/* Judul Surat */}
                <div className="text-center mb-6">
                  <h4 className="font-bold text-xs tracking-wider uppercase underline">
                    SURAT KETERANGAN PENGANTAR
                  </h4>
                  <p className="text-[11px] font-sans font-semibold text-slate-700 mt-0.5">
                    Nomor: {selectedSurat.nomorSuratResmi || nomorSuratInput}
                  </p>
                </div>

                {/* Pembuka */}
                <p className="mb-3 text-justify">
                  Yang bertanda tangan di bawah ini Ketua Rukun Tetangga (RT) 05 / RW 02 Kelurahan Sukamaju, Kecamatan Cilodong, Kota Depok, dengan ini menerangkan bahwa:
                </p>

                {/* Data Pemohon */}
                <table className="w-full mb-4 text-xs">
                  <tbody>
                    <tr>
                      <td className="w-36 py-0.5 text-slate-600">Nama Lengkap</td>
                      <td className="w-4">:</td>
                      <td className="font-bold uppercase">{selectedSurat.pemohonNama}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-slate-600">Nomor Induk Kependudukan</td>
                      <td>:</td>
                      <td className="font-mono">{selectedSurat.pemohonNikMasked}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-slate-600">Alamat Domisili</td>
                      <td>:</td>
                      <td>{selectedSurat.blokRumah}, RT 05 / RW 02 Kel. Sukamaju</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-slate-600">Jenis Permohonan</td>
                      <td>:</td>
                      <td className="font-semibold">{selectedSurat.jenisSuratNama}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Keperluan */}
                <p className="mb-3 text-justify">
                  Orang tersebut di atas adalah benar-benar warga kami yang berdomisili pada alamat tersebut dan surat keterangan pengantar ini dibuat untuk keperluan:
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md font-sans italic text-slate-800 mb-4">
                  "{selectedSurat.keperluan}"
                </div>

                {/* Penutup */}
                <p className="mb-8 text-justify">
                  Demikian surat keterangan ini kami berikan agar dapat dipergunakan sebagaimana mestinya oleh instansi yang bersangkutan.
                </p>

                {/* Bagian Tanda Tangan & QR Resmi */}
                <div className="flex items-end justify-between pt-4">
                  {/* QR Code Verifikasi */}
                  <div className="text-center space-y-1">
                    <div className="w-20 h-20 border border-slate-300 p-1 flex items-center justify-center bg-slate-50 rounded">
                      <QrCode className="w-16 h-16 text-slate-800" />
                    </div>
                    <span className="text-[9px] font-sans text-slate-500 block">Scan Verifikasi Resmi</span>
                  </div>

                  {/* Pengesahan Ketua RT */}
                  <div className="text-center font-sans">
                    <p className="text-xs mb-1">
                      Depok, {new Date(selectedSurat.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs font-bold mb-4">Ketua RT 05 / RW 02</p>

                    {/* Cap & Tanda Tangan Visual */}
                    <div className="relative py-2 flex items-center justify-center">
                      <div className="w-24 h-12 rounded-full border-2 border-teal-800/60 rotate-[-12deg] flex items-center justify-center text-[10px] font-black text-teal-800 uppercase tracking-widest opacity-80 pointer-events-none">
                        TERVERIFIKASI
                      </div>
                    </div>

                    <p className="text-xs font-bold underline mt-1">BAMBANG PAMUNGKAS, S.T.</p>
                    <p className="text-[10px] text-slate-500 font-mono">Tanda Tangan Digital Sah</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span>Status:</span>
                <Badge variant={statusBadges[selectedSurat.status]?.variant || 'default'}>
                  {statusBadges[selectedSurat.status]?.label || selectedSurat.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewModalOpen(false)}>
                  Tutup
                </Button>

                {/* Action for Secretary to approve */}
                {selectedSurat.status === 'SUBMITTED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleVerifySecretary(selectedSurat.id, true)}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Verifikasi Berkas
                  </Button>
                )}

                {/* Action for Chairman to sign */}
                {selectedSurat.status === 'VERIFIED_SEKRETARIS' && isKetuaRt && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExecuteSign}
                    isLoading={isSigning}
                    className="bg-violet-700 hover:bg-violet-800 font-bold"
                  >
                    <PenTool className="w-4 h-4" /> Setujui & Tanda Tangani Digital
                  </Button>
                )}

                {/* Print button when signed */}
                {selectedSurat.status === 'SIGNED_KETUA_RT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.print()}
                    className="bg-teal-700 hover:bg-teal-800"
                  >
                    <Printer className="w-4 h-4" /> Cetak Lembar Surat Ini
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Buat Surat Langsung (Walk-In Offline Resident) */}
      {walkinModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Buat Surat Pengantar Langsung
                  </h3>
                  <p className="text-[11px] text-slate-500">Pelayanan untuk warga lansia atau yang datang tatap muka</p>
                </div>
              </div>
              <button onClick={() => setWalkinModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWalkinSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label htmlFor="walkin-warga-select" className="font-semibold text-slate-700 dark:text-slate-300">Pilih Warga Pemohon:</label>
                <select
                  id="walkin-warga-select"
                  name="wargaId"
                  value={selectedWargaId}
                  onChange={(e) => setSelectedWargaId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  {wargaOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.namaLengkap} ({w.blokRumah})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="walkin-template-select" className="font-semibold text-slate-700 dark:text-slate-300">Jenis Surat Pengantar:</label>
                <select
                  id="walkin-template-select"
                  name="templateId"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.namaSurat} ({t.kodeSurat})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="walkin-keperluan-textarea" className="font-semibold text-slate-700 dark:text-slate-300">Keperluan Surat:</label>
                <textarea
                  id="walkin-keperluan-textarea"
                  name="keperluan"
                  rows={3}
                  value={walkinKeperluan}
                  onChange={(e) => setWalkinKeperluan(e.target.value)}
                  placeholder="Contoh: Mengurus perpanjangan KTP di Kelurahan Sukamaju / Pengurusan rekening bank..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setWalkinModalOpen(false)} disabled={isSubmittingWalkin}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSubmittingWalkin}>
                  Terbitkan Permohonan
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
