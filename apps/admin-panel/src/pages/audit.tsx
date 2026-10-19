import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, AlertOctagon } from 'lucide-react';
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
import type { PaginationMeta, HashChainVerificationResult } from '@simrt/shared-types';

interface AuditItem {
  id: string;
  actorUserId: string;
  actorRole: string;
  actionType: string;
  targetEntity: string;
  targetId: string;
  accessReason: string | null;
  ipAddress: string;
  userAgent: string;
  prevHash: string;
  rowHash: string;
  createdAt: string;
}

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [auditResult, setAuditResult] = useState<HashChainVerificationResult | null>(null);

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      try {
        const res = await api.get<{ items: AuditItem[]; meta: PaginationMeta }>('/audit/logs', {
          page: meta.page,
          limit: meta.limit,
          search: search || undefined,
        });
        setLogs(res.items);
        setMeta(res.meta);
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Audit Log', description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadLogs();
  }, [meta.page, meta.limit, search]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await api.get<HashChainVerificationResult>('/audit/verify-chain');
      setAuditResult(res);

      if (res.isChainValid) {
        notify.success({
          title: 'Rantai Audit Log Sah 100%',
          description: `Tidak ada catatan audit yang disusupi atau dihapus (${res.totalRecordsChecked} entri dicek).`,
        });
      } else {
        notify.error({
          title: 'PERINGATAN INTEGRITAS LOG AUDIT',
          description: `Ditemukan ketidakcocokan hash pada audit #${res.tamperedRecordId}!`,
        });
      }
    } catch (err: any) {
      notify.error({ title: 'Gagal Verifikasi Chain', description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setMeta((prev) => ({ ...prev, page: 1 }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-teal-700" />
            Catatan Aktivitas & Riwayat RT 05 / RW 02
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Riwayat aktivitas pengurus yang tersimpan secara aman & anti-manipulasi untuk transparansi warga
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleVerifyChain} isLoading={isVerifying} className="text-xs font-bold">
          <ShieldCheck className="w-4 h-4" /> Uji Keabsahan Catatan
        </Button>
      </div>

      {/* Audit Banner */}
      {auditResult && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in ${
            auditResult.isChainValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
              auditResult.isChainValid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {auditResult.isChainValid ? <CheckCircle2 className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
            </div>
            <div>
              <strong className="text-sm block">
                {auditResult.isChainValid
                  ? 'Catatan Sah 100%: Tidak Ada Catatan yang Diubah atau Dihapus'
                  : 'Peringatan: Ada Riwayat yang Termodifikasi!'}
              </strong>
              <p className="font-mono text-[11px] opacity-80 mt-0.5">
                Total Baris: {auditResult.totalRecordsChecked} entri | Hash Pertama: {auditResult.firstHash.substring(0, 16)}... | Hash Terakhir: {auditResult.lastHash.substring(0, 16)}...
              </p>
            </div>
          </div>
          <Badge variant={auditResult.isChainValid ? 'success' : 'destructive'} className="font-mono">
            {auditResult.isChainValid ? 'TERVERIFIKASI SAH' : 'TERMODIFIKASI'}
          </Badge>
        </div>
      )}

      {/* Search Input */}
      <Card>
        <CardContent className="p-4">
          <SearchInput
            placeholder="Cari aksi (REVEAL_PII, LOGIN), entity, atau alamat IP..."
            onChange={handleSearchChange}
            isLoading={isLoading}
            className="w-full sm:max-w-md"
          />
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={6} columns={6} />
            </div>
          ) : logs.length === 0 ? (
            <EmptyStateCard
              title="Tidak Ada Catatan Audit"
              description="Belum ada aktivitas yang tercatat pada kriteria pencarian ini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Waktu & Audit ID</th>
                    <th className="py-3 px-4">Aktor / Role</th>
                    <th className="py-3 px-4">Tipe Aksi & Entitas</th>
                    <th className="py-3 px-4">Alasan Akses</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Row Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <strong className="text-slate-900 block">{new Date(l.createdAt).toLocaleString('id-ID')}</strong>
                        <span className="text-[10px] text-slate-400">#{l.id}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">{l.actorUserId.substring(0, 14)}...</span>
                        <Badge variant="pii" className="text-[10px] py-0 mt-0.5">
                          {l.actorRole}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={l.actionType.startsWith('REVEAL') ? 'destructive' : 'default'}
                          className="font-mono text-[10px]"
                        >
                          {l.actionType}
                        </Badge>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Target: {l.targetEntity}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 max-w-xs truncate" title={l.accessReason || '-'}>
                        {l.accessReason || '-'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">{l.ipAddress}</td>

                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 max-w-[130px] truncate" title={l.rowHash}>
                        {l.rowHash.substring(0, 16)}...
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
};
