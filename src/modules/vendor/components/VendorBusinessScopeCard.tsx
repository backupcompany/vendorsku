import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  CheckSquare,
  Square,
  AlertTriangle,
  Lightbulb,
  Search,
  Save,
  ArrowRight,
  X,
  Check,
  PackageCheck
} from 'lucide-react';
import { VendorProfile, BusinessScope } from '../../../core/types';
import { level2NamesOf, scopeSkuCount, searchSkuNames, suggestLevel1, useSkuTaxonomy } from '../../../core/api/catalog';

interface VendorBusinessScopeCardProps {
  vendor: VendorProfile;
  onUpdateScope: (vendorId: string, scope: BusinessScope) => Promise<void>;
  onNavigateToPricing?: () => void;
  className?: string;
}

export const VendorBusinessScopeCard: React.FC<VendorBusinessScopeCardProps> = ({
  vendor,
  onUpdateScope,
  onNavigateToPricing,
  className = '',
}) => {
  const taxonomy = useSkuTaxonomy();
  const level1List = useMemo(() => taxonomy.map((t) => t.level1).sort(), [taxonomy]);

  // Default Level 1
  const initialL1 = vendor.businessScope?.level1 || level1List[0] || 'DIAGNOSTIC AND MEDICAL DEVICES';
  const [selectedLevel1, setSelectedLevel1] = useState<string>(initialL1);

  // Level 1 Confirmation Modal State
  const [pendingLevel1, setPendingLevel1] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const availableLevel2Options = useMemo(() => level2NamesOf(taxonomy, selectedLevel1), [taxonomy, selectedLevel1]);

  // 3. Selected Level 2 categories; empty means every Level 2 under the Level 1.
  const [selectedLevel2List, setSelectedLevel2List] = useState<string[]>(
    () => vendor.businessScope?.level2List ?? [],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Synchronize when vendor.businessScope prop changes externally (e.g. from the other tab)
  useEffect(() => {
    if (vendor.businessScope?.level1 && vendor.businessScope.level1 !== selectedLevel1) {
      setSelectedLevel1(vendor.businessScope.level1);
    }
    if (vendor.businessScope?.level2List) {
      setSelectedLevel2List(vendor.businessScope.level2List);
    }
  }, [vendor.businessScope]);

  // Assistive Search State: Suggest Level 1 from Sample Product Input
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

  // Level 2 search filter
  const [level2SearchQuery, setLevel2SearchQuery] = useState('');
  const filteredLevel2Options = useMemo(() => {
    if (!level2SearchQuery.trim()) return availableLevel2Options;
    const q = level2SearchQuery.trim().toLowerCase();
    return availableLevel2Options.filter((opt) => opt.toLowerCase().includes(q));
  }, [availableLevel2Options, level2SearchQuery]);

  // Dropdown change trigger
  const handleLevel1DropdownChange = (newL1: string) => {
    if (newL1 === selectedLevel1) return;
    setPendingLevel1(newL1);
    setIsConfirmModalOpen(true);
  };

  // Confirm Level 1 Change
  const handleConfirmLevel1Change = async () => {
    if (!pendingLevel1) return;
    const newL1 = pendingLevel1;
    setSelectedLevel1(newL1);

    // Default: select ALL Level 2 under the new Level 1
    const allNewL2List = level2NamesOf(taxonomy, newL1);
    setSelectedLevel2List(allNewL2List);

    setIsConfirmModalOpen(false);
    setPendingLevel1(null);

    // Persist immediately so all tabs stay in sync
    try {
      setIsSaving(true);
      await onUpdateScope(vendor.id, {
        level1: newL1,
        level2List: allNewL2List,
      });
      setSaveSuccessMsg(`Lini Bisnis berhasil disinkronkan ke "${newL1}". Seluruh sub-kategori telah disesuaikan.`);
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    } catch (e) {
      console.warn('Gagal menyimpan scope:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelLevel1Change = () => {
    setIsConfirmModalOpen(false);
    setPendingLevel1(null);
  };

  // Toggle Level 2 checkbox
  const handleToggleLevel2 = (l2: string) => {
    setSelectedLevel2List((prev) => {
      const next = prev.includes(l2) ? prev.filter((item) => item !== l2) : [...prev, l2];
      return next;
    });
  };

  const handleSelectAllLevel2 = () => {
    setSelectedLevel2List((prev) => [...new Set([...prev, ...availableLevel2Options])]);
  };

  const handleClearAllLevel2 = () => {
    setSelectedLevel2List((prev) => prev.filter((l2) => !availableLevel2Options.includes(l2)));
  };

  // Live matching SKU count
  const matchingSkusCount = useMemo(
    () => scopeSkuCount(taxonomy, selectedLevel1, selectedLevel2List),
    [taxonomy, selectedLevel1, selectedLevel2List],
  );

  // Save full scope explicitly
  const handleSaveScopeExplicitly = async () => {
    setIsSaving(true);
    try {
      await onUpdateScope(vendor.id, {
        level1: selectedLevel1,
        level2List: selectedLevel2List,
      });
      setSaveSuccessMsg(`Lini bisnis & ${selectedLevel2List.length} sub-kategori produk berhasil disimpan!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e) {
      console.warn('Gagal menyimpan scope:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Card: Lini Bisnis & Opsi Produk yang Dijual */}
      <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 sm:p-6 shadow-md dark:border-slate-800 dark:bg-[#0B1A3D]/95 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 font-bold">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-siloam font-bold text-[#0B2361] dark:text-white flex items-center gap-2">
                <span>1. Lini Bisnis &amp; Opsi Produk yang Dijual</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-[#1B3F9B] font-bold dark:bg-blue-950 dark:text-blue-300">
                  Tersinkronisasi Otomatis
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih kategori utama (Level 1) dan sub-kategori produk (Level 2) yang disuplai oleh perusahaan Anda
              </p>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Katalog Siloam ERP</span>
          </span>
        </div>

        {/* 1. Bar Dropdown Lini Bisnis (Level 1) */}
        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/30 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <label className="text-xs font-siloam font-bold text-[#0B2361] dark:text-blue-300 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#1B3F9B] dark:text-blue-400 shrink-0" />
                <span>Kategori Utama Lini Bisnis (Level 1):</span>
              </label>
              <select
                value={selectedLevel1}
                onChange={(e) => handleLevel1DropdownChange(e.target.value)}
                className="w-full rounded-xl border border-blue-300 bg-white py-2 px-3 text-xs font-bold text-[#0B2361] focus:border-[#1B3F9B] focus:outline-none dark:border-blue-700 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs"
              >
                {level1List.map((l1) => (
                  <option key={l1} value={l1}>
                    {l1}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-1 sm:pt-4">
              <button
                type="button"
                onClick={() => setIsAssistModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                title="Bingung memilih Lini Bisnis? Cari dari contoh produk"
              >
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Bantuan Cari Contoh Produk</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-0.5">
            <Check className="h-3 w-3 text-emerald-600 shrink-0" />
            <span>
              Perubahan pada dropdown ini akan <strong>otomatis sinkron</strong> dengan dropdown Lini Bisnis di tab <em>Profil Perusahaan &amp; PIC</em>.
            </span>
          </p>
        </div>

        {/* 2. Sub-Kategori Produk yang Dijual (Level 2) */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Pilih Sub-Kategori Produk (Level 2) yang Anda Suplai:
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#e11d48] text-white shadow-2xs">
                {availableLevel2Options.filter((l2) => selectedLevel2List.includes(l2)).length} dari {availableLevel2Options.length} terpilih
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAllLevel2}
                className="text-xs font-semibold text-[#1B3F9B] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Pilih Semua
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={handleClearAllLevel2}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
              >
                Batalkan Semua
              </button>
            </div>
          </div>

          {/* Quick Search inside Level 2 list */}
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={level2SearchQuery}
              onChange={(e) => setLevel2SearchQuery(e.target.value)}
              placeholder={`Filter ${availableLevel2Options.length} sub-kategori ${selectedLevel1}...`}
              className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Checkboxes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
            {filteredLevel2Options.map((l2) => {
              const isChecked = selectedLevel2List.includes(l2);
              return (
                <button
                  key={l2}
                  type="button"
                  onClick={() => handleToggleLevel2(l2)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                    isChecked
                      ? 'border-blue-400 bg-blue-50/70 text-[#0B2361] dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200 font-semibold shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-[#1B3F9B] dark:text-blue-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{l2}</span>
                  </div>
                </button>
              );
            })}

            {filteredLevel2Options.length === 0 && (
              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                Tidak ada sub-kategori yang cocok dengan pencarian "{level2SearchQuery}".
              </div>
            )}
          </div>
        </div>

        {/* Footer info & Save Button */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <PackageCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Total <strong>{matchingSkusCount} Master SKU</strong> Siloam sesuai dengan pilihan lini bisnis ini.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving || selectedLevel2List.length === 0}
              onClick={handleSaveScopeExplicitly}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3F9B] hover:bg-[#153482] text-white font-siloam font-bold text-xs shadow-md shadow-[#1B3F9B]/20 transition-all cursor-pointer disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Lini & Opsi Produk'}</span>
            </button>

            {onNavigateToPricing && (
              <button
                type="button"
                onClick={onNavigateToPricing}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-siloam font-bold text-xs shadow-md transition-all cursor-pointer"
                title="Buka Daftar SKU untuk Memasukkan Penawaran Harga"
              >
                <span>Lihat SKU Terkait ({matchingSkusCount})</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI PERUBAHAN LINI BISNIS (LEVEL 1)          */}
      {/* ======================================================== */}
      {isConfirmModalOpen && pendingLevel1 && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-siloam font-bold text-slate-900 dark:text-white">
                  Konfirmasi Perubahan Lini Bisnis (Level 1)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Perubahan ini akan memperbarui daftar sub-kategori produk yang disuplai perusahaan Anda.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Lini Bisnis Saat Ini:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLevel1}</span>
              </div>
              <div className="flex items-center justify-between border-t border-amber-200/80 pt-1.5 dark:border-amber-900/50">
                <span className="text-amber-800 dark:text-amber-300 font-bold">Lini Bisnis Baru:</span>
                <span className="font-bold text-[#1B3F9B] dark:text-blue-300">{pendingLevel1}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  Seluruh sub-kategori Level 2 akan disesuaikan otomatis (terpilih semua) sesuai milik{' '}
                  <strong>{pendingLevel1}</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-[#1B3F9B] mt-1.5 shrink-0" />
                <span>
                  Pilihan ini juga otomatis tampil sama pada dropdown Lini Bisnis di tab <strong>Profil Perusahaan &amp; PIC</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelLevel1Change}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal (Tetap di {selectedLevel1})
              </button>

              <button
                type="button"
                onClick={handleConfirmLevel1Change}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1B3F9B] hover:bg-[#153482] text-white font-siloam font-bold text-xs shadow-md shadow-[#1B3F9B]/25 transition-all cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Ya, Ganti Lini Bisnis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL BANTUAN CONTOH PRODUK                              */}
      {/* ======================================================== */}
      {isAssistModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-siloam font-bold text-slate-900 dark:text-white">
                    Bantuan Pemilihan Lini Bisnis (Level 1)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ketik nama salah satu produk utama Anda untuk menemukan Lini Bisnis yang paling cocok
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssistModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
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
                  placeholder="Ketik produk (misal: jarum infus, defibrillator, paracetamol, sarung tangan)..."
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {suggestedLevel1Results && suggestedLevel1Results.length > 0 && (
                suggestedLevel1Results.map((res) => (
                  <div
                    key={res.level1}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-850 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{res.level1}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        Contoh: {res.sampleProducts.join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAssistModalOpen(false);
                        handleLevel1DropdownChange(res.level1);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#1B3F9B] text-white text-xs font-bold hover:bg-[#153482] cursor-pointer shrink-0"
                    >
                      Pilih Lini Ini
                    </button>
                  </div>
                ))
              )}

              {hasSearchedProduct && suggestedLevel1Results && suggestedLevel1Results.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tidak ditemukan kategori yang cocok untuk "{productSearchInput}". Coba kata kunci lain.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
