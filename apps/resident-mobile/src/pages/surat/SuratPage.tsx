import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Download,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Send,
  X,
} from 'lucide-react';
import { mobileApi } from '../../services/api.js';
import { Card, CardContent, Button, Badge, notify } from '@simrt/ui-kit';

interface SuratItem {
  id: string;
  nomorTiket: string;
  nomorSuratResmi: string | null;
  jenisSuratNama: string;
  keperluan: string;
  status: string;
  catatanRevisi: string | null;
  verificationHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SuratPage: React.FC = () => {
  const [suratList, setSuratList] = useState<SuratItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // New Request Form State
  const [jenisSuratList, setJenisSuratList] = useState<Array<{ id: string; nama: string; kode: string }>>([]);
  const [selectedJenisId, setSelectedJenisId] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [keteranganTambahan, setKeteranganTambahan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSurat = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await mobileApi.get<{ items: SuratItem[] }>('/surat');
      setSuratList(res.items || []);
    } catch (err: any) {
      notify.error({ title: 'Gagal Memuat Surat', description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurat();
    async function loadTemplates() {
      try {
        const templates = await mobileApi.get<Array<{ id: string; nama: string; kode: string }>>('/surat/templates');
        setJenisSuratList(templates || []);
        if (templates && templates.length > 0) {
          setSelectedJenisId(templates[0].id);
        }
      } catch {
        // Fallback static templates
        setJenisSuratList([
          { id: '1', nama: 'Surat Pengantar Umum', kode: 'SKU' },
          { id: '2', nama: 'Surat Keterangan Domisili', kode: 'SKD' },
          { id: '3', nama: 'Surat Pengantar SKCK Kepolisian', kode: 'SKCK' },
          { id: '4', nama: 'Surat Keterangan Tidak Mampu (SKTM)', kode: 'SKTM' },
          { id: '5', nama: 'Surat Keterangan Izin Usaha Mikro', kode: 'SKIUM' },
        ]);
        setSelectedJenisId('1');
      }
    }
    loadTemplates();
  }, [fetchSurat]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keperluan.trim()) {
      notify.error({ title: 'Keperluan Kosong', description: 'Tuliskan tujuan keperluan pengajuan surat ini.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await mobileApi.post('/surat/pengajuan', {
        jenisSuratId: selectedJenisId,
        keperluan: keperluan.trim(),
        keteranganTambahan: keteranganTambahan.trim() || undefined,
      });

      setModalOpen(false);
      setKeperluan('');
      setKeteranganTambahan('');

      notify.success({
        title: 'Pengajuan Surat Terkirim',
        description: 'Notifikasi telah dikirimkan ke Sekretaris RT untuk verifikasi berkas.',
      });

      fetchSurat();
    } catch (err: any) {
      notify.error({ title: 'Gagal Mengajukan Surat', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTimelineStep = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 1;
      case 'VERIFIED_SEKRETARIS':
        return 2;
      case 'SIGNED_KETUA_RT':
        return 3;
      case 'REJECTED':
        return -1;
      default:
        return 1;
    }
  };

  return (
    <div className="space-y-4 pb-24 pt-safe px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-700" />
            Layanan E-Surat RT
          </h2>
          <p className="text-xs text-slate-500">
            Pengajuan surat pengantar resmi ber-QR & tanda tangan Ed25519
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="shadow-sm font-bold text-xs"
        >
          <Plus className="w-4 h-4" /> Buat Surat
        </Button>
      </div>

      {/* Letters List */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : suratList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-slate-800 text-teal-700 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Belum Ada Pengajuan Surat</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Ajukan surat pengantar untuk keperluan KTP, Domisili, SKCK, atau perbankan langsung dari HP Anda.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" /> Ajukan Sekarang
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {suratList.map((surat) => {
            const step = getTimelineStep(surat.status);
            const isCompleted = surat.status === 'SIGNED_KETUA_RT';
            const isRejected = surat.status === 'REJECTED';

            return (
              <Card key={surat.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-4 space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-teal-700 font-bold block">
                        #{surat.nomorTiket}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">
                        {surat.jenisSuratNama}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Keperluan: <strong>{surat.keperluan}</strong>
                      </p>
                    </div>

                    <Badge
                      variant={
                        isCompleted
                          ? 'success'
                          : isRejected
                          ? 'destructive'
                          : surat.status === 'VERIFIED_SEKRETARIS'
                          ? 'pii'
                          : 'warning'
                      }
                    >
                      {isCompleted
                        ? 'Resmi Sah'
                        : isRejected
                        ? 'Ditolak'
                        : surat.status === 'VERIFIED_SEKRETARIS'
                        ? 'Siap TTD'
                        : 'Menunggu'}
                    </Badge>
                  </div>

                  {/* 3-Step Real-Time Timeline Tracker */}
                  {!isRejected ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <span className={step >= 1 ? 'text-teal-700 font-bold' : ''}>1. Diajukan</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        <span className={step >= 2 ? 'text-teal-700 font-bold' : ''}>2. Verifikasi</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        <span className={step >= 3 ? 'text-teal-700 font-bold' : ''}>3. TTD Digital</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 transition-all duration-500 rounded-full"
                          style={{ width: `${(step / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 text-red-700 rounded-2xl text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">Pengajuan Ditolak:</strong>
                        <span>{surat.catatanRevisi || 'Berkas tidak lengkap.'}</span>
                      </div>
                    </div>
                  )}

                  {/* If Letter is Signed by Chairman, provide PDF download & verification link */}
                  {isCompleted && surat.verificationHash && (
                    <div className="pt-1 flex gap-2">
                      <a
                        href={`/api/v1/surat/verify/${surat.verificationHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> Unduh PDF Resmi
                      </a>
                      <a
                        href={`/api/v1/surat/verify/${surat.verificationHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 rounded-xl bg-teal-50 text-teal-800 text-xs font-bold flex items-center gap-1 border border-teal-200"
                        title="Verifikasi QR Kriptografis"
                      >
                        <ShieldCheck className="w-4 h-4 text-teal-700" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Request Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Formulir E-Surat Pengantar RT
                </h3>
                <p className="text-xs text-slate-500">Isi data permohonan surat dengan benar</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="warga-surat-jenis" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pilih Jenis Surat:
                </label>
                <select
                  id="warga-surat-jenis"
                  name="jenisSuratId"
                  value={selectedJenisId}
                  onChange={(e) => setSelectedJenisId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {jenisSuratList.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="warga-surat-keperluan" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Keperluan Permohonan:
                </label>
                <input
                  id="warga-surat-keperluan"
                  name="keperluan"
                  type="text"
                  value={keperluan}
                  onChange={(e) => setKeperluan(e.target.value)}
                  placeholder="Contoh: Pembuatan Paspor / KTP Baru / Buka Rekening"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="warga-surat-keterangan" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Keterangan Tambahan (Opsional):
                </label>
                <textarea
                  id="warga-surat-keterangan"
                  name="keteranganTambahan"
                  value={keteranganTambahan}
                  onChange={(e) => setKeteranganTambahan(e.target.value)}
                  placeholder="Catatan pelengkap bagi Sekretaris / Ketua RT..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold shadow-md"
                isLoading={isSubmitting}
              >
                <Send className="w-4 h-4" /> Kirim Pengajuan Surat
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
