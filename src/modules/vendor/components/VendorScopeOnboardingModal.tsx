import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { BusinessScope, VendorProfile } from '../types';
import { level2NamesOf, searchSkuNames, SkuHit, useSkuTaxonomy } from '../../../core/api/catalog';
import {
  Sparkles,
  Search,
  Check,
  Building2,
  Layers,
  ArrowRight,
  HelpCircle,
  FolderTree,
  Filter,
  CheckCircle2,
  Info
} from 'lucide-react';

interface VendorScopeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorProfile;
  onSaveScope: (scope: BusinessScope) => void;
}

export const VendorScopeOnboardingModal: React.FC<VendorScopeOnboardingModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onSaveScope,
}) => {
  const taxonomy = useSkuTaxonomy();
  const level1Categories = useMemo(() => taxonomy.map((t) => t.level1), [taxonomy]);

  // Selected Level 1 (single select)
  const [selectedLevel1, setSelectedLevel1] = useState<string>(() => {
    return vendor.businessScope?.level1 || level1Categories[0] || '';
  });

  const availableLevel2Categories = useMemo(() => level2NamesOf(taxonomy, selectedLevel1), [taxonomy, selectedLevel1]);

  // Selected Level 2 categories; empty means every Level 2 under the Level 1.
  const [selectedLevel2List, setSelectedLevel2List] = useState<string[]>(
    () => vendor.businessScope?.level2List ?? [],
  );

  // "Anda Bingung?" Product search hints
  const [productHintQuery, setProductHintQuery] = useState('');
  const [activeHintMessage, setActiveHintMessage] = useState<string | null>(null);

  // Search the whole open catalog, one hint per Level 1 / Level 2 pair
  const [productSearchSuggestions, setProductSearchSuggestions] = useState<SkuHit[]>([]);
  useEffect(() => {
    const q = productHintQuery.trim();
    if (q.length < 2) {
      setProductSearchSuggestions([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      searchSkuNames(q)
        .then((hits) => {
          const seen = new Set<string>();
          const unique = hits.filter((h) => !seen.has(`${h.level1}|${h.level2}`) && seen.add(`${h.level1}|${h.level2}`));
          if (live) setProductSearchSuggestions(unique.slice(0, 4));
        })
        .catch((err) => console.error(err));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [productHintQuery]);

  // When Level 1 changes, update Level 2 selections
  const handleSelectLevel1 = (l1: string) => {
    setSelectedLevel1(l1);
    setSelectedLevel2List(level2NamesOf(taxonomy, l1)); // By default select all Level 2s under chosen Level 1
    setActiveHintMessage(null);
  };

  // Toggle Level 2 selection
  const handleToggleLevel2 = (l2: string) => {
    setSelectedLevel2List((prev) => {
      if (prev.includes(l2)) {
        // Keep at least one or allow unchecking
        return prev.filter((item) => item !== l2);
      } else {
        return [...prev, l2];
      }
    });
  };

  const handleSelectAllLevel2 = () => {
    setSelectedLevel2List((prev) => [...new Set([...prev, ...availableLevel2Categories])]);
  };

  const handleClearAllLevel2 = () => {
    setSelectedLevel2List((prev) => prev.filter((l2) => !availableLevel2Categories.includes(l2)));
  };

  // Apply hint suggestion from "Anda Bingung?"
  const handleApplyHint = (l1: string, l2: string, commodityName: string) => {
    setSelectedLevel1(l1);
    setSelectedLevel2List([l2]);
    setActiveHintMessage(
      `Petunjuk diterapkan! Kategori diatur ke "${l1}" dengan scope sub-kategori "${l2}" untuk produk "${commodityName}".`
    );
  };

  const handleSave = () => {
    if (!selectedLevel1) {
      alert('Pilih salah satu Kategori Level 1.');
      return;
    }
    if (selectedLevel2List.length === 0) {
      alert('Pilih minimal 1 Scope Kategori di Level 2.');
      return;
    }

    onSaveScope({
      level1: selectedLevel1,
      level2List: selectedLevel2List,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definisikan Ruang Lingkup Bisnis (Business Scope)"
      subtitle={`Vendor: ${vendor.companyName} · Fokuskan katalog komoditas yang relevan bagi Anda`}
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Top Info Banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/40">
          <div className="flex items-start gap-2.5">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-blue-900 dark:text-blue-200">
              <span className="font-bold">Penyaringan Komoditas Berdasarkan Bidang Usaha:</span>
              <p className="mt-0.5 text-blue-700 dark:text-blue-300 leading-relaxed text-[11px]">
                Supplier Alat Kesehatan tidak perlu menelusuri ribuan komoditas obat atau linen. Tentukan ruang lingkup bisnis Anda agar daftar pengisian penawaran harga hanya menampilkan item yang relevan.
              </p>
            </div>
          </div>
        </div>

        {/* FEATURE: "ANDA BINGUNG? CARI BERDASARKAN NAMA PRODUK" */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Anda Bingung Memilih Kategori? Ketik Nama Produk Anda:</span>
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
              Pencari Scope Cerdas
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-3.5 w-3.5 text-indigo-400" />
            <input
              type="text"
              value={productHintQuery}
              onChange={(e) => setProductHintQuery(e.target.value)}
              placeholder="Contoh ketik: jarum, tur, stetoskop, infus, reagen, kasur pasien, sarung tangan..."
              className="w-full rounded-lg border border-indigo-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Render Hints if query is typed */}
          {productHintQuery.trim().length >= 2 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-300">
                Petunjuk Rekomendasi Kategori:
              </div>

              {productSearchSuggestions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {productSearchSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-indigo-200 bg-white p-2.5 shadow-2xs hover:border-indigo-400 dark:border-indigo-900 dark:bg-slate-850 flex flex-col justify-between gap-1.5 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          "{item.commodityName}"
                        </div>
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 leading-snug">
                          <span className="font-semibold">Level 1:</span> {item.level1}
                          <br />
                          <span className="font-semibold">Level 2:</span> {item.level2}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyHint(item.level1, item.level2, item.commodityName)}
                        className="w-full flex items-center justify-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px] py-1 px-2 transition-colors cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Terapkan Petunjuk Ini</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-[11px] italic bg-white dark:bg-slate-900 p-2 rounded border border-indigo-100 dark:border-indigo-900">
                  Tidak ditemukan nama item spesifik untuk "{productHintQuery}". Silakan pilih kategori Level 1 secara manual di bawah.
                </div>
              )}
            </div>
          )}

          {activeHintMessage && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{activeHintMessage}</span>
            </div>
          )}
        </div>

        {/* STEP 1: PILIH 1 KATEGORI UTAMA DI LEVEL 1 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
              <span>Pilih Kategori Utama (Level 1) *</span>
            </label>
            <span className="text-[10px] text-slate-500">Pilih salah satu</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {level1Categories.map((cat) => {
              const isSelected = selectedLevel1 === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectLevel1(cat)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-100 font-bold ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                    </div>
                    <span className="truncate text-xs">{cat}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: PILIH BEBERAPA SCOPE DI LEVEL 2 */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
                <span>Pilih Ruang Lingkup Sub-Kategori (Level 2) *</span>
              </label>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Anda dapat memilih <strong>beberapa kategori (Multi-Select)</strong> di bawah {selectedLevel1}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllLevel2}
                className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                Pilih Semua
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearAllLevel2}
                className="text-[11px] font-semibold text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
            {availableLevel2Categories.map((subCat) => {
              const isChecked = selectedLevel2List.includes(subCat);
              return (
                <label
                  key={subCat}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-blue-400 bg-blue-50/50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleLevel2(subCat)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="leading-snug">{subCat}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* SUMMARY & SUBMISSION BAR */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-600 dark:text-slate-400">
            Terpilih: <strong>{selectedLevel1}</strong> ·{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {selectedLevel2List.length} Sub-kategori
            </span>{' '}
            
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={!selectedLevel1 || selectedLevel2List.length === 0}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Terapkan Scope & Buka Daftar SKU
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
