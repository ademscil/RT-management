import React, { useState, useEffect } from 'react';
import {
  Wallet,
  CheckCircle2,
  Upload,
  Camera,
  Copy,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { mobileApi } from '../../services/api.js';
import {
  Card,
  CardContent,
  Button,
  Badge,
  notify,
} from '@simrt/ui-kit';

interface BillItem {
  id: string;
  periodeBulan: number;
  periodeTahun: number;
  nominal: number;
  status: string;
  jatuhTempo: string;
  keterangan: string;
}

interface KasItem {
  id: string;
  tanggalTransaksi: string;
  jenisTransaksi: string;
  nominal: number;
  keterangan: string;
  posKasNama: string;
  rowHash: string;
}

export const IuranPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TAGIHAN' | 'BUKU_KAS'>('TAGIHAN');
  const [bills, setBills] = useState<BillItem[]>([]);
  const [kasList, setKasList] = useState<KasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Payment Drawer State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        if (activeTab === 'TAGIHAN') {
          const res = await mobileApi.get<{ items: BillItem[] }>('/keuangan/tagihan');
          setBills(res.items || []);
        } else {
          const res = await mobileApi.get<{ items: KasItem[] }>('/keuangan/kas');
          setKasList(res.items || []);
        }
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Keuangan', description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [activeTab]);

  const monthNames = [
    '',
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const handleOpenPayModal = (bill: BillItem) => {
    setSelectedBill(bill);
    setSelectedFile(null);
    setPreviewUrl(null);
    setPayModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedBill || !selectedFile) {
      notify.error({ title: 'Pilih Bukti Transfer', description: 'Unggah foto struk transfer / mutasi bank Anda.' });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('tagihanId', selectedBill.id);
      formData.append('file', selectedFile);

      await mobileApi.upload('/keuangan/pembayaran/upload-bukti', formData);

      setPayModalOpen(false);
      notify.success({
        title: 'Bukti Transfer Dikirim',
        description: 'Telah diteruskan ke Bendahara RT untuk verifikasi pelunasan.',
      });

      // Reload bills
      const res = await mobileApi.get<{ items: BillItem[] }>('/keuangan/tagihan');
      setBills(res.items || []);
    } catch (err: any) {
      notify.error({ title: 'Gagal Mengunggah Bukti', description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-teal-700" />
            Iuran & Kas Transparan RT
          </h2>
          <p className="text-xs text-slate-500">
            Pembayaran tagihan & pembukuan kas anti-manipulasi
          </p>
        </div>
      </div>

      {/* Tabs Switch */}
      <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('TAGIHAN')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'TAGIHAN'
              ? 'bg-white dark:bg-slate-900 text-teal-700 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Tagihan Rumah Saya
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('BUKU_KAS')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'BUKU_KAS'
              ? 'bg-white dark:bg-slate-900 text-teal-700 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Buku Kas Terbuka
        </button>
      </div>

      {/* TAB 1: TAGIHAN */}
      {activeTab === 'TAGIHAN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
              <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            </div>
          ) : bills.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Semua Iuran Lunas!
                </h4>
                <p className="text-xs text-slate-500">
                  Terima kasih atas kontribusi Anda dalam menjaga ketertiban lingkungan RT 05.
                </p>
              </CardContent>
            </Card>
          ) : (
            bills.map((b) => {
              const isPaid = b.status === 'PAID';
              const isPending = b.status === 'PENDING_VERIFIKASI' || (b.status as string) === 'PENDING_VERIFICATION';
              return (
                <Card key={b.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-teal-700 block">
                          Periode {monthNames[b.periodeBulan]} {b.periodeTahun}
                        </span>
                        <h4 className="text-base font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                          Rp {b.nominal.toLocaleString('id-ID')}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Jatuh tempo: {new Date(b.jatuhTempo).toLocaleDateString('id-ID')}
                        </p>
                      </div>

                      <Badge
                        variant={isPaid ? 'success' : isPending ? 'warning' : 'destructive'}
                      >
                        {isPaid ? 'Lunas' : isPending ? 'Verifikasi Bendahara' : 'Belum Bayar'}
                      </Badge>
                    </div>

                    {!isPaid && !isPending && (
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full font-bold shadow-xs text-xs"
                        onClick={() => handleOpenPayModal(b)}
                      >
                        <Upload className="w-4 h-4" /> Bayar & Unggah Struk
                      </Button>
                    )}

                    {isPaid && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Kwitansi Sah Terbit
                        </span>
                        <span className="text-[10px] font-mono font-bold">TERCATAT DI KAS</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: BUKU KAS TERBUKA (TRANSPARAN) */}
      {activeTab === 'BUKU_KAS' && (
        <div className="space-y-3">
          {/* Integrity Seal Badge */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold">Ledger Kas Kriptografis</h4>
                <p className="text-[10px] text-emerald-200">
                  Setiap mutasi diikat rantai hash SHA-256 anti-manipulasi
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-300 font-bold">
              VERIFIED
            </span>
          </div>

          {isLoading ? (
            <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kasList.map((k) => {
                const isIncome = k.jenisTransaksi === 'INCOME';
                return (
                  <Card key={k.id} className="hover:shadow-xs transition-shadow">
                    <CardContent className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {isIncome ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {k.keterangan}
                          </h5>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {new Date(k.tanggalTransaksi).toLocaleDateString('id-ID')} • {k.posKasNama}
                          </p>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            Hash: {k.rowHash.substring(0, 12)}...
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold font-mono block ${
                            isIncome ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isIncome ? '+' : '-'} Rp {k.nominal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment Drawer Modal */}
      {payModalOpen && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Pembayaran Iuran RT
                </h3>
                <p className="text-xs text-slate-500">
                  Periode {monthNames[selectedBill.periodeBulan]} {selectedBill.periodeTahun}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                aria-label="Tutup Dialog Pembayaran"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bank Transfer Info Card */}
            <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block">
                Nomor Rekening Kas Resmi RT 05:
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                    BCA: 5410-234-889
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">a.n. KAS RT 05 RW 02 SUKAMAJU</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('5410234889');
                    notify.success({ title: 'Tersalin', description: 'Nomor rekening BCA disalin ke clipboard.' });
                  }}
                  className="p-2 rounded-xl bg-teal-700 text-white"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="pt-2 border-t border-teal-200/60 dark:border-teal-800 flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400">Total Transfer:</span>
                <span className="text-base font-black font-mono text-teal-800 dark:text-teal-300">
                  Rp {selectedBill.nominal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Upload Receipt Section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Unggah Bukti Transfer / Nota Struk:
              </label>

              {!previewUrl ? (
                <label htmlFor="upload-bukti-transfer-input" className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:border-teal-500 transition-colors">
                  <Camera className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Foto Bukti Transfer
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Format JPG, PNG, atau WebP (Maks 5MB)
                  </span>
                  <input
                    id="upload-bukti-transfer-input"
                    name="buktiTransfer"
                    aria-label="Unggah Foto Bukti Transfer"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-teal-500">
                  <img src={previewUrl} alt="Receipt preview" className="w-full h-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setSelectedFile(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md"
              onClick={handleConfirmPayment}
              isLoading={isUploading}
              disabled={!selectedFile}
            >
              <Upload className="w-4 h-4" /> Kirim Bukti ke Bendahara
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
