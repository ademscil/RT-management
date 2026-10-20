import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Home,
  FileCheck,
  Eye,
  Check,
  X,
  Shield,
  PlusCircle,
  Building2,
  Edit3,
  Trash2,
  UserPlus,
  MapPin,
  KeyRound,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/auth-context.js';
import { useRtConfig } from '../context/rt-config-context.js';
import {
  Card,
  CardContent,
  Button,
  Badge,
  SearchInput,
  PaginationControl,
  PiiRevealModal,
  ForensicWatermarkedImageViewer,
  SkeletonTable,
  EmptyStateCard,
  notify,
  formatGender,
  formatGolDarah,
  formatHubunganKeluarga,
  formatDateIndo,
  formatDateInput,
} from '@simrt/ui-kit';
import type { PaginationMeta, PiiAccessReason } from '@simrt/shared-types';

interface WargaItem {
  id: string;
  namaLengkap: string;
  nikMasked: string;
  tempatLahir: string;
  tanggalLahir: string;
  gender: string;
  golonganDarah: string;
  agama: string;
  pekerjaan: string;
  statusPerkawinan: string;
  hubunganKeluarga: string;
  statusKependudukan: string;
  isLansia: boolean;
  isDisabilitas: boolean;
  isBalita: boolean;
  isIbuHamil: boolean;
  blokRumah: string;
  alamatDomisili: string;
  statusVerifikasiKk: string;
  kkId?: string;
  hasAccount?: boolean;
  userRole?: string | null;
  username?: string | null;
}

interface KkMember {
  id: string;
  namaLengkap: string;
  nikMasked: string;
  hubunganKeluarga: string;
  gender: string;
  tempatLahir: string;
  tanggalLahir: string;
  golonganDarah: string;
  agama: string;
  pekerjaan: string;
  statusPerkawinan: string;
  statusKependudukan: string;
  isLansia: boolean;
  isDisabilitas: boolean;
  isBalita: boolean;
  isIbuHamil: boolean;
  hasAccount?: boolean;
  userRole?: string | null;
  username?: string | null;
}

interface KartuKeluargaRow {
  id: string;
  rumahId: string;
  kodeBlok: string;
  nomorRumah: string;
  statusHunian: string;
  noKkMasked: string;
  nomorKkMasked: string;
  blokRumah: string;
  alamatDomisili: string;
  alamatLengkap: string;
  statusDomisili: string;
  statusVerifikasi: string;
  catatanRevisi: string | null;
  jumlahAnggota: number;
  kepalaKeluarga: string;
  anggota: KkMember[];
}

