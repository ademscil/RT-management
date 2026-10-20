import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Eye,
  Camera,
  KeyRound,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { mobileApi } from '../../services/api.js';
import {
  Card,
  CardContent,
  Button,
  Badge,
  PiiRevealModal,
  notify,
  formatGender,
  formatGolDarah,
  formatHubunganKeluarga,
} from '@simrt/ui-kit';
import { IdCardScannerModal } from '../../components/IdCardScannerModal.js';

interface WargaAnggota {
  id: string;
  namaLengkap: string;
  nikMasked: string;
  hubunganKeluarga: string;
  jenisKelamin: string;
  tempatLahir: string;
  tanggalLahir: string;
  golonganDarah: string | null;
  statusKeluarga: string;
}

interface FamilyData {
  id: string;
  nomorKkMasked: string;
  blokRumah: string;
  alamatLengkap: string;
  anggota: WargaAnggota[];
}

export const KeluargaPage: React.FC = () => {
  const { logout } = useAuth();
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // PII Reveal State
  const [piiModalOpen, setPiiModalOpen] = useState(false);
  const [selectedWargaId, setSelectedWargaId] = useState<string | null>(null);
  const [revealedPii, setRevealedPii] = useState<{ nik: string; namaLengkap: string } | null>(null);

  // Scanner / Camera modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTitle, setScannerTitle] = useState('');
  const [uploadTargetWargaId, setUploadTargetWargaId] = useState<string | null>(null);

  // Recovery Codes Modal
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);

  useEffect(() => {
    async function loadFamilyData() {
      setIsLoading(true);
      try {
        // Query resident's KK
        const res = await mobileApi.get<{ items: any[] }>('/kependudukan/kk');
        if (res.items && res.items.length > 0) {
          const firstKk = res.items[0];
          setFamilyData({
            id: firstKk.id,
            nomorKkMasked: firstKk.nomorKkMasked,
            blokRumah: firstKk.blokRumah,
            alamatLengkap: firstKk.alamatLengkap,
            anggota: (firstKk.anggota || []).map((w: any) => ({
              id: w.id,
              namaLengkap: w.namaLengkap,
              nikMasked: w.nikMasked,
              hubunganKeluarga: w.hubunganKeluarga,
              jenisKelamin: w.gender || w.jenisKelamin,
              tempatLahir: w.tempatLahir,
              tanggalLahir: w.tanggalLahir,
              golonganDarah: w.golonganDarah,
              statusKeluarga: formatHubunganKeluarga(w.hubunganKeluarga),
            })),
          });
        }
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Data Keluarga', description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    loadFamilyData();
  }, []);

  const handleOpenPiiReveal = (wargaId: string) => {
    setSelectedWargaId(wargaId);
    setRevealedPii(null);
    setPiiModalOpen(true);
  };

  const handleConfirmPiiReveal = async (reason: any) => {
    if (!selectedWargaId) return;
    try {
      const res = await mobileApi.post<{ nik: string; namaLengkap: string }>(
        `/kependudukan/warga/${selectedWargaId}/reveal-nik`,
        { reason }
      );
      setRevealedPii(res);
      setPiiModalOpen(false);
      notify.success({
        title: 'Kriptografi NIK Dibuka',
        description: 'Terekam di immutable security audit log.',
      });
    } catch (err: any) {
      notify.error({ title: 'Gagal Membuka NIK', description: err.message });
      throw err;
    }
  };

  const handleOpenKtpCamera = (wargaId: string, nama: string) => {
    setUploadTargetWargaId(wargaId);
    setScannerTitle(`Foto KTP Asli: ${nama}`);
    setScannerOpen(true);
  };

  const handleCaptureComplete = async (file: File) => {
    if (!uploadTargetWargaId) return;
    try {
      notify.info({
        title: 'Mengunggah & Sanitasi Gambar',
        description: 'Menghapus GPS EXIF & melakukan WebP re-encoding...',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 'KTP');
      formData.append('wargaId', uploadTargetWargaId);

      await mobileApi.upload('/kependudukan/dokumen/upload', formData);

      notify.success({
        title: 'Dokumen KTP Berhasil Diunggah',
        description: 'Tersimpan aman di Vault dengan enkripsi AES-256-GCM.',
      });
    } catch (err: any) {
      notify.error({ title: 'Gagal Mengunggah Dokumen', description: err.message });
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-700 shrink-0" />
            <span className="truncate">Kartu Keluarga Digital</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Data kependudukan keluarga terenkripsi AES-256-GCM
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRecoveryModalOpen(true)}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          title="Lihat Kode Pemulihan Offline"
          aria-label="Lihat Kode Pemulihan Offline"
        >
          <KeyRound className="w-4 h-4 shrink-0" />
          <span>Kunci Pemulihan</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : familyData ? (
        <div className="space-y-4">
          {/* Digital KK Card Visual - Civic Enterprise Benchmark */}
          <div className="relative rounded-2xl p-5 bg-slate-900 text-white shadow-sm border border-slate-800 space-y-4 overflow-hidden animate-rise-in">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-500 via-emerald-400 to-blue-500" />
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400 block">
                  REPUBLIK INDONESIA
                </span>
                <h3 className="text-sm font-black text-white">KARTU KELUARGA RT 05 / RW 02</h3>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-teal-300 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-teal-400 font-semibold block">Nomor Kartu Keluarga:</span>
                <span className="font-mono font-bold text-white tracking-wider">
                  {familyData.nomorKkMasked}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-teal-400 font-semibold block">Kavling / Blok Rumah:</span>
                <span className="font-bold text-white">{familyData.blokRumah}</span>
              </div>
            </div>

            <div className="text-xs border-t border-slate-800 pt-2.5 text-slate-300">
              <span className="text-[10px] text-teal-400 font-semibold block">Alamat Terdaftar:</span>
              <p className="line-clamp-2">{familyData.alamatLengkap}</p>
            </div>
          </div>

          {/* Anggota Keluarga List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daftar Anggota Keluarga ({familyData.anggota.length} Orang)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {familyData.anggota.map((w) => (
                <Card key={w.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                            {w.namaLengkap}
                          </h4>
                          <Badge
                            variant={w.hubunganKeluarga === 'KEPALA_KELUARGA' ? 'pii' : 'outline'}
                          >
                            {w.statusKeluarga}
                          </Badge>
                        </div>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          NIK: {w.nikMasked}
                        </p>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-slate-800 flex items-center justify-center text-teal-700">
                        <UserCheck className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Jenis Kelamin:</span>
                        <strong>{formatGender(w.jenisKelamin)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Gol. Darah:</span>
                        <strong>{formatGolDarah(w.golonganDarah)}</strong>
                      </div>
                    </div>

                    {/* Actions: Reveal NIK & Update KTP Photo */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleOpenPiiReveal(w.id)}
                      >
                        <Eye className="w-3.5 h-3.5" /> Buka NIK Asli
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleOpenKtpCamera(w.id, w.namaLengkap)}
                      >
                        <Camera className="w-3.5 h-3.5" /> Unggah KTP
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-slate-500">
            <p>Data Kartu Keluarga belum terhubung dengan akun ini.</p>
          </CardContent>
        </Card>
      )}

      {/* Direct Logout Action on Account Tab (Mobile only) */}
      <div className="pt-2 md:hidden">
        <Button
          variant="destructive"
          size="md"
          className="w-full font-bold shadow-sm"
          onClick={logout}
          aria-label="Keluar dari Akun Warga"
        >
          <LogOut className="w-4 h-4 mr-2" /> Keluar dari Akun Warga
        </Button>
      </div>

      {/* PII Reveal Modal */}
      {selectedWargaId && (
        <PiiRevealModal
          isOpen={piiModalOpen}
          onClose={() => setPiiModalOpen(false)}
          wargaNama={familyData?.anggota.find((a) => a.id === selectedWargaId)?.namaLengkap || 'Warga'}
          field="NIK"
          onConfirm={handleConfirmPiiReveal}
        />
      )}

      {/* Show Revealed NIK dialog */}
      {revealedPii && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-teal-700">
              <Shield className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                NIK Asli Terdekripsi
              </h3>
            </div>
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl text-center border border-teal-200">
              <p className="text-xs text-slate-500">{revealedPii.namaLengkap}</p>
              <p className="text-base font-mono font-bold text-teal-800 dark:text-teal-300 tracking-wider mt-1 select-all">
                {revealedPii.nik}
              </p>
            </div>
            <Button variant="primary" size="md" className="w-full" onClick={() => setRevealedPii(null)}>
              Tutup & Sembunyikan
            </Button>
          </div>
        </div>
      )}

      {/* Camera / ID Card Scanner Modal */}
      <IdCardScannerModal
        isOpen={scannerOpen}
        title={scannerTitle}
        onClose={() => setScannerOpen(false)}
        onCapture={handleCaptureComplete}
      />

      {/* Offline Recovery Reminder Modal */}
      {recoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Kode Pemulihan Offline
                </h3>
                <p className="text-[11px] text-slate-500">Proteksi Zero-MDN</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              8-digit kode pemulihan hanya diunduh saat aktivasi pertama kali. Jika Anda kehilangan seluruh kode dan lupa password, Anda wajib melakukan <strong>Reset Manual Tatap Muka</strong> dengan Pengurus RT di Kantor Sekretariat.
            </p>

            <Button variant="primary" size="md" className="w-full" onClick={() => setRecoveryModalOpen(false)}>
              Saya Mengerti
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
