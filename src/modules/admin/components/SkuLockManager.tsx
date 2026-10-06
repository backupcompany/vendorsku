import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MasterSku } from '../types';
import { cleanCommodityName } from '../../sku/services/skuService';
import { Button } from '../../../core/ui/Button';
import { Badge } from '../../../core/ui/Badge';
import {
  Lock,
  Unlock,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  CheckCircle2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Power,
  XCircle,
} from 'lucide-react';

interface SkuLockManagerProps {
  skus: MasterSku[];
  onToggleSingle: (id: string, isOpen: boolean) => Promise<void>;
  onBulkToggle: (ids: string[], isOpen: boolean) => Promise<void>;
  onToggleActiveSingle?: (id: string, isActive: boolean) => Promise<void>;
  onBulkToggleActive?: (ids: string[], isActive: boolean) => Promise<void>;
  onDeleteSingle?: (id: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
}

export const SkuLockManager: React.FC<SkuLockManagerProps> = ({
  skus,
  onToggleSingle,
  onBulkToggle,
  onToggleActiveSingle,
  onBulkToggleActive,
  onDeleteSingle,
  onBulkDelete,
}) => {
  // Use Set for O(1) membership check on large datasets
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpInput, setJumpInput] = useState<string>('');

  // Total and pages calculation
  const totalItems = skus.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Reset page when dataset shrinks or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
    setJumpInput('');
  }, [totalItems, pageSize]);

  // Sliced items for active page (only mounts active 50-100 rows in DOM)
  const paginatedSkus = useMemo(() => {
    return skus.slice(startIndex, endIndex);
  }, [skus, startIndex, endIndex]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: paginatedSkus.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
    useFlushSync: false,
    getItemKey: (i) => paginatedSkus[i].id,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const padTop = virtualRows[0]?.start ?? 0;
  const padBottom = rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activePage, pageSize, skus]);

  // Check if all visible items on current page are selected
  const isPageAllSelected = useMemo(() => {
    if (paginatedSkus.length === 0) return false;
    return paginatedSkus.every((s) => selectedIdSet.has(s.id));
  }, [paginatedSkus, selectedIdSet]);

  // Check if all items in current filter dataset are selected
  const isAllSelected = useMemo(() => {
    if (skus.length === 0) return false;
    return skus.length === selectedIdSet.size && skus.every((s) => selectedIdSet.has(s.id));
  }, [skus, selectedIdSet]);

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Toggle single item selection
  const toggleSelectItem = (id: string) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle selection for all items on current page
  const toggleSelectPage = () => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev);
      if (isPageAllSelected) {
        paginatedSkus.forEach((s) => next.delete(s.id));
      } else {
        paginatedSkus.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  // Select all across entire filtered dataset
  const handleSelectAllDataset = () => {
    if (isAllSelected) {
      setSelectedIdSet(new Set());
    } else {
      setSelectedIdSet(new Set(skus.map((s) => s.id)));
      showFeedback(`Semua ${skus.length} SKU berhasil dipilih.`);
    }
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedIdSet(new Set());
  };

  // Handle bulk action (open / lock)
  const handleBulkAction = async (isOpen: boolean) => {
    const ids = Array.from(selectedIdSet);
    if (ids.length === 0) return;

    setIsProcessing(true);
    try {
      await onBulkToggle(ids, isOpen);
      setSelectedIdSet(new Set());
      showFeedback(`Berhasil mengubah status ${ids.length} SKU menjadi "${isOpen ? 'Bisa Diisi Vendor' : 'Terkunci'}".`);
    } catch (e: any) {
      alert('Gagal mengubah status: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle bulk active / deactive in ERP
  const handleBulkActive = async (isActive: boolean) => {
    const ids = Array.from(selectedIdSet);
    if (ids.length === 0 || !onBulkToggleActive) return;

    setIsProcessing(true);
    try {
      await onBulkToggleActive(ids, isActive);
      setSelectedIdSet(new Set());
      showFeedback(`Berhasil mengubah status ERP ${ids.length} SKU menjadi "${isActive ? 'Aktif' : 'Deactive (Nonaktif)'}".`);
    } catch (e: any) {
      alert('Gagal mengubah status ERP: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIdSet);
    if (ids.length === 0 || !onBulkDelete) return;

    setIsProcessing(true);
    try {
      await onBulkDelete(ids);
      setSelectedIdSet(new Set());
      showFeedback(`Berhasil menghapus ${ids.length} SKU dari database.`);
    } catch (e: any) {
      showFeedback('Gagal menghapus: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Jump to specific page
  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpInput('');
    }
  };

  const selectedCount = selectedIdSet.size;

  return (
    <div className="space-y-3">
      {/* Action feedback banner */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Bulk action & Selection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Checkbox for current page */}
          <button
            type="button"
            onClick={toggleSelectPage}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
            title={isPageAllSelected ? 'Batalkan pilihan halaman ini' : 'Pilih semua item di halaman aktif'}
          >
            {isPageAllSelected ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            <span>Pilih Halaman Ini ({paginatedSkus.length})</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Select all across entire dataset */}
          <button
            type="button"
            onClick={handleSelectAllDataset}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
          >
            {isAllSelected ? 'Batalkan Semua' : `Pilih Seluruh ${totalItems} SKU`}
          </button>

          {selectedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {selectedCount} Terpilih
            </span>
          )}

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
            >
              Reset Pilihan
            </button>
          )}
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onBulkToggleActive && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedCount === 0}
                isLoading={isProcessing}
                onClick={() => handleBulkActive(true)}
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                className="text-xs font-semibold border-emerald-200 hover:bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300"
              >
                Set Aktif ERP ({selectedCount})
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedCount === 0}
                isLoading={isProcessing}
                onClick={() => handleBulkActive(false)}
                icon={<XCircle className="h-3.5 w-3.5 text-rose-500" />}
                className="text-xs font-semibold border-rose-200 hover:bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:text-rose-300"
              >
                Set Deactive ERP ({selectedCount})
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            isLoading={isProcessing}
            onClick={() => handleBulkAction(true)}
            icon={<Unlock className="h-3.5 w-3.5 text-emerald-600" />}
            className="text-xs font-semibold"
          >
            Buka SKU ({selectedCount})
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            isLoading={isProcessing}
            onClick={() => handleBulkAction(false)}
            icon={<Lock className="h-3.5 w-3.5 text-amber-600" />}
            className="text-xs font-semibold"
          >
            Kunci SKU ({selectedCount})
          </Button>

          {onBulkDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0}
              isLoading={isProcessing}
              onClick={handleBulkDelete}
              icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
              className="text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/20"
            >
              Hapus SKU ({selectedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Pagination & Filter Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        {/* Left: Row counter & Page Size Selector */}
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span>Tampilkan per halaman:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value={25}>25 baris</option>
            <option value={50}>50 baris</option>
            <option value={100}>100 baris</option>
            <option value={250}>250 baris</option>
            <option value={500}>500 baris</option>
          </select>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <span>
            Menampilkan <strong className="text-slate-900 dark:text-white font-bold">{totalItems > 0 ? startIndex + 1 : 0}-{endIndex}</strong> dari{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{totalItems}</strong> SKU
          </span>
        </div>

        {/* Right: Page Navigation & Jump */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={activePage === 1}
            className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300"
            title="Halaman Pertama"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={activePage === 1}
            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          <span className="px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded">
            {activePage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={activePage >= totalPages}
            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={activePage >= totalPages}
            className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300"
            title="Halaman Terakhir"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>

          {/* Jump to page form */}
          {totalPages > 5 && (
            <form onSubmit={handleJumpSubmit} className="hidden md:flex items-center gap-1 ml-2">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder="Hal"
                className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-center text-xs dark:border-slate-700 dark:bg-slate-850 dark:text-white"
              />
              <button
                type="submit"
                className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Go
              </button>
            </form>
          )}
        </div>
      </div>

      {/* High density lock control table (paginated + windowed) */}
      <div ref={scrollRef} className="overflow-auto rounded-xl border border-slate-300 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 max-h-[640px]">
        <table className="w-full text-left text-xs border-collapse select-text">
          <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-900 text-slate-100 font-semibold text-[11px] select-none shadow-2xs">
            <tr>
              <th className="px-3 py-2.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isPageAllSelected}
                  onChange={toggleSelectPage}
                  className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Pilih seluruh baris di halaman ini"
                />
              </th>
              <th className="px-3 py-2.5 w-12 text-center text-slate-400">#</th>
              <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[130px]">Kode ERP</th>
              <th className="px-3 py-2.5 font-semibold min-w-[180px]">Taksonomi Siloam</th>
              <th className="px-3 py-2.5 font-semibold min-w-[200px]">Nama Komoditas (Bagian 1)</th>
              <th className="px-3 py-2.5 font-semibold min-w-[240px]">Spesifikasi Umum (Bagian 2)</th>
              <th className="px-3 py-2.5 font-semibold text-center whitespace-nowrap min-w-[130px]" title="Kolom Is Active dari ERP Siloam">
                Status Aktif ERP
              </th>
              <th className="px-3 py-2.5 font-semibold text-center whitespace-nowrap min-w-[140px]">Status Akses Vendor</th>
              <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap min-w-[150px]">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {paginatedSkus.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                  Tidak ada Master SKU yang ditemukan.
                </td>
              </tr>
            ) : (
              <>
              {padTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={9} style={{ height: padTop, padding: 0 }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const sku = paginatedSkus[virtualRow.index];
                const index = virtualRow.index;
                const isSelected = selectedIdSet.has(sku.id);
                const displayIndex = startIndex + index + 1;
                const isSkuActive = sku.status !== 'archived' && sku.isActive !== false;

                return (
                  <tr
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={`transition-colors border-b border-slate-100 dark:border-slate-800/60 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/30'
                        : !isSkuActive
                        ? 'bg-rose-50/20 dark:bg-rose-950/10 text-slate-500'
                        : sku.isOpenForVendor
                        ? 'hover:bg-slate-50/80 dark:hover:bg-slate-850/50'
                        : 'bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-850/50 text-slate-500'
                    }`}
                  >
                    {/* Selection checkbox */}
                    <td className="px-3 py-2 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(sku.id)}
                        className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                    </td>

                    {/* Sequential row # */}
                    <td className="px-3 py-2 text-center text-[11px] text-slate-400 font-sans align-middle">
                      {displayIndex}
                    </td>

                    {/* ERP Code */}
                    <td className="px-3 py-2 font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap align-middle">
                      {sku.erpCode}
                    </td>

                    {/* Taxonomy trail */}
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[180px] align-middle">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={sku.level1}>
                        {sku.level1}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate" title={`${sku.level2} › ${sku.level3}`}>
                        {sku.level2} › {sku.level3}
                      </div>
                    </td>

                    {/* Commodity name */}
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white max-w-[200px] align-middle">
                      {cleanCommodityName(sku.commodityName)}
                    </td>

                    {/* General spec */}
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[240px] align-middle">
                      <span className="line-clamp-2" title={cleanCommodityName(sku.generalSpec)}>
                        {cleanCommodityName(sku.generalSpec)}
                      </span>
                    </td>

                    {/* ERP Active Status Badge (Is Active) */}
                    <td className="px-3 py-2 text-center whitespace-nowrap align-middle">
                      {isSkuActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
                          <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                          <span>Deactive</span>
                        </span>
                      )}
                    </td>

                    {/* Vendor access badge */}
                    <td className="px-3 py-2 text-center whitespace-nowrap align-middle">
                      {sku.isOpenForVendor ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <Unlock className="h-3 w-3" /> Bisa Diisi Vendor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <Lock className="h-3 w-3" /> Terkunci
                        </span>
                      )}
                    </td>

                    {/* Fast action toggle button & delete */}
                    <td className="px-3 py-2 text-right whitespace-nowrap align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        {onToggleActiveSingle && (
                          <button
                            type="button"
                            onClick={() => onToggleActiveSingle(sku.id, !isSkuActive)}
                            title={isSkuActive ? 'Ubah status ERP menjadi Deactive (Nonaktif)' : 'Ubah status ERP menjadi Aktif'}
                            className={`text-[11px] font-semibold px-2 py-1 rounded transition-colors cursor-pointer border ${
                              isSkuActive
                                ? 'border-slate-300 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/30'
                                : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                          >
                            {isSkuActive ? 'Set Deactive' : 'Set Aktif'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onToggleSingle(sku.id, !sku.isOpenForVendor)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                            sku.isOpenForVendor
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {sku.isOpenForVendor ? 'Kunci SKU' : 'Buka untuk Vendor'}
                        </button>
                        {onDeleteSingle && (
                          <button
                            type="button"
                            onClick={() => onDeleteSingle(sku.id)}
                            title="Hapus SKU ini"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={9} style={{ height: padBottom, padding: 0 }} />
                </tr>
              )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom quick page nav */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 px-1 text-xs text-slate-500">
          <span>
            Halaman {activePage} dari {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage >= totalPages}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
