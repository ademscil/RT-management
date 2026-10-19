import React, { useState, useEffect } from 'react';
import { QrCode, Printer, CheckCircle2, Clock, Shield } from 'lucide-react';
import { api } from '../services/api.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  PaginationControl,
  SkeletonTable,
  EmptyStateCard,
  notify,
} from '@simrt/ui-kit';
import type { PaginationMeta } from '@simrt/shared-types';

interface InviteItem {
  id: string;
  blokRumah: string;
  nomorKkMasked: string;
  tokenMasked: string;
  isClaimed: boolean;
  claimedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export const OnboardingPage: React.FC = () => {
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadInvites() {
      setIsLoading(true);
      try {
        const res = await api.get<{ items: InviteItem[]; meta: PaginationMeta }>('/onboarding/invites', {
          page: meta.page,
          limit: meta.limit,
        });
        setInvites(res.items);
        setMeta(res.meta);
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Daftar Invite', description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadInvites();
  }, [meta.page, meta.limit]);

  const handleDownloadA4Cards = async () => {
    setIsDownloading(true);
    try {
      const token = api.getToken();
      const apiUrl = (import.meta as any).env?.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/v1/onboarding/generate-cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Gagal meng-generate file PDF kartu QR');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'KARTU_AKTIVASI_WARGA_RT0502_A4.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notify.success({
        title: 'File PDF Kartu QR Siap Dicetak',
        description: 'Lembar A4 (8 kartu bergaris potong) berhasil diunduh.',
      });
    } catch (err: any) {
      notify.error({ title: 'Gagal Download PDF', description: err.message });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <QrCode className="w-6 h-6 text-teal-700" />
            Generator Kartu Aktivasi QR Warga Baru
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Zero-MDN Onboarding: Cetak 8 kartu QR per lembar A4 untuk dibagikan secara fisik ke warga
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleDownloadA4Cards}
          isLoading={isDownloading}
        >
          <Printer className="w-4 h-4" /> Unduh Lembar PDF A4 (8 Kartu)
        </Button>
      </div>

      {/* Info Guide Card */}
      <Card className="border-teal-200 bg-teal-50/40">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs text-slate-700">
            <strong className="text-sm font-bold text-teal-950 block">Alur Onboarding Mandiri Warga RT 05/02</strong>
            <p>
              1. Pengurus mencetak lembar A4 kartu aktivasi QR dan membagikannya ke kepala keluarga baru.
            </p>
            <p>
              2. Warga membuka aplikasi <strong>Resident Mobile</strong> di Android, memindai QR code, dan membuat kata sandi akunnya.
            </p>
            <p>
              3. Aplikasi secara otomatis memberikan <strong>8 Kode Pemulihan Offline</strong> yang disimpan oleh warga.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Invites Table */}
      <Card>
        <CardHeader className="p-5 border-b border-slate-100">
          <CardTitle className="text-base">Riwayat Token Aktivasi yang Diterbitkan</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} columns={5} />
            </div>
          ) : invites.length === 0 ? (
            <EmptyStateCard
              title="Belum Ada Token Aktivasi Diterbitkan"
              description="Klik tombol unduh lembar A4 di atas untuk menerbitkan kartu aktivasi pertama."
              actionLabel="Terbitkan Kartu Sekarang"
              onAction={handleDownloadA4Cards}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Kavling / Rumah</th>
                    <th className="py-3.5 px-4">Nomor KK Masked</th>
                    <th className="py-3.5 px-4">Token QR (Masked)</th>
                    <th className="py-3.5 px-4">Status Klaim</th>
                    <th className="py-3.5 px-4">Batas Kedaluwarsa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{inv.blokRumah}</td>
                      <td className="py-3.5 px-4 font-mono">{inv.nomorKkMasked}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{inv.tokenMasked}</td>
                      <td className="py-3.5 px-4">
                        {inv.isClaimed ? (
                          <Badge variant="success" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Sudah Diklaim
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Menunggu Scan
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {new Date(inv.expiresAt).toLocaleDateString('id-ID')}
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
