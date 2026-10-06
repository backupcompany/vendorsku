import React, { useState, useRef } from 'react';
import { useHospitalMaster } from '../hooks/useHospitalMaster';
import { HospitalUnit, IndonesiaIsland } from '../../../core/types';
import {
  Building2,
  Plus,
  Upload,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  MapPin,
  Globe2,
  Filter,
  Check,
  X,
  Layers,
  Bed,
  Eye,
} from 'lucide-react';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { useOptions } from '../../../core/api/options';

const ISLAND_COLORS: Record<string, string> = {
  Jawa: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  Sumatera: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-800',
  'Bali & Nusa Tenggara': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
  Kalimantan: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-800',
  Sulawesi: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border-purple-200 dark:border-purple-800',
  'Maluku & Papua': 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-800',
};

export const HospitalMasterManager: React.FC = () => {
  const islandOptions = useOptions('island').map((o) => o.value as IndonesiaIsland);
  const {
    filteredHospitals,
    isLoading,
    searchQuery,
    setSearchQuery,
    islandFilter,
    setIslandFilter,
    statusFilter,
    setStatusFilter,
    stats,
    toastMessage,
    setToastMessage,
    saveHospital,
    deleteHospital,
    toggleHospitalStatus,
    importHospitals,
    downloadTemplate,
    exportExcel,
  } = useHospitalMaster();

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<HospitalUnit | null>(null);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formProvince, setFormProvince] = useState('');
  const [formIsland, setFormIsland] = useState<IndonesiaIsland>('Jawa');
  const [formType, setFormType] = useState('Rumah Sakit Umum Tipe B');
  const [formBeds, setFormBeds] = useState<number | ''>(100);
  const [formActive, setFormActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewParsedData, setPreviewParsedData] = useState<{
    validHospitals: HospitalUnit[];
    errors: string[];
    summary: { totalRows: number; newCount: number; updatedCount: number };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<HospitalUnit | null>(null);

  const openAddModal = () => {
    setEditingHospital(null);
    setFormCode('');
    setFormName('');
    setFormCity('');
    setFormProvince('');
    setFormIsland('Jawa');
    setFormType('Rumah Sakit Umum Tipe B');
    setFormBeds(100);
    setFormActive(true);
    setIsFormModalOpen(true);
  };

  const openEditModal = (h: HospitalUnit) => {
    setEditingHospital(h);
    setFormCode(h.code);
    setFormName(h.name);
    setFormCity(h.city);
    setFormProvince(h.province || '');
    setFormIsland((h.island as IndonesiaIsland) || 'Jawa');
    setFormType(h.type || 'Rumah Sakit Umum Tipe B');
    setFormBeds(h.bedCapacity || '');
    setFormActive(h.isActive);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCity.trim()) {
      alert('Nama Rumah Sakit dan Kota wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveHospital({
        id: editingHospital?.id,
        code: formCode.trim() || formName.substring(0, 4).toUpperCase(),
        name: formName.trim(),
        city: formCity.trim(),
        province: formProvince.trim(),
        island: formIsland,
        type: formType.trim(),
        bedCapacity: formBeds !== '' ? Number(formBeds) : 0,
        isActive: formActive,
        createdAt: editingHospital?.createdAt,
      });
      setIsFormModalOpen(false);
    } catch (err: any) {
      alert('Gagal menyimpan rumah sakit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setIsParsing(true);
    try {
      const { hospitalService } = await import('../../../core/services/hospitalService');
      const res = await hospitalService.parseHospitalExcel(file);
      setPreviewParsedData(res);
    } catch (err: any) {
      alert('Gagal membaca file Excel: ' + err.message);
      setUploadFile(null);
      setPreviewParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!uploadFile) return;
    setIsSubmitting(true);
    try {
      await importHospitals(uploadFile);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setPreviewParsedData(null);
    } catch (err: any) {
      alert('Gagal mengimpor file: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteHospital(deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Banner Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Building2 className="h-4 w-4" />
              <span>Master Data Terpusat · Seluruh Aplikasi</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Master Data Rumah Sakit Siloam
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Katalog resmi unit Rumah Sakit Siloam nasional lengkap dengan keterangan kota, provinsi, dan gugus pulau.
              Data ini digunakan serentak pada penentuan cakupan distribusi vendor dan modul pengadaan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              title="Unduh Template Excel untuk import massal"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Template Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUploadFile(null);
                setPreviewParsedData(null);
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 px-3.5 py-2 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Unggah file Excel master rumah sakit"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              <span>Upload Master Excel</span>
            </button>

            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              title="Export daftar rumah sakit saat ini ke Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B3F9B] hover:bg-[#15337E] text-white px-3.5 py-2 text-xs font-bold transition-all shadow-md shadow-[#1B3F9B]/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Unit RS</span>
            </button>
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="col-span-2 rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/40 p-3">
            <div className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
              Total Rumah Sakit
            </div>
            <div className="text-2xl font-black text-blue-950 dark:text-white mt-0.5">
              {stats.total} <span className="text-xs font-normal text-blue-700 dark:text-blue-400">Unit RS</span>
            </div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>{stats.active} Aktif · {stats.inactive} Non-Aktif</span>
            </div>
          </div>

          {islandOptions.map((island) => {
            const count = stats.byIsland[island] || 0;
            return (
              <div
                key={island}
                onClick={() => setIslandFilter(islandFilter === island ? 'ALL' : island)}
                className={`rounded-xl border p-2.5 transition-all cursor-pointer select-none ${
                  islandFilter === island
                    ? 'border-blue-600 ring-2 ring-blue-600/30 bg-blue-50/50 dark:bg-blue-950/50'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate" title={island}>
                  {island}
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {count} <span className="text-[10px] font-normal text-slate-400">RS</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama RS, kode unit (cth: SHLV, MRCCC), kota, atau provinsi..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/80 py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#1B3F9B] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 my-auto mr-2.5 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pulau & Status */}
        <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1 md:pb-0">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/80 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 px-1.5 flex items-center gap-1">
              <Globe2 className="h-3 w-3" />
              <span>Pulau:</span>
            </span>
            <select
              value={islandFilter}
              onChange={(e) => setIslandFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Pulau ({stats.total})</option>
              {islandOptions.map((isl) => (
                <option key={isl} value={isl}>
                  {isl} ({stats.byIsland[isl] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/80 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700 dark:text-slate-400'
              }`}
            >
              Aktif ({stats.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-rose-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-rose-700 dark:text-slate-400'
              }`}
            >
              Non-Aktif ({stats.inactive})
            </button>
          </div>
        </div>
      </div>

      {/* Main Hospitals Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3.5 py-3 w-12 text-center">#</th>
                <th className="px-3.5 py-3 w-24">Kode Unit</th>
                <th className="px-3.5 py-3 min-w-[220px]">Nama Rumah Sakit</th>
                <th className="px-3.5 py-3 min-w-[140px]">Kota / Kabupaten</th>
                <th className="px-3.5 py-3 min-w-[120px]">Provinsi</th>
                <th className="px-3.5 py-3 min-w-[150px]">Pulau / Wilayah</th>
                <th className="px-3.5 py-3 min-w-[180px]">Tipe / Kelas RS</th>
                <th className="px-3.5 py-3 w-28 text-center">Status Unit</th>
                <th className="px-3.5 py-3 w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>Memuat master data rumah sakit...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    <Building2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">Tidak ada Rumah Sakit yang cocok.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau filter pulau.</p>
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((h, idx) => {
                  const islandBadgeClass = ISLAND_COLORS[h.island] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors ${
                        !h.isActive ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      <td className="px-3.5 py-3 text-center text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="px-3.5 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px]">
                          {h.code}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{h.name}</span>
                          {!h.isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              Non-Aktif
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1 text-[11px]">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{h.city}</span>
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400 text-[11px]">
                        {h.province || '-'}
                      </td>

                      <td className="px-3.5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${islandBadgeClass}`}>
                          <span>{h.island}</span>
                        </span>
                      </td>

                      <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 text-[11px]">
                        {h.type || 'Rumah Sakit Umum'}
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleHospitalStatus(h.id, h.isActive, h.name)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            h.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                          title={`Klik untuk ubah menjadi ${h.isActive ? 'Non-Aktif' : 'Aktif'}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${h.isActive ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          <span>{h.isActive ? 'Aktif' : 'Non-Aktif'}</span>
                        </button>
                      </td>

                      <td className="px-3.5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(h)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Data Rumah Sakit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(h)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Hapus Rumah Sakit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Menampilkan <strong>{filteredHospitals.length}</strong> dari <strong>{stats.total}</strong> Rumah Sakit Siloam
          </span>
          <span className="text-[11px] text-slate-400">
            Perubahan data tersinkronisasi otomatis dengan seluruh modul aplikasi.
          </span>
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT HOSPITAL */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingHospital ? 'Edit Master Rumah Sakit' : 'Tambah Unit Rumah Sakit Siloam'}
        subtitle="Masukkan kelengkapan data unit rumah sakit untuk katalog distribusi pengadaan."
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kode Unit RS *
              </label>
              <input
                type="text"
                required
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="Cth: SHLV, MRCCC, SHKJ"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pulau / Wilayah *
              </label>
              <select
                value={formIsland}
                onChange={(e) => setFormIsland(e.target.value as IndonesiaIsland)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {islandOptions.map((isl) => (
                  <option key={isl} value={isl}>{isl}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Rumah Sakit Siloam *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Cth: Siloam Hospitals Lippo Village"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kota / Kabupaten *
              </label>
              <input
                type="text"
                required
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Cth: Tangerang, Jakarta Barat"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Provinsi
              </label>
              <input
                type="text"
                value={formProvince}
                onChange={(e) => setFormProvince(e.target.value)}
                placeholder="Cth: Banten, DKI Jakarta"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipe / Kelas Rumah Sakit
              </label>
              <input
                type="text"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="Cth: Rumah Sakit Umum Tipe B"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kapasitas Tempat Tidur (Beds)
              </label>
              <input
                type="number"
                min="0"
                value={formBeds}
                onChange={(e) => setFormBeds(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Cth: 200"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Unit Rumah Sakit Aktif (Dapat dipilih pada pengadaan/tender)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFormModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : editingHospital ? 'Simpan Perubahan' : 'Tambah Rumah Sakit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: UPLOAD MASTER EXCEL */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Master Data Rumah Sakit via Excel"
        subtitle="Impor atau perbarui daftar unit rumah sakit Siloam secara massal menggunakan file .xlsx atau .csv."
      >
        <div className="space-y-4 pt-2">
          {/* Instructions & Template info */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 space-y-1.5">
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Format Kolom Excel yang Didukung:</span>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-[11px] underline text-blue-700 dark:text-blue-300 hover:text-blue-900 cursor-pointer"
              >
                Unduh Template Contoh
              </button>
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
              Kolom wajib: <strong>Nama Rumah Sakit</strong>, <strong>Kota / Kabupaten</strong>, <strong>Pulau / Wilayah</strong>.
              Kolom opsional: <em>Kode Unit, Provinsi, Tipe RS, Kapasitas Tempat Tidur, Status Aktif</em>.
            </p>
          </div>

          {/* Upload Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 dark:border-slate-700 dark:hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-800/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="mx-auto h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
            <p className="text-xs font-bold text-slate-800 dark:text-white">
              {uploadFile ? uploadFile.name : 'Klik untuk memilih file Excel (.xlsx / .csv)'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {uploadFile
                ? `${(uploadFile.size / 1024).toFixed(1)} KB · File siap diproses`
                : 'Atau drag-and-drop file spreadsheet Anda ke area ini'}
            </p>
          </div>

          {/* Parsing State */}
          {isParsing && (
            <div className="py-4 text-center text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span>Sedang membaca dan memvalidasi lembar kerja Excel...</span>
            </div>
          )}

          {/* Preview Parsed Data */}
          {previewParsedData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 dark:text-slate-200">
                  Hasil Validasi: <strong>{previewParsedData.validHospitals.length}</strong> RS siap diimpor
                </span>
                <span className="text-[11px] text-emerald-600 font-bold">
                  {previewParsedData.summary.newCount} Unit Baru · {previewParsedData.summary.updatedCount} Diperbarui
                </span>
              </div>

              {previewParsedData.errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                  <div className="font-bold flex items-center gap-1 mb-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Terdapat {previewParsedData.errors.length} peringatan:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {previewParsedData.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mini Table Preview */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">Kode</th>
                      <th className="p-2">Nama RS</th>
                      <th className="p-2">Kota</th>
                      <th className="p-2">Pulau</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewParsedData.validHospitals.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">{item.code}</td>
                        <td className="p-2 font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">{item.name}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">{item.city}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">{item.island}</td>
                        <td className="p-2 text-emerald-600 font-bold">{item.isActive ? 'Aktif' : 'Nonaktif'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewParsedData.validHospitals.length > 10 && (
                <div className="text-[10px] text-center text-slate-400">
                  Menampilkan 10 dari {previewParsedData.validHospitals.length} data untuk preview
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!previewParsedData || previewParsedData.validHospitals.length === 0 || isSubmitting}
              onClick={handleConfirmUpload}
            >
              {isSubmitting
                ? 'Mengimpor Data...'
                : `Simpan & Terapkan (${previewParsedData?.validHospitals.length || 0} RS)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Konfirmasi Hapus Rumah Sakit"
          subtitle="Apakah Anda yakin ingin menghapus unit rumah sakit ini dari master data?"
        >
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
              <div className="font-bold">{deleteTarget.name} ({deleteTarget.code})</div>
              <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                Kota: {deleteTarget.city} · Pulau: {deleteTarget.island}
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tindakan ini akan menghapus rumah sakit dari master data. Vendor tidak akan lagi melihat unit ini pada formulir cakupan penawaran harga.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
              >
                Hapus Sekarang
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
