import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Layers,
  PackageCheck,
  ShieldCheck,
  Truck,
  Save,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  CheckSquare,
  Square,
  TableProperties,
  ClipboardList,
  AlertCircle,
  HelpCircle,
  Stethoscope,
  Pill,
  TestTube,
  Bed,
  Laptop,
  AlertTriangle,
  X,
  Search,
  Check,
  Plus,
  Lightbulb
} from 'lucide-react';
import { VendorProfile, BusinessScope } from '../../../core/types';
import { level2NamesOf, scopeSkuCount, searchSkuNames, suggestLevel1, useSkuTaxonomy } from '../../../core/api/catalog';
import { useOptions } from '../../../core/api/options';

interface VendorCoverProfileTabProps {
  vendor: VendorProfile;
  totalSubmissionsCount: number;
  onUpdateProfile: (vendorId: string, updates: Partial<VendorProfile>) => Promise<VendorProfile>;
  onUpdateScope: (vendorId: string, scope: BusinessScope) => Promise<void>;
  onNavigateToMatrix?: () => void;
  onNavigateToPricing?: () => void;
  onNavigateToTerms?: () => void;
  onOpenQuickGuide: () => void;
  onOpenChangePassword?: () => void;
}

export const VendorCoverProfileTab: React.FC<VendorCoverProfileTabProps> = ({
  vendor,
  totalSubmissionsCount,
  onUpdateProfile,
  onUpdateScope,
  onNavigateToMatrix,
  onNavigateToPricing,
  onNavigateToTerms,
  onOpenQuickGuide,
  onOpenChangePassword,
}) => {
  const handleGoToPricing = onNavigateToPricing || onNavigateToMatrix || (() => {});
  // --- FORM STATE: COMPANY & PIC DETAILS ---
  const [companyName, setCompanyName] = useState(vendor.companyName || '');
  const [npwp, setNpwp] = useState(vendor.npwp || '');
  const [address, setAddress] = useState(vendor.address || '');
  const [authorizedPerson, setAuthorizedPerson] = useState(vendor.authorizedPerson || '');
  const [email, setEmail] = useState(vendor.email || '');
  const [phone, setPhone] = useState(vendor.phone || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state if vendor prop changes externally
  useEffect(() => {
    setCompanyName(vendor.companyName || '');
    setNpwp(vendor.npwp || '');
    setAddress(vendor.address || '');
    setAuthorizedPerson(vendor.authorizedPerson || '');
    setEmail(vendor.email || '');
    setPhone(vendor.phone || '');
  }, [vendor]);

  // --- LINI BISNIS & OPSI PRODUK STATE (LEVEL 1 & LEVEL 2) ---
  const taxonomy = useSkuTaxonomy();
  const sampleChips = useOptions('sku_quick_search');
  const level1List = useMemo(() => taxonomy.map((t) => t.level1).sort(), [taxonomy]);

  // Default Level 1
  const initialL1 = vendor.businessScope?.level1 || level1List[0] || 'DIAGNOSTIC AND MEDICAL DEVICES';
  const [selectedLevel1, setSelectedLevel1] = useState<string>(initialL1);

  // Modal confirmation state when user attempts to change Level 1 dropdown
  const [pendingLevel1, setPendingLevel1] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // 2. Extract Level 2 categories belonging to the currently selected Level 1
  const availableLevel2Options = useMemo(() => level2NamesOf(taxonomy, selectedLevel1), [taxonomy, selectedLevel1]);

  // 3. Selected Level 2 categories; empty means every Level 2 under the Level 1.
  const [selectedLevel2List, setSelectedLevel2List] = useState<string[]>(
    () => vendor.businessScope?.level2List ?? [],
  );

  // Sync scope state if vendor prop changes externally
  useEffect(() => {
    if (vendor.businessScope?.level1) {
      setSelectedLevel1(vendor.businessScope.level1);
    }
    if (vendor.businessScope?.level2List && vendor.businessScope.level2List.length > 0) {
      setSelectedLevel2List(vendor.businessScope.level2List);
    }
  }, [vendor.businessScope]);

  // --- ASSISTIVE SEARCH: Suggest Level 1 from Sample Product Input ---
  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [suggestedLevel1Results, setSuggestedLevel1Results] = useState<{
    level1: string;
    matchCount: number;
    sampleProducts: string[];
  }[] | null>(null);
  const [hasSearchedProduct, setHasSearchedProduct] = useState(false);

  // Search the whole open catalog to propose the most suitable Level 1
  const searchSeq = useRef(0);

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

  // --- LEVEL 2 PILL FILTER STATE ---
  const [level2SearchQuery, setLevel2SearchQuery] = useState('');
  const filteredLevel2Options = useMemo(() => {
    if (!level2SearchQuery.trim()) return availableLevel2Options;
    const q = level2SearchQuery.trim().toLowerCase();
    return availableLevel2Options.filter((opt) => opt.toLowerCase().includes(q));
  }, [availableLevel2Options, level2SearchQuery]);

  // Intercept dropdown selection for Level 1: trigger confirmation modal
  const handleLevel1DropdownChange = (newL1: string) => {
    if (newL1 === selectedLevel1) return;
    setPendingLevel1(newL1);
    setIsConfirmModalOpen(true);
  };

  // Confirm change of Level 1: resets Level 2 selection to "selected all" under new Level 1 and syncs immediately
  const handleConfirmLevel1Change = async () => {
    if (!pendingLevel1) return;

    const newL1 = pendingLevel1;
    setSelectedLevel1(newL1);

    // Default: select ALL Level 2 under the new Level 1
    const allNewL2List = level2NamesOf(taxonomy, newL1);
    setSelectedLevel2List(allNewL2List);

    setIsConfirmModalOpen(false);
    setPendingLevel1(null);

    // Persist immediately to vendor scope so tab Ketentuan & catalog immediately sync
    try {
      setIsSaving(true);
      await onUpdateScope(vendor.id, {
        level1: newL1,
        level2List: allNewL2List,
      });
      setSaveSuccessMsg(
        `Lini Bisnis berhasil diganti ke "${newL1}". Pilihan ini otomatis sinkron dengan card Lini Bisnis di tab Lini Bisnis & Ketentuan Distribusi.`
      );
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    } catch (err: any) {
      setFormError('Gagal memperbarui Lini Bisnis: ' + (err.message || 'Error'));
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
      if (prev.includes(l2)) {
        return prev.filter((item) => item !== l2);
      } else {
        return [...prev, l2];
      }
    });
  };

  const handleSelectAllLevel2 = () => {
    setSelectedLevel2List((prev) => [...new Set([...prev, ...availableLevel2Options])]);
  };

  const handleClearAllLevel2 = () => {
    setSelectedLevel2List((prev) => prev.filter((l2) => !availableLevel2Options.includes(l2)));
  };

  // Count how many SKUs match the current selection
  const matchingSkusCount = useMemo(
    () => scopeSkuCount(taxonomy, selectedLevel1, selectedLevel2List),
    [taxonomy, selectedLevel1, selectedLevel2List],
  );

  // Unified Save Handler: Saves Company, PIC, and Business Scope (Level 1 & Level 2) together
  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!companyName.trim()) {
      setFormError('Nama Perusahaan wajib diisi.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Email resmi PIC wajib diisi dengan format yang benar.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Nomor WhatsApp / Telepon PIC wajib diisi.');
      return;
    }
    if (!selectedLevel1) {
      setFormError('Pilih Lini Bisnis Utama (Level 1).');
      return;
    }
    if (selectedLevel2List.length === 0) {
      setFormError('Pilih minimal 1 opsi produk yang dijual (Level 2).');
      return;
    }

    setIsSaving(true);
    try {
      const newScope: BusinessScope = {
        level1: selectedLevel1,
        level2List: selectedLevel2List,
      };

      // 1. Update company profile & PIC
      await onUpdateProfile(vendor.id, {
        companyName: companyName.trim(),
        npwp: npwp.trim(),
        address: address.trim(),
        authorizedPerson: authorizedPerson.trim(),
        email: email.trim(),
        phone: phone.trim(),
        businessScope: newScope,
      });

      // 2. Update business scope
      await onUpdateScope(vendor.id, newScope);

      setIsSaving(false);
      setSaveSuccessMsg('Data Profil Perusahaan, Kontak PIC & Lini Bisnis (Level 1) berhasil disimpan!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setIsSaving(false);
      setFormError(err.message || 'Gagal menyimpan perubahan profil rekanan.');
    }
  };

  // Helper icons for Level 1 categories
  const getCategoryIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes('diagnostic') || lower.includes('device') || lower.includes('medis')) {
      return <Stethoscope className="h-4 w-4 text-[#1B3F9B] dark:text-blue-400" />;
    }
    if (lower.includes('pharmaceutical') || lower.includes('obat') || lower.includes('bmhp')) {
      return <Pill className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
    if (lower.includes('lab') || lower.includes('reagen')) {
      return <TestTube className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
    }
    if (lower.includes('furniture') || lower.includes('bed')) {
      return <Bed className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    }
    return <Laptop className="h-4 w-4 text-slate-700 dark:text-slate-300" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12 animate-in fade-in duration-200">
      
      {/* ======================================================== */}
      {/* 1. HEADER PROFIL REKANAN (ALIGNED WITH CENTERED CARD)    */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-5 sm:p-7 shadow-md backdrop-blur-md dark:border-slate-800 dark:bg-[#0B1A3D]/95">
        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-[#1B3F9B]/15 to-[#F5A623]/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          {/* Company Title & Badges */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 border border-[#1B3F9B]/20">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Rekanan Terdaftar Siloam Hospitals Group</span>
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                ID: {vendor.id}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-siloam font-extrabold text-[#0B2361] dark:text-white tracking-tight leading-tight">
              {vendor.companyName}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Verifikasi kelengkapan profil legalitas perusahaan, perbarui kontak resmi penanggung jawab (PIC), serta tentukan <strong>Lini Bisnis Utama (Level 1)</strong> penawaran rekanan Anda.
            </p>
          </div>

          {/* Action CTA Buttons */}
          <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={handleGoToPricing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#1B3F9B] to-[#2552C7] text-white font-siloam font-bold text-xs shadow-md shadow-[#1B3F9B]/25 hover:from-[#153482] hover:to-[#1B3F9B] transition-all cursor-pointer"
            >
              <TableProperties className="h-4 w-4 text-[#F5A623]" />
              <span>Daftar SKU Siloam</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onOpenQuickGuide}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Panduan</span>
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {saveSuccessMsg && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-medium leading-relaxed">{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={handleGoToPricing}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            Buka Daftar SKU →
          </button>
        </div>
      )}

      {formError && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 shadow-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-medium">{formError}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CARD UTAMA: PROFIL PERUSAHAAN & PIC (CENTERED)        */}
      {/* ======================================================== */}
      <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-md dark:border-slate-800 dark:bg-[#0B1A3D]/95 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 shadow-2xs">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-siloam font-bold text-[#0B2361] dark:text-white">
                Profil Perusahaan &amp; PIC
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data legalitas perusahaan dan kontak resmi penanggung jawab (PIC) rekanan
              </p>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Formulir Terverifikasi</span>
          </span>
        </div>

        <form onSubmit={handleSaveAll} className="space-y-4">
            {/* 1. Nama Perusahaan */}
            <div>
              <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
                Nama Perusahaan / Distributor <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Contoh: PT Medika Farma Pratama"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 2. NPWP Perusahaan */}
            <div>
              <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
                Nomor Pokok Wajib Pajak (NPWP)
              </label>
              <div className="relative">
                <CreditCard className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={npwp}
                  onChange={(e) => setNpwp(e.target.value)}
                  placeholder="01.234.567.8-012.000"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 3. Alamat Perusahaan */}
            <div>
              <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
                Alamat Kantor / Gudang
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-2.5 left-0 ml-3 h-4 w-4 text-slate-400" />
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Boulevard Gajah Mada No. 209, Tangerang"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 4. Lini Bisnis Utama (Level 1) */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-siloam font-bold text-[#0B2361] dark:text-blue-300 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-[#1B3F9B] dark:text-blue-400" />
                  <span>Lini Bisnis Utama (Level 1) <span className="text-red-500">*</span></span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsAssistModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                  title="Bingung memilih Lini Bisnis? Cari dari contoh produk"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  <span>Bingung? Cari Contoh Produk</span>
                </button>
              </div>

              <div className="relative">
                <select
                  value={selectedLevel1}
                  onChange={(e) => handleLevel1DropdownChange(e.target.value)}
                  className="w-full rounded-xl border border-blue-300 bg-white py-2 px-3 text-xs font-bold text-[#0B2361] focus:border-[#1B3F9B] focus:outline-none dark:border-blue-700 dark:bg-slate-900 dark:text-white cursor-pointer shadow-2xs"
                >
                  {level1List.map((l1) => (
                    <option key={l1} value={l1}>
                      {l1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>Perubahan dropdown ini otomatis sinkron dengan card Lini Bisnis di tab Ketentuan Distribusi.</span>
                {onNavigateToTerms && (
                  <button
                    type="button"
                    onClick={onNavigateToTerms}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-left sm:text-right shrink-0 cursor-pointer"
                  >
                    Atur Sub-Kategori (Level 2) →
                  </button>
                )}
              </div>
            </div>

            {/* Divider PIC */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <span className="text-[11px] font-bold text-[#1B3F9B] dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                <span>Penanggung Jawab (PIC Rekanan)</span>
              </span>
            </div>

            {/* 4. Nama PIC */}
            <div>
              <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
                Nama Lengkap PIC Penjualan / Tender <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <UserCheck className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={authorizedPerson}
                  onChange={(e) => setAuthorizedPerson(e.target.value)}
                  placeholder="Contoh: Hendra Gunawan (Direktur Penjualan)"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 5. Email & Phone PIC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
                  Email PIC <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tender@perusahaan.co.id"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
                  WhatsApp / HP PIC <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-XXXX-XXXX"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button & Change Password trigger */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {onOpenChangePassword && (
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className="text-xs text-[#1B3F9B] dark:text-blue-400 hover:underline font-semibold text-left cursor-pointer"
                >
                  Ubah Password Akun →
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B3F9B] hover:bg-[#153482] text-white font-siloam font-bold text-xs shadow-md shadow-[#1B3F9B]/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Profil & Kontak PIC'}</span>
              </button>
            </div>
          </form>
        </div>

      {/* ======================================================== */}
      {/* 3. MODAL KONFIRMASI PERUBAHAN LINI BISNIS (LEVEL 1)       */}
      {/* ======================================================== */}
      {isConfirmModalOpen && pendingLevel1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            
            {/* Header with warning icon */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-siloam font-bold text-slate-900 dark:text-white">
                  Konfirmasi Perubahan Lini Bisnis (Level 1)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Perubahan ini akan mempengaruhi daftar produk yang akan diisi perusahaan Anda.
                </p>
              </div>
            </div>

            {/* Comparison Box */}
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

            {/* Impact Details */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Seluruh opsi produk Level 2 yang telah Anda pilih sebelumnya akan di-reset</strong> dan secara otomatis disesuaikan (terpilih semua) sesuai sub-kategori milik <strong>{pendingLevel1}</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-[#1B3F9B] mt-1.5 shrink-0" />
                <span>
                  Daftar SKU yang muncul pada tab <strong>Daftar SKU Siloam & Penawaran Harga</strong> akan langsung diperbarui ke komoditas <strong>{pendingLevel1}</strong>.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
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
                <span>Ya, Ganti Lini Bisnis & Reset Pilihan</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL ASSISTIVE SEARCH: CARI DARI CONTOH PRODUK       */}
      {/* ======================================================== */}
      {isAssistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                  <Lightbulb className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-siloam font-bold text-slate-900 dark:text-white">
                    Bantuan Pemilihan Lini Bisnis (Level 1)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ketik contoh nama produk atau alat kesehatan yang akan Anda jual, tekan Enter untuk mencari rekomendasi Lini Bisnis.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssistModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Input Search Box */}
            <div className="space-y-2 pt-1">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={productSearchInput}
                  onChange={(e) => {
                    setProductSearchInput(e.target.value);
                    if (!e.target.value.trim()) {
                      setSuggestedLevel1Results(null);
                      setHasSearchedProduct(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSuggestLevel1(productSearchInput);
                    }
                  }}
                  placeholder="Ketik contoh nama produk (misal: gunting bedah, paracetamol, infus, monitor)..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-24 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handleSuggestLevel1(productSearchInput)}
                  className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-[#1B3F9B] hover:bg-[#153482] text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  Cari (Enter)
                </button>
              </div>

              {/* Quick sample chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-medium">Contoh Cepat:</span>
                {sampleChips.map(({ value: sample, label }) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setProductSearchInput(label);
                      handleSuggestLevel1(sample);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Display */}
            {hasSearchedProduct && (
              <div className="pt-2 animate-in fade-in">
                {suggestedLevel1Results && suggestedLevel1Results.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-3.5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Rekomendasi Lini Bisnis (Level 1):</span>
                        </div>
                        <div className="text-sm font-siloam font-extrabold text-[#0B2361] dark:text-white truncate">
                          {suggestedLevel1Results[0].level1}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Ditemukan {suggestedLevel1Results[0].matchCount} produk serupa di katalog Siloam (contoh: <em>{suggestedLevel1Results[0].sampleProducts.join(', ')}</em>)
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAssistModalOpen(false);
                          handleLevel1DropdownChange(suggestedLevel1Results[0].level1);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer self-start flex items-center gap-1.5"
                      >
                        <Check className="h-4 w-4 stroke-[3]" />
                        <span>Terapkan Lini Ini</span>
                      </button>
                    </div>

                    {/* Secondary Suggestions if any */}
                    {suggestedLevel1Results.length > 1 && (
                      <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-800/70 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-500">Alternatif lain:</span>
                        {suggestedLevel1Results.slice(1, 3).map((sec) => (
                          <button
                            key={sec.level1}
                            type="button"
                            onClick={() => {
                              setIsAssistModalOpen(false);
                              handleLevel1DropdownChange(sec.level1);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-[#1B3F9B] dark:text-blue-300 hover:underline border border-slate-200 dark:border-slate-700 font-medium text-xs cursor-pointer"
                          >
                            {sec.level1} ({sec.matchCount} produk)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      Produk "{productSearchInput}" belum ditemukan langsung. Coba kata kunci umum seperti: <em>kasa</em>, <em>infus</em>, <em>perban</em>, <em>jarum</em>, <em>monitor</em>.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAssistModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
