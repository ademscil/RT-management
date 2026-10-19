import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  AlertOctagon,
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  Card,
  CardContent,
  Button,
  Badge,
  PaginationControl,
  SkeletonTable,
  EmptyStateCard,
  notify,
} from '@simrt/ui-kit';
import type { PaginationMeta, HashChainVerificationResult } from '@simrt/shared-types';

interface MatrixRow {
  rumahId: string;
  kodeBlok: string;
  nomorRumah: string;
  alamat: string;
  kepalaKeluarga: string;
  statusHunian: string;
  tahun: number;
  bulan: Record<number, string>;
}

interface LedgerItem {
  id: string;
  namaPos: string;
  tipe: 'IN' | 'OUT';
  nominal: number;
  saldoSetelah: number;
  deskripsi: string;
  prevHash: string;
  rowHash: string;
  createdAt: string;
}

export const KeuanganPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'MATRIKS' | 'LEDGER'>('MATRIKS');
  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [chainAuditResult, setChainAuditResult] = useState<HashChainVerificationResult | null>(null);

  // Batch Billing Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchBulan, setBatchBulan] = useState(new Date().getMonth() + 1);
  const [batchTahun, setBatchTahun] = useState(new Date().getFullYear());
  const [batchNominal, setBatchNominal] = useState(50000);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        if (activeTab === 'MATRIKS') {
          const m = await api.get<MatrixRow[]>('/keuangan/matriks', { tahun: new Date().getFullYear() });
          setMatrixData(m);
        } else {
          const l = await api.get<{ items: LedgerItem[]; meta: PaginationMeta }>('/keuangan/ledger', {
            page: ledgerMeta.page,
            limit: ledgerMeta.limit,
          });
          setLedgerItems(l.items);
          setLedgerMeta(l.meta);
        }
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Data Keuangan', description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [activeTab, ledgerMeta.page, ledgerMeta.limit]);

  const handleVerifyChainIntegrity = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await api.get<HashChainVerificationResult>('/keuangan/verify-integrity');
      setChainAuditResult(res);

      if (res.isChainValid) {
        notify.success({
          title: 'Integritas Buku Kas Terverifikasi 100%',
          description: `Rantai hash dari Genesis hingga baris terakhir (${res.totalRecordsChecked} transaksi) sah secara matematis.`,
        });
      } else {
        notify.error({
          title: 'PERINGATAN: ANOMALI DATA KAS TERDETEKSI',
          description: `Ditemukan manipulasi baris pada Record ID #${res.tamperedRecordId}!`,
        });
      }
    } catch (err: any) {
      notify.error({ title: 'Gagal Verifikasi Integritas', description: err.message });
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const handleGenerateBatch = async () => {
    setIsGeneratingBatch(true);
    try {
      const res = await api.post<{ totalTagihanDibuat: number }>('/keuangan/generate-bulanan', {
        bulan: batchBulan,
        tahun: batchTahun,
        nominalDefault: batchNominal,
      });

      setBatchModalOpen(false);
      notify.success({
        title: 'Batch Tagihan Berhasil Dibuat',
        description: `Sebanyak ${res.totalTagihanDibuat} tagihan iuran baru telah diterbitkan untuk warga.`,
      });

      // Reload matrix
      const m = await api.get<MatrixRow[]>('/keuangan/matriks', { tahun: batchTahun });
      setMatrixData(m);
    } catch (err: any) {
      notify.error({ title: 'Gagal Generate Tagihan', description: err.message });
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  return (
    <div className="space-y-6">
      {/* Header & Integrity Verify Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-teal-700" />
            Financial ERP & Multi-Fund Immutable Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Matriks penerimaan 12 bulan & buku kas anti-tamper dengan verifikasi rantai kriptografi SHA-256
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="md"
            onClick={() => setBatchModalOpen(true)}
            className="text-xs"
          >
            <PlusCircle className="w-4 h-4 text-teal-700" /> Terbitkan Tagihan Bulanan
          </Button>

          <Button
            variant="pii"
            size="md"
            onClick={handleVerifyChainIntegrity}
            isLoading={isVerifyingChain}
            className="text-xs"
          >
            <ShieldCheck className="w-4 h-4" /> Verify Ledger Integrity
          </Button>
        </div>
      </div>

      {/* Chain Integrity Alert Banner if verified */}
      {chainAuditResult && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in ${
            chainAuditResult.isChainValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
              chainAuditResult.isChainValid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {chainAuditResult.isChainValid ? <CheckCircle2 className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
            </div>
            <div>
              <strong className="text-sm block">
                {chainAuditResult.isChainValid
                  ? 'Sertifikat Integritas Matematis: Rantai Kas Sah (Zero Tampering)'
                  : 'Peringatan: Hash Chain Terputus / Data Termodifikasi!'}
              </strong>
              <p className="font-mono text-[11px] opacity-80 mt-0.5">
                Total Baris Terverifikasi: {chainAuditResult.totalRecordsChecked} | Last Hash: {chainAuditResult.lastHash.substring(0, 32)}...
              </p>
            </div>
          </div>
          <Badge variant={chainAuditResult.isChainValid ? 'success' : 'destructive'} className="font-mono">
            {chainAuditResult.isChainValid ? 'CHAIN VALID' : 'TAMPERED'}
          </Badge>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('MATRIKS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'MATRIKS'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Matriks Iuran 12 Bulan (Per Kavling)
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'LEDGER'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" /> Buku Kas Imutabel (Hash-Chained)
        </button>
      </div>

      {/* Tab Content 1: 12-Month Matrix */}
      {activeTab === 'MATRIKS' && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <SkeletonTable rows={6} columns={14} />
              </div>
            ) : matrixData.length === 0 ? (
              <EmptyStateCard
                title="Belum Ada Data Matriks Iuran"
                description="Terbitkan tagihan bulanan pertama untuk melihat matriks pembayaran warga."
                actionLabel="Terbitkan Tagihan Sekarang"
                onAction={() => setBatchModalOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3 min-w-[140px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-sm">
                        Kavling / Kepala Keluarga
                      </th>
                      {monthNames.map((m) => (
                        <th key={m} className="py-3 px-2 text-center min-w-[55px]">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {matrixData.map((row) => (
                      <tr key={row.rumahId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10 font-medium border-r border-slate-100 shadow-sm">
                          <strong className="text-slate-900 dark:text-slate-100">
                            Blok {row.kodeBlok}/{row.nomorRumah}
                          </strong>
                          <p className="text-[11px] text-slate-500 truncate max-w-[130px]">{row.kepalaKeluarga}</p>
                        </td>

                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                          const status = row.bulan[m] || 'NO_BILL';
                          let cellContent = <span className="text-slate-300">-</span>;

                          if (status === 'PAID') {
                            cellContent = (
                              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center mx-auto text-[10px]">
                                L
                              </span>
                            );
                          } else if (status === 'PENDING_VERIFICATION') {
                            cellContent = (
                              <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-bold flex items-center justify-center mx-auto text-[10px] animate-pulse">
                                ?
                              </span>
                            );
                          } else if (status === 'UNPAID') {
                            cellContent = (
                              <span className="w-6 h-6 rounded-lg bg-red-100 text-red-700 font-bold flex items-center justify-center mx-auto text-[10px]">
                                X
                              </span>
                            );
                          }

                          return (
                            <td key={m} className="py-3 px-2 text-center" title={`Bulan ${m}: ${status}`}>
                              {cellContent}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Content 2: Immutable Kas Ledger */}
      {activeTab === 'LEDGER' && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <SkeletonTable rows={6} columns={6} />
              </div>
            ) : ledgerItems.length === 0 ? (
              <EmptyStateCard
                title="Buku Kas Masih Kosong"
                description="Belum ada transaksi penerimaan atau pengeluaran kas yang tercatat."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Tanggal & Ref ID</th>
                      <th className="py-3 px-4">Pos Keuangan</th>
                      <th className="py-3 px-4">Tipe & Nominal</th>
                      <th className="py-3 px-4">Saldo Berjalan</th>
                      <th className="py-3 px-4">Keterangan</th>
                      <th className="py-3 px-4">Row Hash Kriptografi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ledgerItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono">
                          <strong className="text-slate-900">{new Date(item.createdAt).toLocaleDateString('id-ID')}</strong>
                          <p className="text-[10px] text-slate-400">{item.id}</p>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-800">{item.namaPos}</td>

                        <td className="py-3.5 px-4 font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            {item.tipe === 'IN' ? (
                              <span className="text-emerald-700 flex items-center">
                                <ArrowDownLeft className="w-3.5 h-3.5 mr-0.5" /> +Rp {item.nominal.toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="text-red-700 flex items-center">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> -Rp {item.nominal.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                          Rp {item.saldoSetelah.toLocaleString('id-ID')}
                        </td>

                        <td className="py-3.5 px-4 max-w-xs truncate" title={item.deskripsi}>
                          {item.deskripsi}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 truncate max-w-[140px]" title={item.rowHash}>
                          {item.rowHash.substring(0, 16)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-100 dark:border-slate-800 p-2">
              <PaginationControl
                meta={ledgerMeta}
                onPageChange={(p) => setLedgerMeta((prev) => ({ ...prev, page: p }))}
                onLimitChange={(l) => setLedgerMeta((prev) => ({ ...prev, limit: l, page: 1 }))}
                isLoading={isLoading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Billing Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Terbitkan Tagihan Iuran Bulanan
                </h3>
                <p className="text-xs text-slate-500">Generate tagihan otomatis untuk seluruh rumah berpenghuni</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bulan:</label>
                  <select
                    value={batchBulan}
                    onChange={(e) => setBatchBulan(Number(e.target.value))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none mt-1"
                  >
                    {monthNames.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tahun:</label>
                  <input
                    type="number"
                    value={batchTahun}
                    onChange={(e) => setBatchTahun(Number(e.target.value))}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nominal Tagihan (Rp):</label>
                <input
                  type="number"
                  value={batchNominal}
                  onChange={(e) => setBatchNominal(Number(e.target.value))}
                  step={5000}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none mt-1 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="outline" size="md" onClick={() => setBatchModalOpen(false)} disabled={isGeneratingBatch}>
                Batal
              </Button>
              <Button variant="primary" size="md" onClick={handleGenerateBatch} isLoading={isGeneratingBatch}>
                Terbitkan Tagihan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
