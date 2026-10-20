import React, { useState, useEffect } from 'react';
import { useRtConfig } from '../context/rt-config-context.js';
import { useAuth } from '../context/auth-context.js';
import { Card, CardHeader, CardTitle, CardContent, Button, notify } from '@simrt/ui-kit';
import { Settings, MapPin, CheckCircle2, RefreshCw, Building2 } from 'lucide-react';

export const PengaturanPage: React.FC = () => {
  const { config, updateConfig, refreshConfig, isLoading } = useRtConfig();
  const { user } = useAuth();

  const [kodeRt, setKodeRt] = useState(config.kodeRt || '010');
  const [kodeRw, setKodeRw] = useState(config.kodeRw || '003');
  const [namaKelurahan, setNamaKelurahan] = useState(config.namaKelurahan || 'Taman Bunga');
  const [namaKecamatan, setNamaKecamatan] = useState(config.namaKecamatan || 'Gerunggang');
  const [namaKota, setNamaKota] = useState(config.namaKota || 'Kota Pangkalpinang');
  const [kodePos, setKodePos] = useState(config.kodePos || '33119');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setKodeRt(config.kodeRt || '010');
      setKodeRw(config.kodeRw || '003');
      setNamaKelurahan(config.namaKelurahan || 'Taman Bunga');
      setNamaKecamatan(config.namaKecamatan || 'Gerunggang');
      setNamaKota(config.namaKota || 'Kota Pangkalpinang');
      setKodePos(config.kodePos || '33119');
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeRt.trim() || !kodeRw.trim() || !namaKelurahan.trim() || !namaKecamatan.trim() || !namaKota.trim()) {
      notify.error({
        title: 'Data Belum Lengkap',
        description: 'Seluruh kolom wilayah wajib diisi.',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateConfig({
        kodeRt: kodeRt.trim(),
        kodeRw: kodeRw.trim(),
        namaKelurahan: namaKelurahan.trim(),
        namaKecamatan: namaKecamatan.trim(),
        namaKota: namaKota.trim(),
        kodePos: kodePos.trim(),
      });

      notify.success({
        title: 'Konfigurasi RT Berhasil Disimpan',
        description: `Identitas RT kini aktif sebagai RT ${kodeRt} / RW ${kodeRw} Kel. ${namaKelurahan}, ${namaKecamatan}, ${namaKota}.`,
      });
    } catch (err: any) {
      notify.error({
        title: 'Gagal Menyimpan Konfigurasi',
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const applyPangkalpinangPreset = () => {
    setKodeRt('010');
    setKodeRw('003');
    setNamaKelurahan('Taman Bunga');
    setNamaKecamatan('Gerunggang');
    setNamaKota('Kota Pangkalpinang');
    setKodePos('33119');
    notify.info({
      title: 'Lokasi Pangkalpinang Dimuat',
      description: 'Klik "Simpan Perubahan Identitas RT" untuk mengaktifkan.',
    });
  };

  const isSuperuserOrKetua = user?.role === 'SUPERUSER' || user?.role === 'KETUA_RT';

  return (
    <div className="space-y-6 animate-in fade-in pb-12 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Profil & Identitas Wilayah RT
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ubah identitas rukun tetangga agar aplikasi dapat digunakan di daerah atau RT manapun di seluruh Indonesia
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshConfig}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Sinkronkan Data
          </Button>
        </div>
      </div>

      {/* Live Preview Card */}
      <Card className="border-teal-200 dark:border-teal-900/50 bg-gradient-to-br from-teal-50/50 via-slate-50 to-white dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> Pratinjau Identitas Aktif Sistem
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
              Sedang Digunakan
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              RUKUN TETANGGA {kodeRt || '...'} / RUKUN WARGA {kodeRw || '...'}
            </h3>
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              KELURAHAN {(namaKelurahan || '...').toUpperCase()}, KECAMATAN {(namaKecamatan || '...').toUpperCase()}, {(namaKota || '...').toUpperCase()}
            </p>
            <p className="text-[11px] text-slate-500">
              Sekretariat: Pos RT {kodeRt}/{kodeRw} {namaKecamatan}, {namaKota} — Kode Pos: {kodePos || '-'}
            </p>
          </div>
          <p className="text-[11px] text-slate-500">
            Identitas di atas akan otomatis tampil di Kop Surat Resmi, Kuitansi Iuran, Header Admin Panel, dan Beranda Aplikasi Warga Mobile.
          </p>
        </CardContent>
      </Card>

      {/* Settings Form */}
      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" /> Formulir Ubah Wilayah RT
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Quick Preset Buttons */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Pintasan Lokasi Cepat:
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyPangkalpinangPreset}
                  className="text-xs border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300"
                >
                  <MapPin className="w-3.5 h-3.5" /> Set Lokasi: RT 010 / RW 003 Taman Bunga, Pangkalpinang (Sesuai Google Maps)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="cfg-kode-rt" className="font-semibold text-slate-700 dark:text-slate-300">
                  Nomor / Kode RT:
                </label>
                <input
                  id="cfg-kode-rt"
                  type="text"
                  value={kodeRt}
                  onChange={(e) => setKodeRt(e.target.value)}
                  placeholder="Contoh: 010 atau 05"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                  required
                  disabled={!isSuperuserOrKetua}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="cfg-kode-rw" className="font-semibold text-slate-700 dark:text-slate-300">
                  Nomor / Kode RW:
                </label>
                <input
                  id="cfg-kode-rw"
                  type="text"
                  value={kodeRw}
                  onChange={(e) => setKodeRw(e.target.value)}
                  placeholder="Contoh: 003 atau 02"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                  required
                  disabled={!isSuperuserOrKetua}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label htmlFor="cfg-kelurahan" className="font-semibold text-slate-700 dark:text-slate-300">
                  Kelurahan / Desa:
                </label>
                <input
                  id="cfg-kelurahan"
                  type="text"
                  value={namaKelurahan}
                  onChange={(e) => setNamaKelurahan(e.target.value)}
                  placeholder="Contoh: Taman Bunga"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  required
                  disabled={!isSuperuserOrKetua}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="cfg-kecamatan" className="font-semibold text-slate-700 dark:text-slate-300">
                  Kecamatan:
                </label>
                <input
                  id="cfg-kecamatan"
                  type="text"
                  value={namaKecamatan}
                  onChange={(e) => setNamaKecamatan(e.target.value)}
                  placeholder="Contoh: Gerunggang"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  required
                  disabled={!isSuperuserOrKetua}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="cfg-kota" className="font-semibold text-slate-700 dark:text-slate-300">
                  Kota / Kabupaten:
                </label>
                <input
                  id="cfg-kota"
                  type="text"
                  value={namaKota}
                  onChange={(e) => setNamaKota(e.target.value)}
                  placeholder="Contoh: Kota Pangkalpinang"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  required
                  disabled={!isSuperuserOrKetua}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="cfg-kodepos" className="font-semibold text-slate-700 dark:text-slate-300">
                  Kode Pos Wilayah:
                </label>
                <input
                  id="cfg-kodepos"
                  type="text"
                  value={kodePos}
                  onChange={(e) => setKodePos(e.target.value)}
                  placeholder="Contoh: 33119"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  disabled={!isSuperuserOrKetua}
                />
              </div>

              <div className="flex items-end">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 w-full">
                  Hanya akun <strong>Superuser</strong> atau <strong>Ketua RT</strong> yang memiliki wewenang mengubah identitas wilayah.
                </div>
              </div>
            </div>

            {isSuperuserOrKetua && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  isLoading={isSaving}
                  className="px-6"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Simpan Perubahan Identitas RT
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
