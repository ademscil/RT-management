import React, { useState, useEffect } from 'react';
import { useRtConfig, type RtConfig } from '../context/rt-config-context.js';
import { useAuth } from '../context/auth-context.js';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, notify } from '@simrt/ui-kit';
import {
  Settings,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Building2,
  PlusCircle,
  Check,
  Globe2,
} from 'lucide-react';

export const PengaturanPage: React.FC = () => {
  const { config, rtList, activeRtId, updateConfig, switchRt, createRt, deleteRt, refreshConfig, isLoading } = useRtConfig();
  const { user } = useAuth();

  // Edit form state
  const [kodeRt, setKodeRt] = useState(config.kodeRt || '010');
  const [kodeRw, setKodeRw] = useState(config.kodeRw || '003');
  const [namaKelurahan, setNamaKelurahan] = useState(config.namaKelurahan || 'Taman Bunga');
  const [namaKecamatan, setNamaKecamatan] = useState(config.namaKecamatan || 'Gerunggang');
  const [namaKota, setNamaKota] = useState(config.namaKota || 'Kota Pangkalpinang');
  const [kodePos, setKodePos] = useState(config.kodePos || '33119');
  const [isSaving, setIsSaving] = useState(false);

  // New RT Modal/Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKodeRt, setNewKodeRt] = useState('');
  const [newKodeRw, setNewKodeRw] = useState('');
  const [newKelurahan, setNewKelurahan] = useState('');
  const [newKecamatan, setNewKecamatan] = useState('');
  const [newKota, setNewKota] = useState('');
  const [newKodePos, setNewKodePos] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
        description: err.message || 'Terjadi kesalahan sistem.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKodeRt.trim() || !newKodeRw.trim() || !newKelurahan.trim() || !newKecamatan.trim() || !newKota.trim()) {
      notify.error({
        title: 'Data Belum Lengkap',
        description: 'Semua kolom wajib diisi untuk mendaftarkan RT baru.',
      });
      return;
    }

    setIsCreating(true);
    try {
      const created = await createRt({
        kodeRt: newKodeRt.trim(),
        kodeRw: newKodeRw.trim(),
        namaKelurahan: newKelurahan.trim(),
        namaKecamatan: newKecamatan.trim(),
        namaKota: newKota.trim(),
        kodePos: newKodePos.trim() || '00000',
      });

      notify.success({
        title: 'RT Baru Berhasil Didaftarkan',
        description: `${created.displayFull} telah aktif dan dapat langsung digunakan.`,
      });
      setShowAddModal(false);
      setNewKodeRt('');
      setNewKodeRw('');
      setNewKelurahan('');
      setNewKecamatan('');
      setNewKota('');
      setNewKodePos('');
    } catch (err: any) {
      notify.error({
        title: 'Gagal Mendaftarkan RT',
        description: err.message || 'Terjadi kesalahan pada server.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const applyPreset = (preset: { rt: string; rw: string; kel: string; kec: string; kota: string; pos: string }) => {
    setKodeRt(preset.rt);
    setKodeRw(preset.rw);
    setNamaKelurahan(preset.kel);
    setNamaKecamatan(preset.kec);
    setNamaKota(preset.kota);
    setKodePos(preset.pos);
    notify.info({
      title: `Preset ${preset.kel} Dimuat`,
      description: 'Klik "Simpan Perubahan Identitas RT" untuk memperbarui data RT ini.',
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
              Profil & Identitas Multi-Wilayah RT
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola komunitas RT di seluruh Indonesia. Tiap RT berjalan secara independen dan aman tanpa mengganggu data RT lainnya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperuserOrKetua && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Daftarkan RT Baru
            </Button>
          )}

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

      {/* 1. Multi-Tenant Registered RT Communities Showcase */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-teal-600" /> Daftar Komunitas RT Terdaftar (Multi-Tenancy)
            </CardTitle>
            <span className="text-xs text-slate-500 font-mono">
              Total: {rtList.length} RT Aktif
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rtList.map((rtItem: RtConfig) => {
              const isActive = rtItem.id === config.id || rtItem.id === activeRtId;
              return (
                <div
                  key={rtItem.id || rtItem.displayTitle}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {rtItem.displayTitle}
                        </span>
                        {isActive && (
                          <Badge variant="success" className="text-[10px] py-0 px-1.5 font-bold">
                            Sedang Aktif
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-1">
                        Kel. {rtItem.namaKelurahan}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Kec. {rtItem.namaKecamatan}, {rtItem.namaKota} ({rtItem.kodePos})
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {rtItem.id ? `ID: ${rtItem.id.substring(0, 8)}...` : 'Default'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isActive && user?.role === 'SUPERUSER' && rtList.length > 1 && rtItem.id && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Hapus data pendaftaran ${rtItem.displayTitle}?`)) {
                              await deleteRt(rtItem.id!);
                              notify.info({ title: 'RT Dihapus', description: 'Komunitas RT telah dihapus.' });
                            }
                          }}
                          className="text-[11px] text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Hapus RT"
                        >
                          Hapus
                        </button>
                      )}

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                          <Check className="w-3.5 h-3.5" /> Wilayah Terpilih
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rtItem.id && switchRt(rtItem.id)}
                          className="text-xs h-7 px-3 border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                        >
                          Pilih RT Ini
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Live Preview Card of Selected RT */}
      <Card className="border-teal-200 dark:border-teal-900/50 bg-gradient-to-br from-teal-50/50 via-slate-50 to-white dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> Pratinjau Identitas Aktif Sistem
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
              Kop & Kuitansi Mengikuti RT Ini
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
            Identitas di atas otomatis tampil di Kop Surat Resmi ber-QR, Kuitansi Iuran, Header Admin Panel, dan Beranda Aplikasi Warga Mobile untuk RT ini.
          </p>
        </CardContent>
      </Card>

      {/* 3. Settings Form to Edit Active RT */}
      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" /> Formulir Ubah Wilayah RT Terpilih ({config.displayTitle})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Quick Preset Buttons */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Pintasan Wilayah Terkenal:
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyPreset({
                      rt: '010',
                      rw: '003',
                      kel: 'Taman Bunga',
                      kec: 'Gerunggang',
                      kota: 'Kota Pangkalpinang',
                      pos: '33119',
                    })
                  }
                  className="text-xs border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300"
                >
                  <MapPin className="w-3.5 h-3.5" /> RT 010 / RW 003 Taman Bunga, Pangkalpinang
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyPreset({
                      rt: '05',
                      rw: '02',
                      kel: 'Sukamaju',
                      kec: 'Cilodong',
                      kota: 'Kota Depok',
                      pos: '16415',
                    })
                  }
                  className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
                >
                  <MapPin className="w-3.5 h-3.5" /> RT 05 / RW 02 Sukamaju, Depok
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyPreset({
                      rt: '003',
                      rw: '012',
                      kel: 'Teluk Pucung',
                      kec: 'Bekasi Utara',
                      kota: 'Kota Bekasi',
                      pos: '17121',
                    })
                  }
                  className="text-xs border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
                >
                  <MapPin className="w-3.5 h-3.5" /> RT 003 / RW 012 Teluk Pucung, Bekasi Utara
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
                  Perubahan akan diperbarui pada data RT: <strong>{config.displayTitle} ({config.namaKelurahan})</strong> tanpa mengubah data RT lain.
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

      {/* 4. Modal / Form Daftarkan RT Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 rounded-xl">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Daftarkan Komunitas RT Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Daftarkan RT baru untuk daerah lain (misal: RT di Bekasi, Pangkalpinang, Depok, dll). Sistem akan secara otomatis meng-generate cryptographic keypair digital Ed25519 untuk keabsahan surat resmi RT ini.
            </p>

            <form onSubmit={handleCreateRt} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nomor RT:</label>
                  <input
                    type="text"
                    value={newKodeRt}
                    onChange={(e) => setNewKodeRt(e.target.value)}
                    placeholder="Contoh: 003"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nomor RW:</label>
                  <input
                    type="text"
                    value={newKodeRw}
                    onChange={(e) => setNewKodeRw(e.target.value)}
                    placeholder="Contoh: 012"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Kelurahan / Desa:</label>
                <input
                  type="text"
                  value={newKelurahan}
                  onChange={(e) => setNewKelurahan(e.target.value)}
                  placeholder="Contoh: Teluk Pucung"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Kecamatan:</label>
                  <input
                    type="text"
                    value={newKecamatan}
                    onChange={(e) => setNewKecamatan(e.target.value)}
                    placeholder="Contoh: Bekasi Utara"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Kota / Kabupaten:</label>
                  <input
                    type="text"
                    value={newKota}
                    onChange={(e) => setNewKota(e.target.value)}
                    placeholder="Contoh: Kota Bekasi"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Kode Pos:</label>
                <input
                  type="text"
                  value={newKodePos}
                  onChange={(e) => setNewKodePos(e.target.value)}
                  placeholder="Contoh: 17121"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isCreating}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Simpan & Aktifkan RT
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
