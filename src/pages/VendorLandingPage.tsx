import React, { useState, useMemo, useEffect } from 'react';
import { VendorProfile, BusinessScope } from '../core/types';
import { SiloamLogo } from '../core/ui/SiloamLogo';
import { authService } from '../core/services/auth/authService';
import { patchVendor } from '../core/api/session';
import { fetchSkuTaxonomy, searchSkuNames, SkuHit, SkuTaxonomy } from '../core/api/catalog';
import { useActiveHospitalCount, useOptions } from '../core/api/options';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  Sparkles,
  Search,
  Check,
  Layers,
  Filter,
  AlertCircle,
  HelpCircle,
  Sun,
  Moon,
  Clock,
  Phone,
  Mail,
  Info,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Pill,
  TestTube,
  Bed,
  Laptop,
  CheckCheck,
  ArrowLeft,
  Award,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useUrlTab } from '../core/router/useAppRouter';
import { passwordProblem, passwordRules, phoneProblem, vendorIdentifierProblem } from '../core/auth/signInRules';
import { PasswordChecklist } from '../core/ui/PasswordChecklist';

const LANDING_TABS = ['login', 'new_vendor'] as const;

interface VendorLandingPageProps {
  onLoginSuccess: (vendor: VendorProfile, isNewSupplier: boolean, scope?: BusinessScope) => void;
  onNavigateAdmin: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

// Visual category mapping to Siloam ERP Level 1 & Level 2
interface VisualCategoryOption {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  level1: string;
  level2List: string[];
  examples: string[];
  count: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'DIAGNOSTIC AND MEDICAL DEVICES': <Stethoscope className="h-5 w-5 text-[#1B3F9B] dark:text-blue-400" />,
  'DRUGS & CONSUMABLE': <Pill className="h-5 w-5 text-[#E5A823] dark:text-amber-400" />,
  'GENERAL SUPPLIES': <TestTube className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
  'GENERAL EQUIPMENT': <Bed className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
  'INFORMATION & COMMUNICATION TECHNOLOGY': <Laptop className="h-5 w-5 text-slate-700 dark:text-slate-300" />,
};

const OFFICIAL_SILOAM_LOGO_URL = 'https://www.siloamhospitals.com/assets/logo-new-DU4qZWaH.png';

export const VendorLandingPage: React.FC<VendorLandingPageProps> = ({
  onLoginSuccess,
  onNavigateAdmin,
  isDark,
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useUrlTab('akses', LANDING_TABS);

  // Step tracker
  const [step, setStep] = useState<'profile' | 'product_category'>('profile');

  // VENDOR LOGIN FIELDS
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  // NEW VENDOR FORM FIELDS
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [authorizedPerson, setAuthorizedPerson] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [npwp, setNpwp] = useState('');
  const [address, setAddress] = useState('');
  const [newVendorPassword, setNewVendorPassword] = useState('');
  const [newVendorConfirmPassword, setNewVendorConfirmPassword] = useState('');
  const [showNewVendorPassword, setShowNewVendorPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // WORKING VENDOR DATA ACROSS STEPS
  const [currentWorkingVendor, setCurrentWorkingVendor] = useState<VendorProfile | null>(null);

  const categoryOptions = useOptions('product_category');
  const hospitalCount = useActiveHospitalCount();
  const [taxonomy, setTaxonomy] = useState<SkuTaxonomy>([]);
  useEffect(() => {
    fetchSkuTaxonomy().then(setTaxonomy).catch((err) => console.error(err));
  }, []);

  // Categories are the live ERP Level 1 groups; ref_options only adds the Indonesian label and badge.
  const visualCategories: VisualCategoryOption[] = useMemo(() => {
    const labels = new Map(categoryOptions.map((o, i) => [o.value, { o, i }]));
    return taxonomy
      .map((t) => {
        const ref = labels.get(t.level1);
        return {
          id: t.level1,
          name: ref?.o.label ?? t.level1,
          subtitle: String(ref?.o.meta.subtitle ?? t.level2.map((l2) => l2.name).join(', ')),
          badge: String(ref?.o.meta.badge ?? t.level1),
          icon: CATEGORY_ICONS[t.level1] ?? <Layers className="h-5 w-5 text-slate-700 dark:text-slate-300" />,
          level1: t.level1,
          level2List: t.level2.map((l2) => l2.name),
          examples: t.examples,
          count: t.count,
          sort: ref?.i ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((x, y) => x.sort - y.sort);
  }, [categoryOptions, taxonomy]);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  useEffect(() => {
    if (visualCategories.length > 0) setSelectedCategoryIds((prev) => (prev.length > 0 ? prev : [visualCategories[0].id]));
  }, [visualCategories]);

  // Product Search State ("Hero Search")
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItemNotification, setAddedItemNotification] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{ sku: SkuHit; suggestedCatId: string }[]>([]);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      searchSkuNames(q)
        .then((hits) => live && setSearchResults(hits.slice(0, 4).map((sku) => ({ sku, suggestedCatId: sku.level1 }))))
        .catch((err) => console.error(err));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(catId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  const handleAddCategoryFromSearch = (catId: string, itemName: string) => {
    if (!selectedCategoryIds.includes(catId)) {
      setSelectedCategoryIds((prev) => [...prev, catId]);
    }
    setAddedItemNotification(`Kategori untuk "${itemName}" berhasil ditambahkan ke pilihan Anda!`);
    setTimeout(() => setAddedItemNotification(null), 3000);
  };

  const handleVendorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const identifierProblem = vendorIdentifierProblem(loginIdentifier);
    if (identifierProblem) {
      setFormError(identifierProblem);
      return;
    }
    if (!loginPassword) {
      setFormError('Masukkan password akun rekanan.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const vendor = await authService.vendorLogin(loginIdentifier.trim(), loginPassword);
      setCurrentWorkingVendor(vendor);
      if (vendor.businessScope && vendor.businessScope.level1) {
        onLoginSuccess(vendor, false, vendor.businessScope);
      } else {
        setStep('product_category');
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal login rekanan. Periksa Email/NPWP dan password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleProceedNewVendorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!companyName.trim()) {
      setFormError('Nama Perusahaan / Distributor wajib diisi.');
      return;
    }
    if (!email.includes('@') || vendorIdentifierProblem(email)) {
      setFormError('Email PIC perusahaan wajib diisi dengan benar.');
      return;
    }
    const phoneIssue = phoneProblem(phone);
    if (phoneIssue) {
      setFormError(phoneIssue);
      return;
    }
    const npwpDigits = npwp.replace(/\D/g, '');
    if (npwpDigits && !/^0+$/.test(npwpDigits) && npwpDigits.length !== 15 && npwpDigits.length !== 16) {
      setFormError('NPWP harus 15 atau 16 digit, atau dikosongkan.');
      return;
    }
    const passwordIssue = passwordProblem(newVendorPassword, email);
    if (passwordIssue) {
      setFormError(passwordIssue);
      return;
    }
    if (newVendorPassword !== newVendorConfirmPassword) {
      setFormError('Konfirmasi password tidak cocok.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const vendor = await authService.registerVendor({
        companyName: companyName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        authorizedPerson: authorizedPerson.trim(),
        npwp: npwp.trim(),
        password: newVendorPassword,
      });
      setCurrentWorkingVendor(vendor);
      setStep('product_category');
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data rekanan.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFinishAndEnterMatrix = async () => {
    if (!currentWorkingVendor) return;

    const selectedVisuals = visualCategories.filter((vc) => selectedCategoryIds.includes(vc.id));
    const primaryLevel1 = selectedVisuals[0]?.level1 || 'DIAGNOSTIC AND MEDICAL DEVICES';

    const mergedLevel2 = Array.from(
      new Set(selectedVisuals.flatMap((vc) => vc.level2List))
    );

    const scope: BusinessScope = {
      level1: primaryLevel1,
      level2List: mergedLevel2,
    };

    setFormError('');
    try {
      const saved = await patchVendor(currentWorkingVendor.id, { businessScope: scope });
      onLoginSuccess(saved, !saved.isExistingSupplier, saved.businessScope);
    } catch (err: any) {
      setFormError(err.message || 'Lini bisnis gagal disimpan.');
    }
  };

  const matchingSkusCount = visualCategories
    .filter((vc) => selectedCategoryIds.includes(vc.id))
    .reduce((sum, vc) => sum + vc.count, 0);

  return (
    <div className="relative min-h-screen bg-[#F4F7FB] text-[#0F172A] dark:bg-[#071536] dark:text-slate-100 flex flex-col justify-between selection:bg-[#1B3F9B] selection:text-white transition-colors duration-200 overflow-x-hidden">
      
      {/* ======================================================== */}
      {/* FULL-SCREEN OVERALL BACKGROUND PHOTO (NOT IN A FRAME)    */}
      {/* "fotonya menjadi background secara keseluruhan,          */}
      {/*  foto wanitanya tetap di sisi kiri page"                 */}
      {/* ======================================================== */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/src/assets/images/siloam_receptionist_left_1790751440935.jpg"
          alt="Siloam Hospitals Welcoming Healthcare Ambassador"
          className="w-full h-full object-cover object-left lg:object-[15%_center] filter brightness-[0.98] dark:brightness-[0.60] contrast-[1.03]"
          referrerPolicy="no-referrer"
        />

        {/* Sophisticated Dual Gradient Overlay:
            - Left: clear subtle hospital warmth allowing the welcoming woman to stand out
            - Right: smooth transition to clean crisp backdrop for the form card */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 lg:hidden" />
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-black/55 via-[#F4F7FB]/75 to-[#F4F7FB] dark:from-[#071536]/80 dark:via-[#071536]/90 dark:to-[#071536]" />
        
        {/* Subtle hospital blue & gold brand tint */}
        <div className="absolute inset-0 bg-radial from-transparent to-[#1B3F9B]/10 mix-blend-multiply pointer-events-none" />
      </div>

      {/* 1. TOP HEADER BAR WITH OFFICIAL SILOAM LOGO */}
      <header className="relative z-30 w-full border-b border-white/20 bg-white/85 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-xs dark:border-slate-800 dark:bg-[#071536]/85">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Official Siloam Logo */}
          <div className="flex items-center gap-3">
            <img
              src={OFFICIAL_SILOAM_LOGO_URL}
              alt="Siloam Hospitals"
              className="h-9 sm:h-10 w-auto object-contain shrink-0 drop-shadow-xs"
              referrerPolicy="no-referrer"
            />
            <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 border border-[#1B3F9B]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E5A823]" />
              E-Procurement & Sourcing Portal
            </span>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            {/* Dark / Light Mode Switch */}
            <button
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 hover:text-[#1B3F9B] hover:border-[#1B3F9B]/40 transition-colors shadow-2xs dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:text-white cursor-pointer"
              aria-label="Ganti mode tampilan"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#E5A823]" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Link for Internal Siloam Staff */}
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 hover:bg-white hover:border-[#1B3F9B]/40 px-3.5 py-1.5 text-xs font-semibold text-[#0B2361] dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer group"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400" />
              <span className="font-siloam">Staf Internal Siloam</span>
              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[#1B3F9B] dark:text-blue-300">
                /admin
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT: OVERALL FULL-BLEED BACKGROUND WITH LEFT COPY & RIGHT FORM */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end lg:items-center">
          
          {/* LEFT SIDE: WELCOMING WOMAN'S PHOTO VISIBLE AT TOP, COPY AT BOTTOM */}
          <div className="lg:col-span-5 flex flex-col justify-end space-y-4 text-white py-4 lg:py-6 drop-shadow-md">
            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5A823] text-[#0B2361] px-3.5 py-1 text-xs font-siloam font-bold shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
                Pintu Terbuka bagi Calon Rekanan
              </span>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-siloam font-black tracking-tight leading-snug text-white drop-shadow-lg">
                Melayani dengan Kasih & Menjunjung Kemitraan Berkualitas
              </h1>

              <p className="text-xs sm:text-sm text-slate-100/95 leading-relaxed font-normal drop-shadow-md max-w-lg">
                Siloam Hospitals Group membuka peluang kemitraan pengadaan barang & jasa medis berkualitas bagi {hospitalCount ?? '…'} rumah sakit di seluruh Indonesia.
              </p>
            </div>

            {/* Key Bento Badges Floating on the Left */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="rounded-2xl border border-white/30 bg-[#0B2361]/75 backdrop-blur-md p-3 shadow-lg">
                <div className="font-siloam font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#F5A623]" />
                  <span>{hospitalCount ?? '…'} Rumah Sakit</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-1 leading-snug">
                  Jaringan pelayanan kesehatan nasional
                </div>
              </div>

              <div className="rounded-2xl border border-white/30 bg-[#0B2361]/75 backdrop-blur-md p-3 shadow-lg">
                <div className="font-siloam font-bold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#F5A623]" />
                  <span>Tanpa Dokumen Awal</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-1 leading-snug">
                  Legalitas lengkap saat menang tender
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: LOGO SILOAM MITRA REKANAN DIATAS PANEL FORM & CLEAN FORM CARD */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-3">
            {/* Logo Siloam Mitra Rekanan tepat di atas panel form */}
            <div className="flex items-center justify-between px-1">
              <div className="inline-flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-md border border-slate-200/90 dark:bg-[#0B1A3D]/95 dark:border-slate-800">
                <img
                  src={OFFICIAL_SILOAM_LOGO_URL}
                  alt="Siloam Hospitals Healthcare Group"
                  className="h-7 sm:h-8 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="h-5 w-px bg-slate-300 dark:bg-slate-700" />
                <span className="text-[11px] font-siloam font-bold text-[#0B2361] dark:text-blue-300 uppercase tracking-wider">
                  Mitra Rekanan 2026
                </span>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0B2361] dark:text-blue-200 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Portal Rekanan Aktif
              </span>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-[#0B1A3D]/95 space-y-6">

              {step === 'profile' && (
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1.5 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setFormError('');
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1.5 sm:px-3 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'login'
                        ? 'bg-[#1B3F9B] text-white font-siloam font-bold shadow-md shadow-[#1B3F9B]/25'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    <span className="text-[11px] sm:text-xs flex items-center gap-1.5 truncate">
                      <KeyRound className="h-3.5 w-3.5 text-[#F5A623] shrink-0" />
                      <span className="truncate">Login Rekanan</span>
                    </span>
                    <span className="text-[9px] opacity-80 mt-0.5 hidden sm:inline">Mitra Terdaftar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('new_vendor');
                      setFormError('');
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1.5 sm:px-3 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'new_vendor'
                        ? 'bg-[#1B3F9B] text-white font-siloam font-bold shadow-md shadow-[#1B3F9B]/25'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    <span className="text-[11px] sm:text-xs flex items-center gap-1.5 truncate">
                      <Sparkles className="h-3.5 w-3.5 text-[#F5A623] shrink-0" />
                      <span className="truncate">Daftar Baru</span>
                    </span>
                    <span className="text-[9px] opacity-80 mt-0.5 hidden sm:inline">Calon Rekanan</span>
                  </button>
                </div>
              )}

              {/* VISUAL STEPPER / PROGRESS BAR */}
              <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  {/* Step 1 */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-siloam ${
                        step === 'profile'
                          ? 'bg-[#1B3F9B] text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {step === 'product_category' ? '✓' : '1'}
                    </div>
                    <span className={step === 'profile' ? 'font-siloam font-bold text-[#0B2361] dark:text-white' : 'text-slate-500 font-medium'}>
                      {activeTab === 'login' ? 'Login Akun' : 'Data Perusahaan'}
                    </span>
                  </div>

                  <span className="text-slate-300 dark:text-slate-700">———</span>

                  {/* Step 2 */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-siloam ${
                        step === 'product_category'
                          ? 'bg-[#1B3F9B] text-white'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      2
                    </div>
                    <span className={step === 'product_category' ? 'font-siloam font-bold text-[#0B2361] dark:text-white' : 'text-slate-500 font-medium'}>
                      Pilih Jenis Produk
                    </span>
                  </div>

                  <span className="text-slate-300 dark:text-slate-700">———</span>

                  {/* Step 3 */}
                  <div className="flex items-center gap-2 opacity-60">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-siloam bg-slate-200 text-slate-500 dark:bg-slate-800">
                      3
                    </div>
                    <span className="text-slate-500 hidden sm:inline font-medium">Input Harga</span>
                  </div>
                </div>

                {/* Subtitle Message in Siloam Typography */}
                <div className="mt-3">
                  <h2 className="text-lg sm:text-xl font-siloam font-extrabold text-[#0B2361] dark:text-white">
                    {step === 'profile' && activeTab === 'login' && 'Login Portal Rekanan Siloam'}
                    {step === 'profile' && activeTab === 'new_vendor' && 'Daftar Calon Rekanan Baru Siloam'}
                    {step === 'product_category' && 'Pilih Ruang Lingkup Komoditas Anda'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {step === 'profile' && activeTab === 'login' &&
                      'Masuk dengan Email resmi PIC atau NPWP perusahaan dan password akun Anda.'}
                    {step === 'profile' && activeTab === 'new_vendor' &&
                      'Isi data kontak perusahaan dan buat password akun Anda untuk mulai berpartisipasi dalam sourcing Siloam.'}
                    {step === 'product_category' &&
                      'Pilih 1 atau beberapa kategori produk dagang Anda. Matriks penawaran akan disaring otomatis sesuai spesialisasi Anda.'}
                  </p>
                </div>
              </div>

              {/* ERROR ALERT */}
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 1: LOGIN REKANAN (EMAIL / NPWP + PASSWORD)           */}
              {/* ======================================================== */}
              {step === 'profile' && activeTab === 'login' && (
                <form onSubmit={handleVendorLogin} className="space-y-4">
                  {/* Email / NPWP */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                      Email Resmi PIC / NPWP Perusahaan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={120}
                        required
                        placeholder="Contoh: tender@medikafarma.co.id atau 01.234.567.8-012.000"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                      Password Akun Rekanan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        name="current-password"
                        autoComplete="current-password"
                        maxLength={128}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((p) => !p)}
                        aria-label={showLoginPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="absolute inset-y-0 right-0 my-auto mr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {capsLockOn && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Caps Lock aktif.</p>}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1B3F9B] to-[#2552C7] py-3 px-4 text-xs font-siloam font-bold text-white shadow-lg shadow-[#1B3F9B]/25 hover:from-[#153482] hover:to-[#1B3F9B] focus:outline-none disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {isLoggingIn ? (
                      <span>Memverifikasi Akun Rekanan...</span>
                    ) : (
                      <>
                        <span>Masuk ke Portal Rekanan Siloam</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <div className="flex justify-end text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('new_vendor');
                        setFormError('');
                      }}
                      className="text-[#1B3F9B] dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Daftar Calon Rekanan Baru →
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* TAB 3: FORM CALON REKANAN BARU (DILENGKAPI PASSWORD)     */}
              {/* ======================================================== */}
              {step === 'profile' && activeTab === 'new_vendor' && (
                <form onSubmit={handleProceedNewVendorProfile} className="space-y-4">
                  {/* Field 1: Nama Perusahaan */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                      Nama Perusahaan / Distributor <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        name="organization"
                        autoComplete="organization"
                        maxLength={160}
                        required
                        placeholder="Contoh: PT Medika Jaya Abadi"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Field 2 & 3: Email PIC & WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                        Email Resmi PIC Penawaran <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          name="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          maxLength={120}
                          required
                          placeholder="tender@perusahaan.co.id"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                        Nomor WhatsApp PIC <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          name="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={20}
                          required
                          placeholder="0812-XXXX-XXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password Baru Akun Rekanan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                        Buat Password Akun <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                        <input
                          type={showNewVendorPassword ? 'text' : 'password'}
                          name="new-password"
                          autoComplete="new-password"
                          maxLength={128}
                          required
                          placeholder="Min. 8 karakter, huruf + angka"
                          value={newVendorPassword}
                          onChange={(e) => setNewVendorPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewVendorPassword((p) => !p)}
                          aria-label={showNewVendorPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                          className="absolute inset-y-0 right-0 my-auto mr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showNewVendorPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1.5">
                        Konfirmasi Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                        <input
                          type={showNewVendorPassword ? 'text' : 'password'}
                          name="confirm-password"
                          autoComplete="new-password"
                          maxLength={128}
                          required
                          placeholder="Ulangi password"
                          value={newVendorConfirmPassword}
                          onChange={(e) => setNewVendorConfirmPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      {newVendorConfirmPassword && newVendorConfirmPassword !== newVendorPassword && (
                        <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">Konfirmasi belum sama.</p>
                      )}
                    </div>
                  </div>
                  {newVendorPassword && <PasswordChecklist rules={passwordRules(newVendorPassword, email)} />}

                  {/* Optional Accordion: PIC & NPWP */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields((prev) => !prev)}
                      className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-[#0B2361] dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <span>+ Tambah Nama PIC & NPWP (Opsional)</span>
                        <span className="text-[10px] text-[#1B3F9B] bg-blue-100/70 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                          Bisa Dilengkapi Nanti
                        </span>
                      </span>
                      {showOptionalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showOptionalFields && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <div>
                          <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Nama PIC Lengkap</label>
                          <input
                            type="text"
                            name="name"
                            autoComplete="name"
                            maxLength={120}
                            placeholder="Contoh: Budi Santoso"
                            value={authorizedPerson}
                            onChange={(e) => setAuthorizedPerson(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#1B3F9B] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">NPWP Perusahaan</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={20}
                            placeholder="01.234.567.8-012.000 (15/16 digit)"
                            value={npwp}
                            onChange={(e) => setNpwp(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#1B3F9B] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button in Siloam Navy */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1B3F9B] hover:bg-[#15337E] disabled:opacity-60 text-white font-siloam font-bold py-3 px-4 text-xs transition-colors shadow-lg shadow-[#1B3F9B]/25 cursor-pointer"
                    >
                      <span>Lanjut ke Langkah 2: Pilih Jenis Produk Dagang</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* STEP 2: PILIH JENIS PRODUK DAGANG (VISUAL & SEARCH-FIRST)*/}
              {/* ======================================================== */}
              {step === 'product_category' && (
                <div className="space-y-4">
                  {/* HERO PRODUCT SEARCH IN SILOAM NAVY TONE */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-siloam font-bold text-[#0B2361] dark:text-blue-300 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-[#E5A823]" />
                        <span>Cari Cepat Berdasarkan Nama Produk Dagang Anda:</span>
                      </label>
                      <span className="text-[10px] bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold border border-[#1B3F9B]/20">
                        Pencari Pintar
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-blue-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ketik produk Anda, misal: jarum suntik, stetoskop, infus, bed pasien, reagen, kasur..."
                        className="w-full rounded-xl border border-blue-200 bg-white py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none dark:border-blue-900 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Search Suggestions */}
                    {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold text-[#0B2361] dark:text-blue-200">
                          Ditemukan di Katalog Master Siloam:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {searchResults.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-blue-200 bg-white p-2.5 flex flex-col justify-between gap-1.5 shadow-2xs dark:border-blue-900 dark:bg-slate-850"
                            >
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                  "{item.sku.commodityName}"
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {item.sku.generalSpec}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddCategoryFromSearch(item.suggestedCatId, item.sku.commodityName)}
                                className="w-full flex items-center justify-center gap-1 rounded-lg bg-[#1B3F9B] hover:bg-[#15337E] text-white font-semibold text-[10px] py-1 cursor-pointer transition-colors"
                              >
                                <Check className="h-3 w-3" />
                                <span>+ Tambahkan ke Ruang Lingkup Saya</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {addedItemNotification && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-800 text-[11px] flex items-center gap-1.5 font-medium dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                        <CheckCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{addedItemNotification}</span>
                      </div>
                    )}
                  </div>

                  {/* 5 RELATABLE VISUAL COMMODITY CARDS */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-siloam font-bold text-[#0B2361] dark:text-slate-200">
                        Atau Pilih 1 atau Beberapa Kategori Produk Anda:
                      </span>
                      <span className="text-[11px] text-[#1B3F9B] dark:text-blue-400 font-semibold">
                        {selectedCategoryIds.length} Kategori Dipilih
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {visualCategories.map((cat) => {
                        const isSelected = selectedCategoryIds.includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => handleToggleCategory(cat.id)}
                            className={`rounded-2xl border p-3.5 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'border-[#1B3F9B] bg-blue-50/70 shadow-sm ring-1 ring-[#1B3F9B] dark:bg-blue-950/40 dark:border-blue-500'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                                  isSelected
                                    ? 'bg-[#1B3F9B] text-white shadow-md shadow-[#1B3F9B]/20'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {cat.icon}
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-siloam font-bold ${isSelected ? 'text-[#0B2361] dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {cat.name}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium dark:bg-slate-800 dark:text-slate-400">
                                    {cat.badge}
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {cat.subtitle}
                                </p>

                                {/* Sample Tags */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  {cat.examples.slice(0, 3).map((ex, i) => (
                                    <span
                                      key={i}
                                      className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                    >
                                      {ex}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Checkbox indicator */}
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-lg shrink-0 mt-0.5 transition-colors ${
                                isSelected
                                  ? 'bg-[#1B3F9B] text-white'
                                  : 'border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800'
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary & Enter Button in Siloam Navy */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('profile')}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer order-2 sm:order-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Kembali ke Kontak</span>
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end order-1 sm:order-2">
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        Menampilkan <strong className="text-slate-900 dark:text-white">{matchingSkusCount} SKU</strong> Siloam
                      </span>

                      <button
                        type="button"
                        onClick={handleFinishAndEnterMatrix}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1B3F9B] hover:bg-[#15337E] text-white font-siloam text-xs font-bold transition-all shadow-lg shadow-[#1B3F9B]/25 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Mulai Isi Penawaran Harga</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 3. CORPORATE FOOTER (SILOAM HOSPITALS CLEAN STYLING) */}
      <footer className="relative z-20 w-full border-t border-slate-200/90 bg-white/90 backdrop-blur-md py-4 px-4 sm:px-8 text-xs text-slate-500 dark:border-slate-800 dark:bg-[#071536]/90 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={OFFICIAL_SILOAM_LOGO_URL}
              alt="Siloam Hospitals"
              className="h-6 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <span>·</span>
            <span className="font-siloam font-bold text-[#0B2361] dark:text-slate-200">
              Procurement & Supply Chain Management
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Standar SKU Nasional 4 Bagian</span>
            <span>·</span>
            <span>Coverage {hospitalCount ?? '…'} Unit Rumah Sakit</span>
            <span>·</span>
            <button
              onClick={onNavigateAdmin}
              className="text-[#1B3F9B] hover:underline cursor-pointer dark:text-blue-400 font-semibold"
            >
              Akses Staf Internal (/admin)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
