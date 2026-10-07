import React, { useState } from 'react';
import { useAdminVendors } from '../hooks/useAdminVendors';
import { ErpVendorUploadModal } from './ErpVendorUploadModal';
import { PromoteVendorToErpModal } from './PromoteVendorToErpModal';
import { VendorFormModal } from './VendorFormModal';
import { VendorProfile, SupplierStatus } from '../../../core/types';
import { Button } from '../../../core/ui/Button';
import {
  Building2,
  Users,
  Search,
  Upload,
  Download,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Edit,
  Trash2,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Sparkles,
  Tag,
  Phone,
  Mail,
  MapPin,
  RefreshCw
} from 'lucide-react';

export const VendorMasterManager: React.FC = () => {
  const {
    erpVendors,
    newVendors,
    allErpVendors,
    allNewVendors,
    isLoading,
    stats,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    level1Filter,
    setLevel1Filter,
    level1Options,
    vendorSubmissionCounts,
    promoteNewVendorToErp,
    updateVendorStatus,
    saveVendor,
    deleteVendor,
    bulkImportErpVendors,
    exportVendorsToExcel,
    refresh,
  } = useAdminVendors();

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedVendorForPromote, setSelectedVendorForPromote] = useState<VendorProfile | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState<VendorProfile | null>(null);
  const [formDefaultType, setFormDefaultType] = useState<'erp' | 'new'>('new');
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionSuccessNotice(msg);
    setTimeout(() => setActionSuccessNotice(null), 4000);
  };

  const handleOpenPromote = (vendor: VendorProfile) => {
    setSelectedVendorForPromote(vendor);
    setIsPromoteModalOpen(true);
  };

  const handleOpenAddVendor = (type: 'erp' | 'new') => {
    setVendorToEdit(null);
    setFormDefaultType(type);
    setIsFormModalOpen(true);
  };

  const handleOpenEditVendor = (vendor: VendorProfile) => {
    setVendorToEdit(vendor);
    setFormDefaultType(vendor.isExistingSupplier ? 'erp' : 'new');
    setIsFormModalOpen(true);
  };

  const handleDeleteVendor = async (vendor: VendorProfile) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data rekanan "${vendor.companyName}"?`)) {
      try {
        await deleteVendor(vendor.id);
        showNotice(`Vendor "${vendor.companyName}" berhasil dihapus.`);
      } catch (err: any) {
        alert('Gagal menghapus: ' + err.message);
      }
    }
  };

  const handlePromoteConfirm = async (vendorId: string, erpVendorCode: string, notes?: string) => {
    const updated = await promoteNewVendorToErp(vendorId, erpVendorCode, notes);
    showNotice(`Berhasil! Rekanan "${updated.companyName}" kini resmi menjadi Vendor ERP dengan kode ${updated.erpVendorCode}.`);
    setActiveTab('erp'); // Switch view to ERP Vendors
  };

  const handleQuickStatusChange = async (vendor: VendorProfile, newStatus: SupplierStatus) => {
    const isVer = newStatus === 'verified';
    await updateVendorStatus(vendor.id, newStatus, isVer);
    showNotice(`Status verifikasi ${vendor.companyName} diperbarui ke "${newStatus.toUpperCase()}".`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
              <span>Grup Rumah Sakit · Procurement Division</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Master Data Rekanan Vendor
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Kelola daftar rekanan resmi yang telah terdaftar di SAP/SIM-RS ERP serta verifikasi pendaftaran calon rekanan baru
              yang mendaftar mandiri melalui portal penawaran tender.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => exportVendorsToExcel(activeTab)}
              icon={<Download className="h-3.5 w-3.5" />}
              className="text-xs bg-[#1B3F9B] hover:bg-[#153482]"
            >
              Export Excel ({activeTab === 'erp' ? 'ERP' : 'Vendor Baru'})
            </Button>
          </div>
        </div>

        {/* Global Notice Banner */}
        {actionSuccessNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccessNotice}</span>
          </div>
        )}

        {/* KPI Stats Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div
            onClick={() => setActiveTab('erp')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeTab === 'erp'
                ? 'bg-blue-50/80 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-slate-850 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Rekanan di ERP:
              </span>
            </div>
            <div className="font-mono text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
              {stats.erp} Rekanan
            </div>
            <span className="text-[10px] text-slate-500">Tersinkronisasi SAP / SIM-RS</span>
          </div>

          <div
            onClick={() => setActiveTab('new')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeTab === 'new'
                ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-slate-850 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Calon Vendor Baru:
              </span>
            </div>
            <div className="font-mono text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">
              {stats.newVendors} Rekanan
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400">Belum terdaftar di ERP</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Menunggu Verifikasi:
            </span>
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.pendingVerification} Vendor
            </div>
            <span className="text-[10px] text-slate-400">Perlu review legalitas & PIC</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Total Seluruh Rekanan:
            </span>
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.total} Vendor
            </div>
            <span className="text-[10px] text-slate-400">Database Master</span>
          </div>
        </div>
      </div>

      {/* 2. Main Tab Selector (Vendor ERP vs Vendor Baru) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'new'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>1. Calon Vendor Baru (Non-ERP)</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
              activeTab === 'new' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {stats.newVendors}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('erp')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'erp'
                ? 'bg-[#1B3F9B] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>2. Vendor Terdaftar dari ERP</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
              activeTab === 'erp' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
            }`}>
              {stats.erp}
            </span>
          </button>
        </div>

        {/* Tab specific action buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'erp' ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUploadModalOpen(true)}
                icon={<Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                className="text-xs bg-white dark:bg-slate-900 font-semibold"
              >
                Upload / Import dari ERP (.xlsx)
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddVendor('erp')}
                icon={<Plus className="h-3.5 w-3.5" />}
                className="text-xs bg-[#1B3F9B] hover:bg-[#153482]"
              >
                Tambah Vendor ERP
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleOpenAddVendor('new')}
              icon={<Plus className="h-3.5 w-3.5" />}
              className="text-xs bg-amber-600 hover:bg-amber-700"
            >
              Tambah Calon Rekanan Baru
            </Button>
          )}
        </div>
      </div>

      {/* 3. Search and Filtering Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'erp'
                ? 'Cari vendor ERP: nama perusahaan, kode vendor (VND-ERP-xxx), NPWP, email, PIC, telepon...'
                : 'Cari vendor baru: nama perusahaan, NPWP, email, PIC, telepon, kategori...'
            }
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">Semua Status Verifikasi</option>
            <option value="verified">Verified (Terverifikasi)</option>
            <option value="identified">Identified (Teridentifikasi)</option>
            <option value="prospect">Prospect (Menunggu Review)</option>
          </select>

          {/* Level 1 Category Filter */}
          <select
            value={level1Filter}
            onChange={(e) => setLevel1Filter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white max-w-[200px] truncate"
          >
            <option value="all">Semua Lini Bisnis</option>
            {level1Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. TAB CONTENT: 1. CALON VENDOR BARU (NON-ERP) */}
      {activeTab === 'new' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Daftar vendor baru yang mendaftar mandiri via Portal Rekanan. Klik tombol{' '}
                <strong>"Promosikan ke ERP"</strong> untuk menyetujui legalitas dan menerbitkan Kode Vendor resmi.
              </span>
            </div>
            <span className="font-bold text-amber-800 dark:text-amber-300 shrink-0">
              {newVendors.length} Rekanan Ditemukan
            </span>
          </div>

          {newVendors.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <Users className="h-10 w-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Tidak Ada Vendor Baru Sesuai Filter
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Semua calon rekanan telah diverifikasi atau tidak ada data yang cocok dengan kata kunci pencarian.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setLevel1Filter('all');
                }}
              >
                Reset Filter Pencarian
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-850 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Nama Perusahaan & Tanggal</th>
                    <th className="p-3">NPWP</th>
                    <th className="p-3">Kontak & PIC</th>
                    <th className="p-3">Lini Bisnis (Level 1 & 2)</th>
                    <th className="p-3 text-center">Status Verifikasi</th>
                    <th className="p-3 text-center">Aktivitas Tender</th>
                    <th className="p-3 text-right">Aksi Tindakan Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {newVendors.map((vendor) => {
                    const submissionsCount = vendorSubmissionCounts[vendor.id] || 0;
                    const isPending = vendor.status === 'prospect';

                    return (
                      <tr
                        key={vendor.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Company Name & Registration */}
                        <td className="p-3">
                          <div className="flex items-start gap-2">
                            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 mt-0.5">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                {vendor.companyName}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>ID: <code className="font-mono text-slate-500">{vendor.id}</code></span>
                                <span>·</span>
                                <span>Daftar: {vendor.registrationDate ? new Date(vendor.registrationDate).toLocaleDateString('id-ID') : 'Baru'}</span>
                              </div>
                              {vendor.notes && (
                                <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                                  {vendor.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* NPWP */}
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {vendor.npwp}
                          </span>
                        </td>

                        {/* Contact & PIC */}
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {vendor.authorizedPerson}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{vendor.phone}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span>{vendor.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Business Scope */}
                        <td className="p-3 max-w-[220px]">
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-[10px] truncate max-w-full">
                              {vendor.businessScope?.level1 || vendor.category || 'Alkes & BMHP'}
                            </span>
                            {vendor.businessScope?.level2List && vendor.businessScope.level2List.length > 0 && (
                              <div className="text-[10px] text-slate-400 line-clamp-1">
                                {vendor.businessScope.level2List.join(', ')}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Verification Status */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                vendor.status === 'verified'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                  : vendor.status === 'identified'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 animate-pulse'
                              }`}
                            >
                              {vendor.status === 'verified' ? '✓ Verified' : vendor.status === 'identified' ? 'Identified' : 'Menunggu Review'}
                            </span>

                            {/* Quick verification action toggle */}
                            <div className="flex items-center justify-center gap-1 text-[10px]">
                              {vendor.status !== 'verified' ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(vendor, 'verified')}
                                  className="text-emerald-600 hover:text-emerald-800 font-semibold underline"
                                >
                                  Verifikasi
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(vendor, 'prospect')}
                                  className="text-amber-600 hover:text-amber-800 text-[10px]"
                                >
                                  Ubah ke Review
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Tender Activity */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {submissionsCount > 0 ? (
                            <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                              {submissionsCount} Penawaran
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Belum Mengisi</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Promote to ERP button */}
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenPromote(vendor)}
                              icon={<ShieldCheck className="h-3.5 w-3.5" />}
                              className="text-xs bg-[#1B3F9B] hover:bg-[#153482]"
                            >
                              Promosikan ke ERP
                            </Button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditVendor(vendor)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Edit Profil Rekanan"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteVendor(vendor)}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
                              title="Hapus Vendor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB CONTENT: 2. VENDOR TERDAFTAR DARI ERP */}
      {activeTab === 'erp' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 text-xs">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
              <span>
                Rekanan resmi Portal Vendor yang telah terdaftar di database ERP pusat (SAP/SIM-RS). Vendor dalam daftar ini
                dapat langsung mengikuti tender dan dipasangkan dengan PO.
              </span>
            </div>
            <span className="font-bold text-blue-800 dark:text-blue-300 shrink-0">
              {erpVendors.length} Rekanan ERP
            </span>
          </div>

          {erpVendors.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Belum Ada Vendor ERP yang Sesuai
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Unggah file Excel/CSV Master Vendor ERP atau tambahkan rekanan terdaftar secara manual.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsUploadModalOpen(true)}
                  icon={<Upload className="h-3.5 w-3.5" />}
                  className="bg-[#1B3F9B] hover:bg-[#153482]"
                >
                  Upload Master Vendor ERP (.xlsx)
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-850 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Kode Vendor ERP</th>
                    <th className="p-3">Nama Perusahaan Rekanan</th>
                    <th className="p-3">NPWP</th>
                    <th className="p-3">Email & Kontak Telepon</th>
                    <th className="p-3">PIC Penanggung Jawab</th>
                    <th className="p-3">Lini Bisnis Utama</th>
                    <th className="p-3 text-center">Aktivitas Tender</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {erpVendors.map((vendor) => {
                    const submissionsCount = vendorSubmissionCounts[vendor.id] || 0;

                    return (
                      <tr
                        key={vendor.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* ERP Vendor Code */}
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                            {vendor.erpVendorCode || 'VND-ERP-TERDAFTAR'}
                          </span>
                        </td>

                        {/* Company Name */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {vendor.companyName}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Rekanan Resmi ERP
                            </span>
                            {vendor.address && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[200px]">{vendor.address}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* NPWP */}
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {vendor.npwp}
                          </span>
                        </td>

                        {/* Email & Phone */}
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-slate-800 dark:text-slate-200 font-medium truncate max-w-[180px]">
                              {vendor.email}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {vendor.phone}
                            </div>
                          </div>
                        </td>

                        {/* PIC */}
                        <td className="p-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {vendor.authorizedPerson}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="p-3 max-w-[200px]">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px] truncate max-w-full">
                            {vendor.businessScope?.level1 || vendor.category || 'DIAGNOSTIC AND MEDICAL DEVICES'}
                          </span>
                        </td>

                        {/* Tender Activity */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {submissionsCount > 0 ? (
                            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                              {submissionsCount} Penawaran
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">0 Penawaran</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditVendor(vendor)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Edit Vendor ERP"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteVendor(vendor)}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
                              title="Hapus Rekanan ERP"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Modals */}
      {/* Upload ERP Vendor Modal */}
      <ErpVendorUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={async (rawVendors) => {
          const count = await bulkImportErpVendors(rawVendors);
          showNotice(`Berhasil mengimpor ${count} Vendor dari file ERP.`);
          return count;
        }}
      />

      {/* Promote to ERP Modal */}
      <PromoteVendorToErpModal
        isOpen={isPromoteModalOpen}
        onClose={() => {
          setIsPromoteModalOpen(false);
          setSelectedVendorForPromote(null);
        }}
        vendor={selectedVendorForPromote}
        onPromoteSuccess={handlePromoteConfirm}
      />

      {/* Add / Edit Vendor Modal */}
      <VendorFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setVendorToEdit(null);
        }}
        vendorToEdit={vendorToEdit}
        defaultType={formDefaultType}
        onSave={async (v) => {
          await saveVendor(v);
          showNotice(`Data rekanan "${v.companyName}" berhasil disimpan.`);
        }}
      />
    </div>
  );
};