export const KependudukanPage: React.FC = () => {
  const { user } = useAuth();
  const { config } = useRtConfig();
  const defaultKota = config.namaKota.replace(/^(Kota|Kabupaten)\s+/i, '') || 'Pangkalpinang';
  const [activeTab, setActiveTab] = useState<'HOUSES' | 'CITIZENS'>('HOUSES');

  // --- TAB 1: KAVLING & KARTU KELUARGA STATE ---
  const [kkList, setKkList] = useState<KartuKeluargaRow[]>([]);
  const [kkMeta, setKkMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [kkSearch, setKkSearch] = useState('');
  const [kkStatusFilter, setKkStatusFilter] = useState('');
  const [isKkLoading, setIsKkLoading] = useState(true);

  // Modal: Tambah Blok Rumah Baru
  const [tambahRumahModalOpen, setTambahRumahModalOpen] = useState(false);
  const [rumahKodeBlok, setRumahKodeBlok] = useState('');
  const [rumahNomor, setRumahNomor] = useState('');
  const [rumahAlamat, setRumahAlamat] = useState('');
  const [rumahStatusHunian, setRumahStatusHunian] = useState('DIHUNI_PEMILIK');
  const [rumahNomorKk, setRumahNomorKk] = useState('');
  const [isSavingRumah, setIsSavingRumah] = useState(false);

  // Modal: Edit Rumah
  const [editRumahModalOpen, setEditRumahModalOpen] = useState(false);
  const [editingRumahId, setEditingRumahId] = useState('');
  const [editRumahKodeBlok, setEditRumahKodeBlok] = useState('');
  const [editRumahNomor, setEditRumahNomor] = useState('');
  const [editRumahAlamat, setEditRumahAlamat] = useState('');
  const [editRumahStatusHunian, setEditRumahStatusHunian] = useState('DIHUNI_PEMILIK');
  const [isUpdatingRumah, setIsUpdatingRumah] = useState(false);

  // Modal: Kelola Penghuni Rumah (House Workbench)
  const [houseWorkbenchOpen, setHouseWorkbenchOpen] = useState(false);
  const [selectedHouseKk, setSelectedHouseKk] = useState<KartuKeluargaRow | null>(null);

  // --- TAB 2: BUKU INDUK WARGA STATE ---
  const [wargaList, setWargaList] = useState<WargaItem[]>([]);
  const [wargaMeta, setWargaMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [wargaSearch, setWargaSearch] = useState('');
  const [golDarahFilter, setGolDarahFilter] = useState('');
  const [isWargaLoading, setIsWargaLoading] = useState(true);

  // Modal: PII Reveal
  const [piiModalOpen, setPiiModalOpen] = useState(false);
  const [piiTargetWarga, setPiiTargetWarga] = useState<WargaItem | null>(null);
  const [revealedNiks, setRevealedNiks] = useState<Record<string, string>>({});
  const [isRevealing, setIsRevealing] = useState(false);

  // Modal: Periksa Dokumen
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [workbenchWarga, setWorkbenchWarga] = useState<WargaItem | null>(null);

  // Modal: Tambah Warga Baru (Bisa untuk KK terpilih atau umum)
  const [tambahWargaModalOpen, setTambahWargaModalOpen] = useState(false);
  const [targetKkId, setTargetKkId] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formTempatLahir, setFormTempatLahir] = useState(defaultKota);
  const [formTanggalLahir, setFormTanggalLahir] = useState('1990-01-01');
  const [formGender, setFormGender] = useState('LAKI_LAKI');
  const [formGolDarah, setFormGolDarah] = useState('O_POSITIF');
  const [formAgama, setFormAgama] = useState('ISLAM');
  const [formPekerjaan, setFormPekerjaan] = useState('Karyawan Swasta');
  const [formHubungan, setFormHubungan] = useState('KEPALA_KELUARGA');
  const [formStatusKawin, setFormStatusKawin] = useState('KAWIN');
  const [formStatusKependudukan, setFormStatusKependudukan] = useState('TETAP');
  const [formIsLansia, setFormIsLansia] = useState(false);
  const [formIsDisabilitas, setFormIsDisabilitas] = useState(false);
  const [formIsBalita, setFormIsBalita] = useState(false);
  const [isSavingWarga, setIsSavingWarga] = useState(false);

  // Modal: Edit Warga
  const [editWargaModalOpen, setEditWargaModalOpen] = useState(false);
  const [editingWargaId, setEditingWargaId] = useState('');
  const [editFormNama, setEditFormNama] = useState('');
  const [editFormTempatLahir, setEditFormTempatLahir] = useState('');
  const [editFormTanggalLahir, setEditFormTanggalLahir] = useState('');
  const [editFormGender, setEditFormGender] = useState('LAKI_LAKI');
  const [editFormGolDarah, setEditFormGolDarah] = useState('O_POSITIF');
  const [editFormAgama, setEditFormAgama] = useState('ISLAM');
  const [editFormPekerjaan, setEditFormPekerjaan] = useState('');
  const [editFormHubungan, setEditFormHubungan] = useState('ANAK');
  const [editFormStatusKawin, setEditFormStatusKawin] = useState('BELUM_KAWIN');
  const [editFormStatusKependudukan, setEditFormStatusKependudukan] = useState('TETAP');
  const [editFormIsLansia, setEditFormIsLansia] = useState(false);
  const [editFormIsDisabilitas, setEditFormIsDisabilitas] = useState(false);
  const [editFormIsBalita, setEditFormIsBalita] = useState(false);
  const [isUpdatingWarga, setIsUpdatingWarga] = useState(false);

  // Modal: Buatkan Akun Login & Atur Hak Akses Warga / Pengurus
  const [akunModalOpen, setAkunModalOpen] = useState(false);
  const [targetAkunWarga, setTargetAkunWarga] = useState<KkMember | WargaItem | null>(null);
  const [akunUsername, setAkunUsername] = useState('');
  const [akunPassword, setAkunPassword] = useState('');
  const [akunRole, setAkunRole] = useState<string>('WARGA');
  const [isCreatingAkun, setIsCreatingAkun] = useState(false);

  const handleOpenBuatAkun = (w: KkMember | WargaItem) => {
    setTargetAkunWarga(w);
    const firstName = w.namaLengkap.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');
    setAkunUsername(w.username || (firstName.length >= 3 ? firstName : `warga_${firstName}`));
    setAkunPassword('');
    setAkunRole(w.userRole || 'WARGA');
    setAkunModalOpen(true);
  };

  const handleSaveAkun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAkunWarga || !akunUsername.trim()) {
      notify.error({ title: 'Data Belum Lengkap', description: 'Username login wajib diisi.' });
      return;
    }

    if (!targetAkunWarga.hasAccount && (!akunPassword.trim() || akunPassword.trim().length < 8)) {
      notify.error({ title: 'Password Wajib', description: 'Password minimal 8 karakter untuk akun baru.' });
      return;
    }

    if (akunPassword.trim() && akunPassword.trim().length < 8) {
      notify.error({ title: 'Password Kurang Panjang', description: 'Password minimal 8 karakter.' });
      return;
    }

    setIsCreatingAkun(true);
    try {
      await api.post('/auth/create-user-account', {
        wargaId: targetAkunWarga.id,
        username: akunUsername.trim().toLowerCase(),
        password: akunPassword.trim() || undefined,
        role: akunRole,
      });

      setAkunModalOpen(false);
      notify.success({
        title: targetAkunWarga.hasAccount ? 'Hak Akses / Akun Diperbarui' : 'Akun Berhasil Diaktifkan',
        description: `Akun "${akunUsername.trim().toLowerCase()}" dengan peran ${akunRole} berhasil disimpan untuk ${targetAkunWarga.namaLengkap}.`,
      });

      await fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
      await fetchWarga(wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menyimpan Akun', description: err.message });
    } finally {
      setIsCreatingAkun(false);
    }
  };

  // --- FETCH DATA HANDLERS ---
  const fetchKk = useCallback(
    async (page: number, limit: number, query: string) => {
      setIsKkLoading(true);
      try {
        const res = await api.get<{ items: KartuKeluargaRow[]; meta: PaginationMeta }>('/kependudukan/kk', {
          page,
          limit,
          search: query || undefined,
        });
        setKkList(res.items);
        setKkMeta(res.meta);

        // Update selected house workbench if currently open (using functional updater to keep callback stable)
        setSelectedHouseKk((prev) => {
          if (!prev) return null;
          const updatedSelected = res.items.find((item) => item.id === prev.id || item.rumahId === prev.rumahId);
          return updatedSelected || prev;
        });
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Data KK & Rumah', description: err.message });
      } finally {
        setIsKkLoading(false);
      }
    },
    []
  );

  const fetchWarga = useCallback(
    async (page: number, limit: number, query: string, golDarah: string) => {
      setIsWargaLoading(true);
      try {
        const res = await api.get<{ items: WargaItem[]; meta: PaginationMeta }>('/kependudukan/warga', {
          page,
          limit,
          search: query || undefined,
          golonganDarah: golDarah || undefined,
        });
        setWargaList(res.items);
        setWargaMeta(res.meta);
      } catch (err: any) {
        notify.error({ title: 'Gagal Memuat Data Warga', description: err.message });
      } finally {
        setIsWargaLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === 'HOUSES') {
      fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
    } else {
      fetchWarga(wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter);
    }
  }, [activeTab, fetchKk, fetchWarga, kkMeta.page, kkMeta.limit, kkSearch, wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter]);

  // --- RUMAH CRUD ACTIONS ---
  const handleOpenTambahRumah = () => {
    setRumahKodeBlok('');
    setRumahNomor('');
    setRumahAlamat(`Jl. ${config.namaKelurahan} No. `);
    setRumahStatusHunian('DIHUNI_PEMILIK');
    setRumahNomorKk('');
    setTambahRumahModalOpen(true);
  };

  const handleSaveRumah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rumahKodeBlok.trim() || !rumahNomor.trim() || !rumahAlamat.trim()) {
      notify.error({ title: 'Data Belum Lengkap', description: 'Kode blok, nomor rumah, dan alamat wajib diisi.' });
      return;
    }

    setIsSavingRumah(true);
    try {
      await api.post('/kependudukan/rumah', {
        kodeBlok: rumahKodeBlok.trim(),
        nomorRumah: rumahNomor.trim(),
        alamat: rumahAlamat.trim(),
        statusHunian: rumahStatusHunian,
        nomorKk: rumahNomorKk.trim() || undefined,
      });

      setTambahRumahModalOpen(false);
      notify.success({
        title: 'Blok Rumah Berhasil Ditambahkan',
        description: `Rumah ${rumahKodeBlok} No. ${rumahNomor} telah tercatat di denah lingkungan RT.`,
      });
      fetchKk(1, kkMeta.limit, '');
    } catch (err: any) {
      notify.error({ title: 'Gagal Menambah Rumah', description: err.message });
    } finally {
      setIsSavingRumah(false);
    }
  };

  const handleOpenEditRumah = (kk: KartuKeluargaRow) => {
    setEditingRumahId(kk.rumahId);
    setEditRumahKodeBlok(kk.kodeBlok);
    setEditRumahNomor(kk.nomorRumah);
    setEditRumahAlamat(kk.alamatLengkap);
    setEditRumahStatusHunian(kk.statusHunian || 'DIHUNI_PEMILIK');
    setEditRumahModalOpen(true);
  };

  const handleUpdateRumah = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingRumah(true);
    try {
      await api.put(`/kependudukan/rumah/${editingRumahId}`, {
        kodeBlok: editRumahKodeBlok.trim(),
        nomorRumah: editRumahNomor.trim(),
        alamat: editRumahAlamat.trim(),
        statusHunian: editRumahStatusHunian,
      });

      setEditRumahModalOpen(false);
      notify.success({
        title: 'Data Rumah Diperbarui',
        description: `Informasi blok rumah ${editRumahKodeBlok} telah disimpan.`,
      });
      fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
    } catch (err: any) {
      notify.error({ title: 'Gagal Memperbarui Rumah', description: err.message });
    } finally {
      setIsUpdatingRumah(false);
    }
  };

  const handleDeleteRumah = async (kk: KartuKeluargaRow) => {
    if (kk.jumlahAnggota > 0) {
      notify.error({
        title: 'Rumah Tidak Bisa Dihapus',
        description: `Masih ada ${kk.jumlahAnggota} warga terdaftar di rumah ini. Hapus atau pindahkan warga terlebih dahulu.`,
      });
      return;
    }

    if (!confirm(`Yakin ingin menghapus kavling ${kk.blokRumah}? Data yang dihapus tidak dapat dipulihkan.`)) {
      return;
    }

    try {
      await api.delete(`/kependudukan/rumah/${kk.rumahId}`);
      notify.success({
        title: 'Kavling Rumah Dihapus',
        description: `Data rumah ${kk.blokRumah} berhasil dibersihkan dari database RT.`,
      });
      fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menghapus Rumah', description: err.message });
    }
  };

  // --- WARGA CRUD ACTIONS ---
  const handleOpenTambahWargaForHouse = (kkId: string) => {
    setTargetKkId(kkId);
    setFormNama('');
    setFormNik('');
    setFormTempatLahir(defaultKota);
    setFormTanggalLahir('1990-01-01');
    setFormGender('LAKI_LAKI');
    setFormGolDarah('O_POSITIF');
    setFormAgama('ISLAM');
    setFormPekerjaan('Karyawan Swasta');
    setFormHubungan('ANAK');
    setFormStatusKawin('BELUM_KAWIN');
    setFormStatusKependudukan('TETAP');
    setFormIsLansia(false);
    setFormIsDisabilitas(false);
    setFormIsBalita(false);
    setTambahWargaModalOpen(true);
  };

  const handleSaveWarga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim() || !formNik.trim() || formNik.trim().length !== 16 || !targetKkId) {
      notify.error({
        title: 'Data Belum Lengkap',
        description: 'Nama Lengkap, NIK 16 digit, dan Kartu Keluarga wajib diisi.',
      });
      return;
    }

    setIsSavingWarga(true);
    try {
      await api.post('/kependudukan/warga', {
        kkId: targetKkId,
        namaLengkap: formNama.trim(),
        nik: formNik.trim(),
        tempatLahir: formTempatLahir.trim(),
        tanggalLahir: formTanggalLahir,
        gender: formGender,
        golonganDarah: formGolDarah,
        agama: formAgama,
        pendidikanTerakhir: 'SMA/Sederajat',
        pekerjaan: formPekerjaan.trim(),
        statusPerkawinan: formStatusKawin,
        hubunganKeluarga: formHubungan,
        statusKependudukan: formStatusKependudukan,
        isLansia: formIsLansia,
        isDisabilitas: formIsDisabilitas,
        isBalita: formIsBalita,
        isIbuHamil: false,
      });

      setTambahWargaModalOpen(false);
      notify.success({
        title: 'Warga Berhasil Ditambahkan',
        description: `Data ${formNama} telah tersimpan dan terhubung ke Kartu Keluarga.`,
      });

      await fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
      await fetchWarga(wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menambahkan Warga', description: err.message });
    } finally {
      setIsSavingWarga(false);
    }
  };

  const handleOpenEditWarga = (w: KkMember | WargaItem) => {
    setEditingWargaId(w.id);
    setEditFormNama(w.namaLengkap);
    setEditFormTempatLahir(w.tempatLahir || defaultKota);
    setEditFormTanggalLahir(formatDateInput(w.tanggalLahir) || '1990-01-01');
    setEditFormGender((w as any).gender || (w as any).jenisKelamin || 'LAKI_LAKI');
    setEditFormGolDarah(w.golonganDarah || 'O_POSITIF');
    setEditFormAgama(w.agama || 'ISLAM');
    setEditFormPekerjaan(w.pekerjaan || 'Karyawan Swasta');
    setEditFormHubungan(w.hubunganKeluarga || 'ANAK');
    setEditFormStatusKawin((w as any).statusPerkawinan || 'BELUM_KAWIN');
    setEditFormStatusKependudukan((w as any).statusKependudukan || 'TETAP');
    setEditFormIsLansia(w.isLansia || false);
    setEditFormIsDisabilitas(w.isDisabilitas || false);
    setEditFormIsBalita(w.isBalita || false);
    setEditWargaModalOpen(true);
  };

  const handleUpdateWarga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormNama.trim()) {
      notify.error({ title: 'Nama Wajib Diisi', description: 'Silakan masukkan nama lengkap.' });
      return;
    }

    setIsUpdatingWarga(true);
    try {
      await api.put(`/kependudukan/warga/${editingWargaId}`, {
        namaLengkap: editFormNama.trim(),
        tempatLahir: editFormTempatLahir.trim(),
        tanggalLahir: editFormTanggalLahir,
        gender: editFormGender,
        golonganDarah: editFormGolDarah,
        agama: editFormAgama,
        pekerjaan: editFormPekerjaan.trim(),
        statusPerkawinan: editFormStatusKawin,
        hubunganKeluarga: editFormHubungan,
        statusKependudukan: editFormStatusKependudukan,
        isLansia: editFormIsLansia,
        isDisabilitas: editFormIsDisabilitas,
        isBalita: editFormIsBalita,
      });

      setEditWargaModalOpen(false);
      notify.success({
        title: 'Data Warga Diperbarui',
        description: `Informasi ${editFormNama} berhasil disimpan ke Buku Induk.`,
      });

      await fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
      await fetchWarga(wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter);
    } catch (err: any) {
      notify.error({ title: 'Gagal Memperbarui Warga', description: err.message });
    } finally {
      setIsUpdatingWarga(false);
    }
  };

  const handleDeleteWarga = async (wargaId: string, namaWarga: string) => {
    if (!confirm(`Yakin ingin menghapus ${namaWarga} dari database kependudukan RT?`)) {
      return;
    }

    try {
      await api.delete(`/kependudukan/warga/${wargaId}`);
      notify.success({
        title: 'Data Warga Dihapus',
        description: `${namaWarga} berhasil dihapus dari Kartu Keluarga.`,
      });

      await fetchKk(kkMeta.page, kkMeta.limit, kkSearch);
      await fetchWarga(wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter);
      fetchWarga(wargaMeta.page, wargaMeta.limit, wargaSearch, golDarahFilter);
    } catch (err: any) {
      notify.error({ title: 'Gagal Menghapus Warga', description: err.message });
    }
  };

  // --- PII REVEAL ACTIONS ---
  const handleOpenPiiModal = (warga: WargaItem) => {
    setPiiTargetWarga(warga);
    setPiiModalOpen(true);
  };

  const handleConfirmPii = async (reason: PiiAccessReason) => {
    if (!piiTargetWarga) return;
    setIsRevealing(true);
    try {
      const res = await api.post<{ value: string; auditId: string }>('/kependudukan/reveal-pii', {
        wargaId: piiTargetWarga.id,
        field: 'NIK',
        reason,
      });

      setRevealedNiks((prev) => ({ ...prev, [piiTargetWarga.id]: res.value }));
      setPiiModalOpen(false);

      notify.security({
        title: 'NIK Lengkap Terbuka',
        description: `NIK ${piiTargetWarga.namaLengkap} dibuka untuk keperluan: ${reason}`,
        auditId: res.auditId,
      });
    } catch (err: any) {
      notify.error({
        title: 'Gagal Membuka NIK',
        description: err.message,
        errorCode: err.code,
      });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleOpenWorkbench = (warga: WargaItem) => {
    setWorkbenchWarga(warga);
    setWorkbenchOpen(true);
  };

  // Filtered houses
  const filteredKkList = kkList.filter((k) => {
    if (kkStatusFilter && k.statusHunian !== kkStatusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Dual Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-700" />
            Buku Induk Kependudukan & Kavling RT 05 / RW 02
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manajemen blok kavling rumah, Kartu Keluarga, dan pengelolaan data warga terenkripsi standar UU PDP
          </p>
        </div>

        {/* Primary Tab Switcher */}
        <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('HOUSES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'HOUSES'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Kavling & Kartu Keluarga ({kkMeta.total})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CITIZENS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'CITIZENS'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Buku Induk Warga ({wargaMeta.total})</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: KAVLING & KARTU KELUARGA (MANAGE RUMAH & ANGGOTA)  */}
      {/* ========================================================= */}
      {activeTab === 'HOUSES' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex-1 w-full sm:max-w-md">
                <SearchInput
                  placeholder="Cari nomor blok, alamat, atau kepala keluarga... (tekan /)"
                  onChange={(val) => {
                    setKkSearch(val);
                    setKkMeta((prev) => ({ ...prev, page: 1 }));
                  }}
                  isLoading={isKkLoading}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <select
                  id="filter-status-hunian"
                  name="statusHunianFilter"
                  aria-label="Filter Status Hunian"
                  value={kkStatusFilter}
                  onChange={(e) => setKkStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-600 outline-none"
                >
                  <option value="">Semua Status Hunian</option>
                  <option value="DIHUNI_PEMILIK">Dihuni Pemilik</option>
                  <option value="DIHUNI_PENYEWA">Dihuni Penyewa</option>
                  <option value="KOSONG">Rumah Kosong</option>
                </select>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleOpenTambahRumah}
                  className="text-xs font-bold whitespace-nowrap shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" /> Tambah Blok Rumah
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* House Blocks Grid Cards */}
          {isKkLoading ? (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <SkeletonTable rows={6} columns={4} />
            </div>
          ) : filteredKkList.length === 0 ? (
            <EmptyStateCard
              title="Tidak Ada Kavling Rumah Ditemukan"
              description="Coba ubah kata kunci pencarian atau daftarkan blok kavling baru."
              actionLabel="Tambah Blok Baru"
              onAction={handleOpenTambahRumah}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKkList.map((kk) => {
                const isKosong = kk.statusHunian === 'KOSONG';
                const isPenyewa = kk.statusHunian === 'DIHUNI_PENYEWA';
                return (
                  <Card key={kk.id} className="overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
                    <CardContent className="p-5 space-y-4">
                      {/* Card Header: Blok Number & Occupancy Status */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-black text-sm shrink-0">
                            {kk.kodeBlok}
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                              {kk.blokRumah}
                            </h3>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]" title={kk.alamatLengkap}>
                              {kk.alamatLengkap}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={isKosong ? 'outline' : isPenyewa ? 'warning' : 'success'}
                          className="shrink-0 text-[10px]"
                        >
                          {isKosong ? 'Rumah Kosong' : isPenyewa ? 'Dihuni Penyewa' : 'Dihuni Pemilik'}
                        </Badge>
                      </div>

                      {/* Card Body: Family & Residents Overview */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Kepala Keluarga:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {kk.kepalaKeluarga}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Nomor Kartu Keluarga:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {kk.nomorKkMasked}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total Penghuni:</span>
                          <span className="font-bold text-teal-700 dark:text-teal-400">
                            {kk.jumlahAnggota} Orang Terdaftar
                          </span>
                        </div>

                        {/* Vulnerability indicators if any */}
                        {kk.anggota && kk.anggota.some((a) => a.isLansia || a.isDisabilitas || a.isBalita) && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {kk.anggota.some((a) => a.isLansia) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold border border-amber-200">
                                Lansia
                              </span>
                            )}
                            {kk.anggota.some((a) => a.isBalita) && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-bold border border-blue-200">
                                Balita
                              </span>
                            )}
                            {kk.anggota.some((a) => a.isDisabilitas) && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-bold border border-rose-200">
                                Disabilitas
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedHouseKk(kk);
                            setHouseWorkbenchOpen(true);
                          }}
                          className="flex-1 text-xs font-bold"
                          title="Buka panel kelola penghuni di rumah ini"
                        >
                          <Users className="w-3.5 h-3.5" /> Kelola Penghuni
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditRumah(kk)}
                          className="px-2.5"
                          title="Edit Blok & Alamat Rumah"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRumah(kk)}
                          className="px-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Hapus Rumah Kosong"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          <Card>
            <CardContent className="p-2">
              <PaginationControl
                meta={kkMeta}
                onPageChange={(p) => setKkMeta((prev) => ({ ...prev, page: p }))}
                onLimitChange={(l) => setKkMeta((prev) => ({ ...prev, limit: l, page: 1 }))}
                isLoading={isKkLoading}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BUKU INDUK WARGA (INDIVIDU CENSUS DATABASE)        */}
      {/* ========================================================= */}
      {activeTab === 'CITIZENS' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <SearchInput
                placeholder="Cari nama warga, NIK, atau nomor rumah... (tekan /)"
                onChange={(val) => {
                  setWargaSearch(val);
                  setWargaMeta((prev) => ({ ...prev, page: 1 }));
                }}
                isLoading={isWargaLoading}
                className="w-full sm:max-w-md"
              />

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <select
                  id="filter-golongan-darah"
                  name="golDarahFilter"
                  aria-label="Filter Golongan Darah"
                  value={golDarahFilter}
                  onChange={(e) => {
                    setGolDarahFilter(e.target.value);
                    setWargaMeta((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-600 outline-none"
                >
                  <option value="">Semua Gol. Darah</option>
                  <option value="A_POSITIF">Gol. A+</option>
                  <option value="B_POSITIF">Gol. B+</option>
                  <option value="AB_POSITIF">Gol. AB+</option>
                  <option value="O_POSITIF">Gol. O+</option>
                </select>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (kkList.length > 0) {
                      handleOpenTambahWargaForHouse(kkList[0].id);
                    } else {
                      notify.error({ title: 'Kavling Belum Ada', description: 'Buat blok rumah terlebih dahulu di Tab Kavling & KK.' });
                    }
                  }}
                  className="text-xs font-bold whitespace-nowrap"
                >
                  <PlusCircle className="w-4 h-4" /> Daftarkan Warga Baru
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Citizen Table */}
          <Card>
            <CardContent className="p-0">
              {isWargaLoading ? (
                <div className="p-6">
                  <SkeletonTable rows={8} columns={6} />
                </div>
              ) : wargaList.length === 0 ? (
                <EmptyStateCard
                  title="Tidak Ada Data Warga Ditemukan"
                  description="Coba ubah kata kunci pencarian atau reset filter golongan darah."
                  actionLabel="Reset Pencarian"
                  onAction={() => {
                    setWargaSearch('');
                    setGolDarahFilter('');
                  }}
                />
              ) : (
                <div className="overflow-x-auto scrollbar-slim">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3.5 px-4">Nama Lengkap & Hubungan</th>
                        <th className="py-3.5 px-4">Nomor NIK</th>
                        <th className="py-3.5 px-4">Kavling / Domisili</th>
                        <th className="py-3.5 px-4">TTL & Kelamin</th>
                        <th className="py-3.5 px-4">Gol. Darah</th>
                        <th className="py-3.5 px-4 text-right">Aksi Kelola</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {wargaList.map((w) => {
                        const isRevealed = !!revealedNiks[w.id];
                        return (
                          <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{w.namaLengkap}</div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <Badge variant={w.hubunganKeluarga === 'KEPALA_KELUARGA' ? 'default' : 'outline'} className="text-[10px]">
                                  {formatHubunganKeluarga(w.hubunganKeluarga)}
                                </Badge>
                                {w.userRole && (
                                  <Badge
                                    variant={
                                      w.userRole === 'SUPERUSER' ? 'pii' :
                                      w.userRole === 'KETUA_RT' ? 'warning' :
                                      w.userRole === 'BENDAHARA' ? 'success' :
                                      w.userRole === 'SEKRETARIS' ? 'default' : 'outline'
                                    }
                                    className={`text-[10px] font-bold ${
                                      w.userRole === 'SEKRETARIS' ? 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300' : ''
                                    }`}
                                  >
                                    {w.userRole === 'SUPERUSER' ? '★ Superuser' :
                                     w.userRole === 'KETUA_RT' ? 'Ketua RT' :
                                     w.userRole === 'SEKRETARIS' ? 'Sekretaris' :
                                     w.userRole === 'BENDAHARA' ? 'Bendahara' : 'Akun Warga'}
                                  </Badge>
                                )}
                                {w.isLansia && <Badge variant="warning" className="text-[10px]">Lansia</Badge>}
                                {w.isDisabilitas && <Badge variant="destructive" className="text-[10px]">Disabilitas</Badge>}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              {isRevealed ? (
                                <span className="font-bold text-teal-800 bg-teal-50 px-2 py-1 rounded-md border border-teal-200">
                                  {revealedNiks[w.id]}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 dark:text-slate-400">{w.nikMasked}</span>
                                  <button
                                    onClick={() => handleOpenPiiModal(w)}
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors"
                                    title="Buka NIK Lengkap (Keperluan Administrasi Resmi)"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <strong className="text-slate-900 dark:text-slate-200">{w.blokRumah}</strong>
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">{w.alamatDomisili}</p>
                            </td>

                            <td className="py-3.5 px-4">
                              <div>{w.tempatLahir}, {formatDateIndo(w.tanggalLahir)}</div>
                              <span className="text-[11px] text-slate-500">{formatGender(w.gender)}</span>
                            </td>

                            <td className="py-3.5 px-4">
                              <Badge variant="destructive" className="font-mono text-[10px]">
                                {formatGolDarah(w.golonganDarah)}
                              </Badge>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant={w.hasAccount ? 'outline' : 'primary'}
                                  size="sm"
                                  onClick={() => handleOpenBuatAkun(w)}
                                  className={`text-xs px-2 ${
                                    w.hasAccount
                                      ? 'text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40'
                                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                                  }`}
                                  title={w.hasAccount ? 'Atur Akun Login & Hak Akses Pengurus' : 'Buatkan Akun Login & Tentukan Peran'}
                                >
                                  <KeyRound className="w-3.5 h-3.5" /> {w.hasAccount ? 'Atur Akun' : 'Buat Akun'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEditWarga(w)}
                                  className="text-xs px-2.5"
                                  title="Edit Biodata Warga"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenWorkbench(w)}
                                  className="text-xs px-2.5"
                                  title="Periksa Berkas Dokumen KTP"
                                >
                                  <FileCheck className="w-3.5 h-3.5 text-teal-700" /> Berkas
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteWarga(w.id, w.namaLengkap)}
                                  className="text-xs px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  title="Hapus Data Warga"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                <PaginationControl
                  meta={wargaMeta}
                  onPageChange={(p) => setWargaMeta((prev) => ({ ...prev, page: p }))}
                  onLimitChange={(l) => setWargaMeta((prev) => ({ ...prev, limit: l, page: 1 }))}
                  isLoading={isWargaLoading}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: WORKBENCH KELOLA PENGHUNI RUMAH                  */}
      {/* ========================================================= */}
      {houseWorkbenchOpen && selectedHouseKk && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white font-black flex items-center justify-center text-sm shadow-md">
                  {selectedHouseKk.kodeBlok}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Kelola Penghuni: {selectedHouseKk.blokRumah}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600" /> {selectedHouseKk.alamatLengkap} • No. KK: {selectedHouseKk.nomorKkMasked}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenTambahWargaForHouse(selectedHouseKk.id)}
                  className="text-xs font-bold shadow-xs"
                >
                  <UserPlus className="w-4 h-4" /> Tambah Anggota ke Rumah Ini
                </Button>
                <button
                  type="button"
                  onClick={() => setHouseWorkbenchOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content: Members List */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar Anggota Keluarga ({selectedHouseKk.anggota.length} Orang Terdaftar)
                </h4>
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                  Status Domisili: {selectedHouseKk.statusDomisili || 'TETAP'}
                </span>
              </div>

              {selectedHouseKk.anggota.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                  <Users className="w-10 h-10 text-slate-400 mx-auto" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum Ada Warga Terdaftar di Rumah Ini</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Klik tombol "Tambah Anggota ke Rumah Ini" di atas untuk mendaftarkan Kepala Keluarga atau anggota keluarga.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedHouseKk.anggota.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-teal-500/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                          {member.namaLengkap.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {member.namaLengkap}
                            </h5>
                            <Badge
                              variant={member.hubunganKeluarga === 'KEPALA_KELUARGA' ? 'default' : 'outline'}
                              className="text-[10px]"
                            >
                              {formatHubunganKeluarga(member.hubunganKeluarga)}
                            </Badge>
                            {member.userRole && (
                              <Badge
                                variant={
                                  member.userRole === 'SUPERUSER' ? 'pii' :
                                  member.userRole === 'KETUA_RT' ? 'warning' :
                                  member.userRole === 'BENDAHARA' ? 'success' :
                                  member.userRole === 'SEKRETARIS' ? 'default' : 'outline'
                                }
                                className={`text-[10px] font-bold ${
                                  member.userRole === 'SEKRETARIS' ? 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300' : ''
                                }`}
                              >
                                {member.userRole === 'SUPERUSER' ? '★ Superuser' :
                                 member.userRole === 'KETUA_RT' ? 'Ketua RT' :
                                 member.userRole === 'SEKRETARIS' ? 'Sekretaris' :
                                 member.userRole === 'BENDAHARA' ? 'Bendahara' : 'Akun Warga'}
                              </Badge>
                            )}
                            {member.isLansia && <Badge variant="warning" className="text-[10px]">Lansia</Badge>}
                            {member.isBalita && <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700">Balita</Badge>}
                            {member.isDisabilitas && <Badge variant="destructive" className="text-[10px]">Disabilitas</Badge>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                            <span className="font-mono">NIK: {member.nikMasked}</span>
                            <span>•</span>
                            <span>{formatGender(member.gender || (member as any).jenisKelamin)}</span>
                            <span>•</span>
                            <span>{member.tempatLahir}, {formatDateIndo(member.tanggalLahir)}</span>
                            <span>•</span>
                            <span>Gol. Darah: {formatGolDarah(member.golonganDarah)}</span>
                            <span>•</span>
                            <span>Pekerjaan: {member.pekerjaan || '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
                        <Button
                          variant={member.hasAccount ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => handleOpenBuatAkun(member)}
                          className={`text-xs ${
                            member.hasAccount
                              ? 'text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40'
                              : 'bg-teal-600 hover:bg-teal-700 text-white'
                          }`}
                          title={member.hasAccount ? 'Atur Akun Login & Hak Akses Pengurus' : 'Buatkan Akun Login & Tentukan Peran'}
                        >
                          <KeyRound className="w-3.5 h-3.5" /> {member.hasAccount ? 'Atur Akun' : 'Buat Akun'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditWarga(member)}
                          className="text-xs"
                          title="Ubah Biodata Warga"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWarga(member.id, member.namaLengkap)}
                          className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          title="Hapus Warga dari KK Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 2: TAMBAH BLOK RUMAH BARU                           */}
      {/* ========================================================= */}
      {tambahRumahModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tambah Blok Rumah / Kavling</h3>
                  <p className="text-[11px] text-slate-500">Daftarkan nomor rumah baru ke denah RT 05</p>
                </div>
              </div>
              <button type="button" onClick={() => setTambahRumahModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRumah} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="tambah-kode-blok" className="font-semibold text-slate-700 dark:text-slate-300">
                    Kode Blok:
                  </label>
                  <input
                    id="tambah-kode-blok"
                    name="kodeBlok"
                    type="text"
                    placeholder="Contoh: A1 atau B2"
                    value={rumahKodeBlok}
                    onChange={(e) => setRumahKodeBlok(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold uppercase"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="tambah-nomor-rumah" className="font-semibold text-slate-700 dark:text-slate-300">
                    Nomor Rumah:
                  </label>
                  <input
                    id="tambah-nomor-rumah"
                    name="nomorRumah"
                    type="text"
                    placeholder="Contoh: 05"
                    value={rumahNomor}
                    onChange={(e) => setRumahNomor(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="tambah-alamat-rumah" className="font-semibold text-slate-700 dark:text-slate-300">
                  Alamat Lengkap Jalan:
                </label>
                <input
                  id="tambah-alamat-rumah"
                  name="alamat"
                  type="text"
                  placeholder={`Contoh: Jl. ${config.namaKelurahan} No. 05`}
                  value={rumahAlamat}
                  onChange={(e) => setRumahAlamat(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="tambah-status-hunian" className="font-semibold text-slate-700 dark:text-slate-300">
                  Status Hunian Saat Ini:
                </label>
                <select
                  id="tambah-status-hunian"
                  name="statusHunian"
                  value={rumahStatusHunian}
                  onChange={(e) => setRumahStatusHunian(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  <option value="DIHUNI_PEMILIK">Dihuni Pemilik Sendiri</option>
                  <option value="DIHUNI_PENYEWA">Dihuni Penyewa / Pengontrak</option>
                  <option value="KOSONG">Rumah Kosong (Belum Berpenghuni)</option>
                </select>
              </div>

              <div className="space-y-1 pt-1">
                <label htmlFor="tambah-nomor-kk" className="font-semibold text-slate-700 dark:text-slate-300">
                  Nomor Kartu Keluarga Awal (Opsional):
                </label>
                <input
                  id="tambah-nomor-kk"
                  name="nomorKk"
                  type="text"
                  placeholder="16 digit nomor KK jika sudah ada..."
                  value={rumahNomorKk}
                  onChange={(e) => setRumahNomorKk(e.target.value.replace(/\D/g, '').substring(0, 16))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500">Dapat diisi nanti saat warga pertama kali mendaftar.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setTambahRumahModalOpen(false)} disabled={isSavingRumah}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSavingRumah}>
                  Simpan Blok Rumah
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EDIT RUMAH / KAVLING                             */}
      {/* ========================================================= */}
      {editRumahModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Edit Blok Rumah</h3>
                  <p className="text-[11px] text-slate-500">Perbarui identitas kavling dan status hunian</p>
                </div>
              </div>
              <button type="button" onClick={() => setEditRumahModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRumah} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-kode-blok" className="font-semibold text-slate-700 dark:text-slate-300">
                    Kode Blok:
                  </label>
                  <input
                    id="edit-kode-blok"
                    name="kodeBlok"
                    type="text"
                    value={editRumahKodeBlok}
                    onChange={(e) => setEditRumahKodeBlok(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold uppercase"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-nomor-rumah" className="font-semibold text-slate-700 dark:text-slate-300">
                    Nomor Rumah:
                  </label>
                  <input
                    id="edit-nomor-rumah"
                    name="nomorRumah"
                    type="text"
                    value={editRumahNomor}
                    onChange={(e) => setEditRumahNomor(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-alamat-rumah" className="font-semibold text-slate-700 dark:text-slate-300">
                  Alamat Lengkap Jalan:
                </label>
                <input
                  id="edit-alamat-rumah"
                  name="alamat"
                  type="text"
                  value={editRumahAlamat}
                  onChange={(e) => setEditRumahAlamat(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-status-hunian" className="font-semibold text-slate-700 dark:text-slate-300">
                  Status Hunian:
                </label>
                <select
                  id="edit-status-hunian"
                  name="statusHunian"
                  value={editRumahStatusHunian}
                  onChange={(e) => setEditRumahStatusHunian(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                >
                  <option value="DIHUNI_PEMILIK">Dihuni Pemilik Sendiri</option>
                  <option value="DIHUNI_PENYEWA">Dihuni Penyewa / Pengontrak</option>
                  <option value="KOSONG">Rumah Kosong (Belum Berpenghuni)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setEditRumahModalOpen(false)} disabled={isUpdatingRumah}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isUpdatingRumah}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 4: TAMBAH WARGA BARU (KE KK TERTENTU)               */}
      {/* ========================================================= */}
      {tambahWargaModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Daftarkan Warga ke Kartu Keluarga
                  </h3>
                  <p className="text-[11px] text-slate-500">Pendaftaran data terenkripsi standar UU PDP No. 27/2022</p>
                </div>
              </div>
              <button type="button" onClick={() => setTambahWargaModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarga} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="warga-target-kk-id" className="font-semibold text-slate-700 dark:text-slate-300">
                  Target Rumah & Kartu Keluarga:
                </label>
                <select
                  id="warga-target-kk-id"
                  name="kkId"
                  value={targetKkId}
                  onChange={(e) => setTargetKkId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  required
                >
                  {kkList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.blokRumah} — KK: {k.nomorKkMasked} ({k.kepalaKeluarga})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-nama" className="font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap (Sesuai KTP):</label>
                  <input
                    id="warga-baru-nama"
                    name="namaLengkap"
                    type="text"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="warga-baru-nik" className="font-semibold text-slate-700 dark:text-slate-300">NIK (16 Digit Angka):</label>
                  <input
                    id="warga-baru-nik"
                    name="nik"
                    type="text"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value.replace(/\D/g, '').substring(0, 16))}
                    placeholder="Contoh: 3276012304900001"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-tempat-lahir" className="font-semibold text-slate-700 dark:text-slate-300">Tempat Lahir:</label>
                  <input
                    id="warga-baru-tempat-lahir"
                    name="tempatLahir"
                    type="text"
                    value={formTempatLahir}
                    onChange={(e) => setFormTempatLahir(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-tanggal-lahir" className="font-semibold text-slate-700 dark:text-slate-300">Tanggal Lahir:</label>
                  <input
                    id="warga-baru-tanggal-lahir"
                    name="tanggalLahir"
                    type="date"
                    value={formTanggalLahir}
                    onChange={(e) => setFormTanggalLahir(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-gender" className="font-semibold text-slate-700 dark:text-slate-300">Jenis Kelamin:</label>
                  <select
                    id="warga-baru-gender"
                    name="gender"
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="LAKI_LAKI">Laki-Laki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-gol-darah" className="font-semibold text-slate-700 dark:text-slate-300">Gol. Darah:</label>
                  <select
                    id="warga-baru-gol-darah"
                    name="golDarah"
                    value={formGolDarah}
                    onChange={(e) => setFormGolDarah(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  >
                    <option value="A_POSITIF">A+</option>
                    <option value="A_NEGATIF">A-</option>
                    <option value="B_POSITIF">B+</option>
                    <option value="B_NEGATIF">B-</option>
                    <option value="AB_POSITIF">AB+</option>
                    <option value="AB_NEGATIF">AB-</option>
                    <option value="O_POSITIF">O+</option>
                    <option value="O_NEGATIF">O-</option>
                    <option value="TIDAK_TAHU">Tidak Tahu</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-hubungan" className="font-semibold text-slate-700 dark:text-slate-300">Hubungan:</label>
                  <select
                    id="warga-baru-hubungan"
                    name="hubungan"
                    value={formHubungan}
                    onChange={(e) => setFormHubungan(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="KEPALA_KELUARGA">Kepala Keluarga</option>
                    <option value="SUAMI">Suami</option>
                    <option value="ISTRI">Istri</option>
                    <option value="ANAK">Anak</option>
                    <option value="MENANTU">Menantu</option>
                    <option value="CUCU">Cucu</option>
                    <option value="ORANG_TUA">Orang Tua</option>
                    <option value="MERTUA">Mertua</option>
                    <option value="FAMILI_LAIN">Famili Lain</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="warga-baru-pekerjaan" className="font-semibold text-slate-700 dark:text-slate-300">Pekerjaan:</label>
                  <input
                    id="warga-baru-pekerjaan"
                    name="pekerjaan"
                    type="text"
                    value={formPekerjaan}
                    onChange={(e) => setFormPekerjaan(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="warga-baru-agama" className="font-semibold text-slate-700 dark:text-slate-300">Agama:</label>
                  <select
                    id="warga-baru-agama"
                    name="agama"
                    value={formAgama}
                    onChange={(e) => setFormAgama(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="ISLAM">Islam</option>
                    <option value="KRISTEN">Kristen</option>
                    <option value="KATOLIK">Katolik</option>
                    <option value="HINDU">Hindu</option>
                    <option value="BUDDHA">Buddha</option>
                    <option value="KHONGHUCU">Khonghucu</option>
                    <option value="PENGHAYAT">Penghayat Kepercayaan</option>
                  </select>
                </div>
              </div>

              {/* Vulnerability Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4">
                <label htmlFor="warga-baru-is-lansia" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="warga-baru-is-lansia"
                    name="isLansia"
                    type="checkbox"
                    checked={formIsLansia}
                    onChange={(e) => setFormIsLansia(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Lansia (60+ thn)</span>
                </label>
                <label htmlFor="warga-baru-is-disabilitas" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="warga-baru-is-disabilitas"
                    name="isDisabilitas"
                    type="checkbox"
                    checked={formIsDisabilitas}
                    onChange={(e) => setFormIsDisabilitas(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Disabilitas</span>
                </label>
                <label htmlFor="warga-baru-is-balita" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="warga-baru-is-balita"
                    name="isBalita"
                    type="checkbox"
                    checked={formIsBalita}
                    onChange={(e) => setFormIsBalita(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Balita</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setTambahWargaModalOpen(false)} disabled={isSavingWarga}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSavingWarga}>
                  Simpan Data Warga
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 5: EDIT BIODATA WARGA                               */}
      {/* ========================================================= */}
      {editWargaModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Edit Biodata Warga</h3>
                  <p className="text-[11px] text-slate-500">Perbarui informasi kependudukan warga</p>
                </div>
              </div>
              <button type="button" onClick={() => setEditWargaModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateWarga} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="edit-warga-nama" className="font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap:</label>
                <input
                  id="edit-warga-nama"
                  name="namaLengkap"
                  type="text"
                  value={editFormNama}
                  onChange={(e) => setEditFormNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-warga-tempat-lahir" className="font-semibold text-slate-700 dark:text-slate-300">Tempat Lahir:</label>
                  <input
                    id="edit-warga-tempat-lahir"
                    name="tempatLahir"
                    type="text"
                    value={editFormTempatLahir}
                    onChange={(e) => setEditFormTempatLahir(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-warga-tanggal-lahir" className="font-semibold text-slate-700 dark:text-slate-300">Tanggal Lahir:</label>
                  <input
                    id="edit-warga-tanggal-lahir"
                    name="tanggalLahir"
                    type="date"
                    value={editFormTanggalLahir}
                    onChange={(e) => setEditFormTanggalLahir(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="edit-warga-gender" className="font-semibold text-slate-700 dark:text-slate-300">Jenis Kelamin:</label>
                  <select
                    id="edit-warga-gender"
                    name="gender"
                    value={editFormGender}
                    onChange={(e) => setEditFormGender(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="LAKI_LAKI">Laki-Laki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-warga-gol-darah" className="font-semibold text-slate-700 dark:text-slate-300">Gol. Darah:</label>
                  <select
                    id="edit-warga-gol-darah"
                    name="golDarah"
                    value={editFormGolDarah}
                    onChange={(e) => setEditFormGolDarah(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  >
                    <option value="A_POSITIF">A+</option>
                    <option value="A_NEGATIF">A-</option>
                    <option value="B_POSITIF">B+</option>
                    <option value="B_NEGATIF">B-</option>
                    <option value="AB_POSITIF">AB+</option>
                    <option value="AB_NEGATIF">AB-</option>
                    <option value="O_POSITIF">O+</option>
                    <option value="O_NEGATIF">O-</option>
                    <option value="TIDAK_TAHU">Tidak Tahu</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-warga-hubungan" className="font-semibold text-slate-700 dark:text-slate-300">Hubungan:</label>
                  <select
                    id="edit-warga-hubungan"
                    name="hubungan"
                    value={editFormHubungan}
                    onChange={(e) => setEditFormHubungan(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="KEPALA_KELUARGA">Kepala Keluarga</option>
                    <option value="SUAMI">Suami</option>
                    <option value="ISTRI">Istri</option>
                    <option value="ANAK">Anak</option>
                    <option value="MENANTU">Menantu</option>
                    <option value="CUCU">Cucu</option>
                    <option value="ORANG_TUA">Orang Tua</option>
                    <option value="MERTUA">Mertua</option>
                    <option value="FAMILI_LAIN">Famili Lain</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="edit-warga-pekerjaan" className="font-semibold text-slate-700 dark:text-slate-300">Pekerjaan:</label>
                  <input
                    id="edit-warga-pekerjaan"
                    name="pekerjaan"
                    type="text"
                    value={editFormPekerjaan}
                    onChange={(e) => setEditFormPekerjaan(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-warga-agama" className="font-semibold text-slate-700 dark:text-slate-300">Agama:</label>
                  <select
                    id="edit-warga-agama"
                    name="agama"
                    value={editFormAgama}
                    onChange={(e) => setEditFormAgama(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="ISLAM">Islam</option>
                    <option value="KRISTEN">Kristen</option>
                    <option value="KATOLIK">Katolik</option>
                    <option value="HINDU">Hindu</option>
                    <option value="BUDDHA">Buddha</option>
                    <option value="KHONGHUCU">Khonghucu</option>
                    <option value="PENGHAYAT">Penghayat Kepercayaan</option>
                  </select>
                </div>
              </div>

              {/* Vulnerabilities */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4">
                <label htmlFor="edit-warga-is-lansia" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="edit-warga-is-lansia"
                    name="isLansia"
                    type="checkbox"
                    checked={editFormIsLansia}
                    onChange={(e) => setEditFormIsLansia(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Lansia (60+ thn)</span>
                </label>
                <label htmlFor="edit-warga-is-disabilitas" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="edit-warga-is-disabilitas"
                    name="isDisabilitas"
                    type="checkbox"
                    checked={editFormIsDisabilitas}
                    onChange={(e) => setEditFormIsDisabilitas(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Disabilitas</span>
                </label>
                <label htmlFor="edit-warga-is-balita" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="edit-warga-is-balita"
                    name="isBalita"
                    type="checkbox"
                    checked={editFormIsBalita}
                    onChange={(e) => setEditFormIsBalita(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Balita</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setEditWargaModalOpen(false)} disabled={isUpdatingWarga}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isUpdatingWarga}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 6: PII REVEAL MODAL                                 */}
      {/* ========================================================= */}
      {piiTargetWarga && (
        <PiiRevealModal
          isOpen={piiModalOpen}
          onClose={() => setPiiModalOpen(false)}
          wargaNama={piiTargetWarga.namaLengkap}
          field="NIK"
          onConfirm={handleConfirmPii}
          isLoading={isRevealing}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 7: PERIKSA BERKAS DOKUMEN KTP/KK                   */}
      {/* ========================================================= */}
      {workbenchOpen && workbenchWarga && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal-700" /> Pemeriksaan & Pencocokan Berkas Dokumen Warga
                </h3>
                <p className="text-xs text-slate-500">
                  Warga: <strong>{workbenchWarga.namaLengkap}</strong> ({workbenchWarga.blokRumah})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkbenchOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Panels */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {/* Left Panel: Foto Dokumen */}
              <div className="p-4 flex flex-col h-full bg-slate-950">
                <ForensicWatermarkedImageViewer
                  imageSrc="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='380' viewBox='0 0 600 380'><rect width='600' height='380' fill='%231e293b' rx='16'/><text x='50' y='50' fill='%23ffffff' font-family='sans-serif' font-size='20' font-weight='bold'>REPUBLIK INDONESIA - KTP SAMPLE</text><rect x='50' y='80' width='120' height='160' fill='%23334155' rx='8'/><text x='200' y='100' fill='%2394a3b8' font-size='14'>NIK: 327601************</text><text x='200' y='130' fill='%23ffffff' font-size='16' font-weight='bold'>DOKUMEN TERVERIFIKASI RT</text></svg>"
                  adminName={user?.namaLengkap || 'PENGURUS RT'}
                  adminIp="127.0.0.1"
                  className="h-full"
                />
              </div>

              {/* Right Panel: Form Validasi */}
              <div className="p-6 overflow-y-auto space-y-5">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-2">
                    Cocokkan Data Fisik dengan Buku Induk
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold">Nama Lengkap</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.namaLengkap}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Hubungan Keluarga</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{formatHubunganKeluarga(workbenchWarga.hubunganKeluarga)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Tempat, Tanggal Lahir</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {workbenchWarga.tempatLahir}, {formatDateIndo(workbenchWarga.tanggalLahir)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Pekerjaan</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{workbenchWarga.pekerjaan}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label htmlFor="catatan-verifikasi-berkas" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Catatan Verifikasi / Alasan Perbaikan:
                  </label>
                  <textarea
                    id="catatan-verifikasi-berkas"
                    name="catatanVerifikasi"
                    rows={3}
                    placeholder="Masukkan catatan jika ada perbaikan nama, ejaan tanggal lahir, atau foto kurang jelas..."
                    className="w-full p-3 text-xs border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={() => {
                      notify.warning({ title: 'Revisi Diminta', description: 'Permintaan perbaikan berkas telah dicatat.' });
                      setWorkbenchOpen(false);
                    }}
                  >
                    <X className="w-4 h-4" /> Minta Unggah Ulang
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      notify.success({ title: 'Berkas Sah Diverifikasi', description: 'Data kependudukan telah diverifikasi oleh pengurus.' });
                      setWorkbenchOpen(false);
                    }}
                  >
                    <Check className="w-4 h-4" /> Setujui Berkas Warga
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ========================================================= */}
      {/* MODAL 8: ATUR AKUN LOGIN WARGA                            */}
      {/* ========================================================= */}
      {akunModalOpen && targetAkunWarga && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {targetAkunWarga.hasAccount ? 'Atur Hak Akses & Akun' : 'Buatkan Akun & Tentukan Peran'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Tentukan wewenang Pengurus RT atau akun Warga Mobile</p>
                </div>
              </div>
              <button type="button" onClick={() => setAkunModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Nama Lengkap:</span>
                <strong className="text-slate-800 dark:text-slate-200">{targetAkunWarga.namaLengkap}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NIK:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{targetAkunWarga.nikMasked}</span>
              </div>
              {targetAkunWarga.hasAccount && (
                <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-400">Status Akun:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Aktif ({targetAkunWarga.userRole})</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveAkun} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="akun-warga-role" className="font-semibold text-slate-700 dark:text-slate-300">
                  Jabatan / Hak Akses:
                </label>
                <select
                  id="akun-warga-role"
                  value={akunRole}
                  onChange={(e) => setAkunRole(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium text-slate-900 dark:text-slate-100"
                >
                  <option value="WARGA">Warga Biasa (Akses Aplikasi Warga Mobile)</option>
                  <option value="KETUA_RT">Ketua RT (Admin Panel - Akses Penuh & Tanda Tangan Surat)</option>
                  <option value="SEKRETARIS">Sekretaris RT (Admin Panel - Pelayanan Surat & Kependudukan)</option>
                  <option value="BENDAHARA">Bendahara RT (Admin Panel - Kas & Pembukuan Keuangan RT)</option>
                  {user?.role === 'SUPERUSER' && (
                    <option value="SUPERUSER">Superuser / Root Admin (Akses Mutlak Sistem)</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-500">
                  Akun Ketua RT, Sekretaris, dan Bendahara dapat login ke portal <strong>Admin Panel</strong> ini.
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="akun-warga-username" className="font-semibold text-slate-700 dark:text-slate-300">
                  Username Login:
                </label>
                <input
                  id="akun-warga-username"
                  name="username"
                  type="text"
                  value={akunUsername}
                  onChange={(e) => setAkunUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="Contoh: pak_budi"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium"
                  required
                />
                <p className="text-[10px] text-slate-500">Huruf kecil, tanpa spasi, minimal 3 karakter.</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="akun-warga-password" className="font-semibold text-slate-700 dark:text-slate-300">
                  {targetAkunWarga.hasAccount ? 'Reset Password (Opsional):' : 'Password Baru:'}
                </label>
                <input
                  id="akun-warga-password"
                  name="password"
                  type="text"
                  value={akunPassword}
                  onChange={(e) => setAkunPassword(e.target.value)}
                  placeholder={targetAkunWarga.hasAccount ? 'Kosongkan jika tidak ingin mengubah password' : 'Minimal 8 karakter'}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  required={!targetAkunWarga.hasAccount}
                />
                <p className="text-[10px] text-slate-500">
                  {targetAkunWarga.hasAccount
                    ? 'Kosongkan kolom ini jika hanya ingin mengubah jabatan / hak akses.'
                    : 'Minimal 8 karakter. Berikan kredensial ini kepada pengurus/warga untuk masuk.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="md" onClick={() => setAkunModalOpen(false)} disabled={isCreatingAkun}>
                  Batal
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isCreatingAkun}>
                  {targetAkunWarga.hasAccount ? 'Simpan Perubahan' : 'Simpan & Aktifkan Akun'}
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
