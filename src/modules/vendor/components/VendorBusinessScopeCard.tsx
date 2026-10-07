import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckSquare,
  Square,
  AlertTriangle,
  Search,
  Save,
  X,
  CheckCircle2,
} from 'lucide-react';
import { VendorProfile, BusinessScope } from '../../../core/types';
import { level2NamesOf, searchSkuNames, suggestLevel1, useSkuTaxonomy } from '../../../core/api/catalog';

interface VendorBusinessScopeCardProps {
  vendor: VendorProfile;
  onUpdateScope: (vendorId: string, scope: BusinessScope) => Promise<void>;
  onNavigateToPricing?: () => void;
  className?: string;
}

const fieldCls =
  'w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-900 dark:text-white';

export const VendorBusinessScopeCard: React.FC<VendorBusinessScopeCardProps> = ({
  vendor,
  onUpdateScope,
  onNavigateToPricing,
  className = '',
}) => {
  const taxonomy = useSkuTaxonomy();
  const level1List = useMemo(() => taxonomy.map((t) => t.level1).sort(), [taxonomy]);

  const initialL1 = vendor.businessScope?.level1 || level1List[0] || 'DIAGNOSTIC AND MEDICAL DEVICES';
  const [selectedLevel1, setSelectedLevel1] = useState<string>(initialL1);
  const [pendingLevel1, setPendingLevel1] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const availableLevel2Options = useMemo(() => level2NamesOf(taxonomy, selectedLevel1), [taxonomy, selectedLevel1]);
  const [selectedLevel2List, setSelectedLevel2List] = useState<string[]>(
    () => vendor.businessScope?.level2List ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (vendor.businessScope?.level1 && vendor.businessScope.level1 !== selectedLevel1) {
      setSelectedLevel1(vendor.businessScope.level1);
    }
    if (vendor.businessScope?.level2List) {
      setSelectedLevel2List(vendor.businessScope.level2List);
    }
  }, [vendor.businessScope]);

  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [suggestedLevel1Results, setSuggestedLevel1Results] = useState<{
    level1: string;
    matchCount: number;
    sampleProducts: string[];
  }[] | null>(null);
  const [hasSearchedProduct, setHasSearchedProduct] = useState(false);
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const handleSuggestLevel1 = async (searchQueryInput?: string) => {
    const rawQuery = searchQueryInput !== undefined ? searchQueryInput : productSearchInput;
    const query = rawQuery.trim();
    const seq = ++searchSeq.current;
    if (query.length < 2) {
      setSuggestedLevel1Results(null);
      setHasSearchedProduct(false);
      return;
    }
    setHasSearchedProduct(true);
    try {
      const hits = await searchSkuNames(query);
      if (seq === searchSeq.current) setSuggestedLevel1Results(suggestLevel1(hits));
    } catch (err) {
      console.error(err);
      if (seq === searchSeq.current) setSuggestedLevel1Results([]);
    }
  };

  const [level2SearchQuery, setLevel2SearchQuery] = useState('');
  const filteredLevel2Options = useMemo(() => {
    if (!level2SearchQuery.trim()) return availableLevel2Options;
    const q = level2SearchQuery.trim().toLowerCase();
    return availableLevel2Options.filter((opt) => opt.toLowerCase().includes(q));
  }, [availableLevel2Options, level2SearchQuery]);

  const handleLevel1DropdownChange = (newL1: string) => {
    if (newL1 === selectedLevel1) return;
    setPendingLevel1(newL1);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmLevel1Change = () => {
    if (!pendingLevel1) return;
    const newL1 = pendingLevel1;
    setSelectedLevel1(newL1);
    setSelectedLevel2List(level2NamesOf(taxonomy, newL1));
    setIsConfirmModalOpen(false);
    setPendingLevel1(null);
    setSaveSuccessMsg(`Lini diganti ke "${newL1}" (belum tersimpan). Klik Simpan untuk menerapkan.`);
    setTimeout(() => setSaveSuccessMsg(null), 5000);
  };

  const handleCancelLevel1Change = () => {
    setIsConfirmModalOpen(false);
    setPendingLevel1(null);
  };

  const handleToggleLevel2 = (l2: string) => {
    setSelectedLevel2List((prev) =>
      prev.includes(l2) ? prev.filter((item) => item !== l2) : [...prev, l2],
    );
  };

  const handleSelectAllLevel2 = () => {
    setSelectedLevel2List((prev) => [...new Set([...prev, ...availableLevel2Options])]);
  };

  const handleClearAllLevel2 = () => {
    setSelectedLevel2List((prev) => prev.filter((l2) => !availableLevel2Options.includes(l2)));
  };

  const handleSaveScopeExplicitly = async () => {
    setIsSaving(true);
    try {
      await onUpdateScope(vendor.id, {
        level1: selectedLevel1,
        level2List: selectedLevel2List,
      });
      setSaveSuccessMsg(`Lini bisnis & ${selectedLevel2List.length} sub-kategori berhasil disimpan.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e) {
      console.warn('Gagal menyimpan scope:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = availableLevel2Options.filter((l2) => selectedLevel2List.includes(l2)).length;

  return (
    <div className={`bg-white dark:bg-slate-900 ${className}`}>
      {saveSuccessMsg && (
        <div className="mb-2 flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {saveSuccessMsg}
        </div>
      )}

      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3F9B] border-b-2 border-[#1B3F9B] pb-1 mb-3">
        1. Lini Bisnis &amp; Opsi Produk
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Pilih kategori utama (Level 1) dan sub-kategori (Level 2). Perubahan berlaku setelah Simpan.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-[#edebe9] dark:border-slate-800 py-3">
        <label className="w-full sm:w-52 shrink-0 text-sm font-semibold text-[#0B2361] dark:text-slate-200 pt-1.5">
          Lini Bisnis (Level 1)
        </label>
        <div className="flex-1 min-w-0 space-y-1.5">
          <select
            value={level1List.includes(selectedLevel1) ? selectedLevel1 : ''}
            onChange={(e) => handleLevel1DropdownChange(e.target.value)}
            disabled={level1List.length === 0}
            className={`${fieldCls} font-medium cursor-pointer disabled:opacity-60`}
          >
            {level1List.length === 0 && <option value="">Katalog Level 1 belum tersedia</option>}
            {level1List.map((l1) => (
              <option key={l1} value={l1}>{l1}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAssistModalOpen(true)}
            className="text-sm text-[#1B3F9B] hover:underline cursor-pointer"
          >
            Bantuan: cari dari nama produk
          </button>
        </div>
      </div>

      <div className="py-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#0B2361] dark:text-slate-200">
            Sub-kategori Level 2 ({selectedCount}/{availableLevel2Options.length})
          </span>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={handleSelectAllLevel2} className="text-[#1B3F9B] hover:underline cursor-pointer">
              Pilih semua
            </button>
            <span className="text-slate-300">|</span>
            <button type="button" onClick={handleClearAllLevel2} className="text-slate-500 hover:underline cursor-pointer">
              Hapus semua
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={level2SearchQuery}
            onChange={(e) => setLevel2SearchQuery(e.target.value)}
            placeholder="Filter sub-kategori…"
            className={`${fieldCls} pl-8`}
          />
        </div>

        <div className="max-h-72 overflow-y-auto border border-[#edebe9] dark:border-slate-700">
          {filteredLevel2Options.map((l2, i) => {
            const isChecked = selectedLevel2List.includes(l2);
            return (
              <button
                key={l2}
                type="button"
                onClick={() => handleToggleLevel2(l2)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm border-b border-[#edebe9] dark:border-slate-800 cursor-pointer ${
                  i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#faf9f8] dark:bg-slate-800/40'
                } ${isChecked ? 'text-[#0B2361] font-medium dark:text-blue-200' : 'text-slate-700 dark:text-slate-300'} hover:bg-[#deecf9] dark:hover:bg-slate-800`}
              >
                {isChecked ? (
                  <CheckSquare className="h-4 w-4 text-[#1B3F9B] shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                )}
                <span>{l2}</span>
              </button>
            );
          })}
          {filteredLevel2Options.length === 0 && (
            <div className="py-6 text-center text-sm text-slate-400">Tidak ada sub-kategori yang cocok.</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#edebe9] pt-3 dark:border-slate-800">
        {onNavigateToPricing && (
          <button
            type="button"
            onClick={onNavigateToPricing}
            className="border border-[#a19f9d] bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-[#f3f2f1] cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Lihat Daftar SKU
          </button>
        )}
        <button
          type="button"
          disabled={isSaving || selectedLevel2List.length === 0}
          onClick={handleSaveScopeExplicitly}
          className="inline-flex items-center gap-1.5 bg-[#1B3F9B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#153482] disabled:opacity-60 cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Menyimpan…' : 'Simpan Lini & Opsi Produk'}
        </button>
      </div>

      {isConfirmModalOpen && pendingLevel1 && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md border border-[#a19f9d] bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-[#edebe9] bg-[#f3f2f1] px-4 py-2 dark:border-slate-800 dark:bg-slate-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Konfirmasi ganti lini bisnis</h3>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                Sub-kategori Level 2 akan direset untuk lini baru. Belum tersimpan ke server sampai Anda klik Simpan.
              </p>
              <div className="border border-[#edebe9] dark:border-slate-700 text-sm">
                <div className="flex justify-between px-3 py-2 border-b border-[#edebe9] dark:border-slate-700">
                  <span className="text-slate-500">Saat ini</span>
                  <span className="font-medium">{selectedLevel1}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-slate-500">Baru</span>
                  <span className="font-semibold text-[#1B3F9B]">{pendingLevel1}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edebe9] px-4 py-2 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCancelLevel1Change}
                className="border border-[#a19f9d] bg-white px-3 py-1.5 text-sm cursor-pointer dark:border-slate-600 dark:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmLevel1Change}
                className="bg-[#1B3F9B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#153482] cursor-pointer"
              >
                Ya, ganti
              </button>
            </div>
          </div>
        </div>
      )}

      {isAssistModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg border border-[#a19f9d] bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-[#edebe9] bg-[#f3f2f1] px-4 py-2 dark:border-slate-800 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bantuan pilih lini bisnis</h3>
              <button type="button" onClick={() => setIsAssistModalOpen(false)} className="p-1 text-slate-500 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Ketik nama produk untuk menemukan lini bisnis yang cocok.
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={productSearchInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProductSearchInput(value);
                    clearTimeout(searchTimer.current);
                    searchTimer.current = setTimeout(() => handleSuggestLevel1(value), 250);
                  }}
                  placeholder="Contoh: jarum infus, defibrillator…"
                  className={`${fieldCls} pl-8`}
                />
              </div>
              <div className="max-h-56 overflow-y-auto border border-[#edebe9] dark:border-slate-700">
                {suggestedLevel1Results?.map((res) => (
                  <div
                    key={res.level1}
                    className="flex items-center justify-between gap-3 border-b border-[#edebe9] px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white">{res.level1}</div>
                      <div className="text-xs text-slate-500 truncate">Contoh: {res.sampleProducts.join(', ')}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAssistModalOpen(false);
                        handleLevel1DropdownChange(res.level1);
                      }}
                      className="shrink-0 bg-[#1B3F9B] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#153482] cursor-pointer"
                    >
                      Pilih
                    </button>
                  </div>
                ))}
                {hasSearchedProduct && suggestedLevel1Results?.length === 0 && (
                  <div className="py-6 text-center text-sm text-slate-400">Tidak ditemukan.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
