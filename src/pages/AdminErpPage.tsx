import React, { useState } from 'react';
import { navigate } from '../core/router/useAppRouter';
import { useMasterSku } from '../modules/sku/hooks/useMasterSku';
import { ErpMasterUpload } from '../modules/admin/components/ErpMasterUpload';
import { SkuLockManager } from '../modules/admin/components/SkuLockManager';
import { StaffSkuProposalsPanel } from '../modules/admin/components/StaffSkuProposalsPanel';
import { TaxonomyFilterTree } from '../modules/sku/components/TaxonomyFilterTree';
import { SkuSearchBar } from '../modules/sku/components/SkuSearchBar';
import { Database, ShieldCheck, Lock, Unlock, Trash2, CheckCircle2, Sparkles, AlertCircle, RefreshCw, X, Users, ArrowRight } from 'lucide-react';
import { Button } from '../core/ui/Button';
import { Modal } from '../core/ui/Modal';
import { clearMasterSkus } from '../core/api/catalog';

export const AdminErpPage: React.FC = () => {
  const {
    skus,
    allSkus,
    isLoading,
    searchQuery,
    setSearchQuery,
    taxonomyFilters,
    taxonomyOptions,
    updateFilter,
    clearFilters,
    toggleOpen,
    bulkToggleOpen,
    toggleActive,
    bulkToggleActive,
    deleteSku,
    bulkDeleteSkus,
    refresh,
  } = useMasterSku(false); // Admin sees both open and closed SKUs

  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleBulkToggle = async (ids: string[], isOpen: boolean) => {
    await bulkToggleOpen(ids, isOpen);
  };

  // Option 1: Purge only default seed mock data, keep uploaded SKUs
  const handlePurgeSeedOnly = async () => {
    setIsProcessing(true);
    try {
      const purged = await clearMasterSkus('seed');
      await refresh();
      setIsCleanModalOpen(false);
      setNotice(`Berhasil membersihkan ${purged} seed data bawaan. Hanya master SKU unggahan Anda yang tersimpan.`);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      alert('Gagal membersihkan data: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Option 2: Empty entire master SKU database to 0
  const handleResetEntireDatabase = async () => {
    setIsProcessing(true);
    try {
      const cleared = await clearMasterSkus('all');
      await refresh();
      setIsCleanModalOpen(false);
      setNotice(`Berhasil mengosongkan seluruh data Master SKU (${cleared} SKU dihapus). Database kini bersih (0 SKU).`);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      alert('Gagal mengosongkan database: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openCount = allSkus.filter((s) => s.isOpenForVendor).length;
  const lockedCount = allSkus.filter((s) => !s.isOpenForVendor).length;
  const uploadedCount = allSkus.filter((s) => s.isUploaded).length;
  const activeErpCount = allSkus.filter((s) => s.status !== 'archived' && s.isActive !== false).length;
  const deactiveErpCount = allSkus.filter((s) => s.status === 'archived' || s.isActive === false).length;
  const seedCount = Math.max(0, allSkus.length - uploadedCount);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Database className="h-4 w-4" />
              <span>Manajemen Master SKU ERP & Hak Akses Vendor</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Kontrol Master SKU Siloam Hospitals
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Unggah data master SKU dari sistem ERP Siloam dan tentukan SKU mana saja yang
              diizinkan untuk diisi harganya oleh vendor rekanan pada masa pengadaan tender.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCleanModalOpen(true)}
              icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
              className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/20 cursor-pointer"
            >
              Bersihkan / Reset SKU
            </Button>
          </div>
        </div>

        {notice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{notice}</span>
          </div>
        )}
      </div>

      <StaffSkuProposalsPanel
        onChanged={() => {
          refresh();
          setNotice('Usulan produk berhasil di-review.');
          setTimeout(() => setNotice(null), 3000);
        }}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-850">
            <div className="flex items-center justify-between text-slate-500">
              <span>Total SKU ERP:</span>
              {uploadedCount > 0 && (
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {uploadedCount} Diunggah
                </span>
              )}
            </div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {allSkus.length} SKU
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50/70 p-3 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ERP Aktif (Is Active):
            </span>
            <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {activeErpCount} SKU
            </div>
          </div>

          <div className="rounded-lg bg-rose-50/70 p-3 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/60">
            <span className="text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              ERP Deactive (Nonaktif):
            </span>
            <div className="font-mono text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">
              {deactiveErpCount} SKU
            </div>
          </div>

          <div className="rounded-lg bg-blue-50/60 p-3 dark:bg-blue-950/20">
            <span className="text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Unlock className="h-3.5 w-3.5" />
              Bisa Diisi Vendor:
            </span>
            <div className="font-mono text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">
              {openCount} SKU
            </div>
          </div>

          <div className="rounded-lg bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Terkunci (Locked):
            </span>
            <div className="font-mono text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              {lockedCount} SKU
            </div>
          </div>
        </div>

        {/* Quick Link Card to Master Vendor */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-amber-50/80 border border-blue-200 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-amber-950/30 dark:border-blue-900 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1B3F9B] text-white shadow-xs shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Master Data Rekanan (Daftar Vendor ERP & Calon Rekanan Baru)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola data rekanan resmi yang diupload dari ERP serta verifikasi pendaftaran calon rekanan baru non-ERP.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/vendors')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-750 text-xs shrink-0 shadow-2xs transition-colors cursor-pointer"
          >
            <span>Buka Master Vendor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 1. ERP Upload Section */}
      <ErpMasterUpload onUploadSuccess={refresh} />

      {/* Empty State when no SKUs exist yet */}
      {allSkus.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/30">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-4">
            <Database className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Belum Ada Master SKU di Database
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            Database Master SKU bersih (0 SKU). Silakan unggah file Excel Master SKU dari sistem ERP Siloam pada form di atas untuk mengisi katalog SKU yang akan ditawarkan ke vendor rekanan.
          </p>
        </div>
      ) : (
        <>
          {/* 2. Taxonomy Filter & Search */}
          <div className="space-y-3">
            <TaxonomyFilterTree
              filters={taxonomyFilters}
              options={taxonomyOptions}
              onFilterChange={updateFilter}
              onClearFilters={clearFilters}
              totalFiltered={skus.length}
              totalSkus={allSkus.length}
            />

            <SkuSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              isOpenOnly={Boolean(taxonomyFilters.isOpenOnly)}
              onToggleOpenOnly={(checked) => updateFilter('isOpenOnly', checked)}
              showOpenToggle={true}
              activeStatus={taxonomyFilters.activeStatus || 'all'}
              onActiveStatusChange={(status) => updateFilter('activeStatus', status)}
            />
          </div>

          {/* 3. SKU Lock Manager Table */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Memuat daftar SKU untuk kontrol izin...
            </div>
          ) : (
            <SkuLockManager
              skus={skus}
              onToggleSingle={async (id, isOpen) => {
                await toggleOpen(id, isOpen);
              }}
              onBulkToggle={handleBulkToggle}
              onToggleActiveSingle={async (id, isActive) => {
                await toggleActive(id, isActive);
                setNotice(`Status ERP SKU berhasil diubah menjadi ${isActive ? 'Aktif' : 'Deactive (Nonaktif)'}.`);
                setTimeout(() => setNotice(null), 3000);
              }}
              onBulkToggleActive={async (ids, isActive) => {
                await bulkToggleActive(ids, isActive);
                setNotice(`${ids.length} SKU berhasil diubah status ERP menjadi ${isActive ? 'Aktif' : 'Deactive (Nonaktif)'}.`);
                setTimeout(() => setNotice(null), 3000);
              }}
              onDeleteSingle={async (id) => {
                await deleteSku(id);
                setNotice('1 SKU berhasil dihapus.');
                setTimeout(() => setNotice(null), 3000);
              }}
              onBulkDelete={async (ids) => {
                await bulkDeleteSkus(ids);
                setNotice(`${ids.length} SKU berhasil dihapus.`);
                setTimeout(() => setNotice(null), 3000);
              }}
            />
          )}
        </>
      )}

      {/* Interactive Clean / Reset Modal (No window.confirm) */}
      <Modal
        isOpen={isCleanModalOpen}
        onClose={() => setIsCleanModalOpen(false)}
        title="Pembersihan & Reset Master SKU"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Pilih tindakan pembersihan basis data Master SKU ERP Siloam di bawah ini:
          </p>

          {/* Database breakdown */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-850 space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200">
              <span>Total SKU Saat Ini:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{allSkus.length} SKU</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span>· SKU Hasil Unggahan Anda:</span>
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{uploadedCount} SKU</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span>· Data Seed Bawaan / Mock Awal:</span>
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{seedCount} SKU</span>
            </div>
          </div>

          {/* Action options */}
          <div className="space-y-3 pt-2">
            {/* Action 1: Purge seed only */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-2">
              <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Trash2 className="h-4 w-4 text-amber-600" />
                <span>Opsi 1: Hapus Hanya Seed Bawaan</span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80">
                Menghapus seluruh SKU dummy bawaan sistem. Data Master SKU yang diunggah oleh Anda via Excel tetap aman tersimpan.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePurgeSeedOnly}
                isLoading={isProcessing}
                className="w-full text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 cursor-pointer"
              >
                Hapus Seed Bawaan ({seedCount} SKU)
              </Button>
            </div>

            {/* Action 2: Reset total to 0 */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/20 space-y-2">
              <div className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Opsi 2: Kosongkan Seluruh Master SKU (Reset Total ke 0)</span>
              </div>
              <p className="text-[11px] text-rose-800/80 dark:text-rose-400/80">
                Menghapus SEMUA {allSkus.length} SKU dari database portal sehingga menjadi kosong bersih (0 SKU), siap untuk mengunggah file Excel baru dari awal.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleResetEntireDatabase}
                isLoading={isProcessing}
                className="w-full text-xs font-bold cursor-pointer"
              >
                Kosongkan Seluruh Database Master SKU ({allSkus.length} SKU)
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCleanModalOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
