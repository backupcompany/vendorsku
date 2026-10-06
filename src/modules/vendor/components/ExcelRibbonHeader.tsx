import React, { useState } from 'react';
import { VendorProfile, MasterSku, VendorPriceSubmission } from '../../../core/types';
import { ExcelTemplateExportImport } from './ExcelTemplateExportImport';
import {
  TableProperties,
  ClipboardList,
  Sparkles,
  SlidersHorizontal,
  Eye,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Layers,
  FileSpreadsheet,
  Check,
  RefreshCw
} from 'lucide-react';

interface ExcelRibbonHeaderProps {
  vendor: VendorProfile;
  allVendors: VendorProfile[];
  onSelectVendor: (id: string) => void;
  activeTab: 'matrix' | 'submissions';
  onSelectTab: (tab: 'matrix' | 'submissions') => void;
  submissionsCount: number;
  totalVisibleSkus: number;
  totalAllSkus: number;
  onOpenScopeModal: () => void;
  onOpenAiMatcher: () => void;
  bypassScopeFilter: boolean;
  onToggleBypassScope: () => void;
  onLogoutOrChangeCompany?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigateAdmin: () => void;
  masterSkus: MasterSku[];
  onBulkSave: (submissions: VendorPriceSubmission[]) => Promise<void>;
}

const OFFICIAL_SILOAM_LOGO_URL = 'https://www.siloamhospitals.com/assets/logo-new-DU4qZWaH.png';

export const ExcelRibbonHeader: React.FC<ExcelRibbonHeaderProps> = ({
  vendor,
  allVendors,
  onSelectVendor,
  activeTab,
  onSelectTab,
  submissionsCount,
  totalVisibleSkus,
  totalAllSkus,
  onOpenScopeModal,
  onOpenAiMatcher,
  bypassScopeFilter,
  onToggleBypassScope,
  onLogoutOrChangeCompany,
  isDark,
  onToggleTheme,
  onNavigateAdmin,
  masterSkus,
  onBulkSave,
}) => {
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);

  const isProspect = vendor.status === 'prospect' || (!vendor.verified && !vendor.isExistingSupplier);
  const isVerified = vendor.status === 'verified' || vendor.verified;

  // Short scope title
  const scopeTitle = vendor.businessScope
    ? vendor.businessScope.level1.replace('DIAGNOSTIC AND MEDICAL DEVICES', 'Alkes & Diagnostik').replace('GENERAL SUPPLIES', 'Umum & BMHP')
    : 'Semua Kategori';

  return (
    <div className="sticky top-0 z-40 w-full shadow-xs">
      {/* ======================================================== */}
      {/* 1. EXCEL TITLE BAR (~36px) - ULTRA COMPACT SINGLE ROW    */}
      {/* ======================================================== */}
      <div className="bg-[#0B2361] dark:bg-[#071536] text-white px-3 sm:px-4 py-1.5 flex items-center justify-between border-b border-[#1B3F9B]/50 transition-colors">
        {/* Left: Siloam Logo + File Title + Auto-Save Status */}
        <div className="flex items-center gap-2.5">
          <img
            src={OFFICIAL_SILOAM_LOGO_URL}
            alt="Siloam Hospitals"
            className="h-6 sm:h-7 w-auto object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="h-4 w-px bg-white/20 hidden sm:block" />

          {/* Document Title styled like Excel Workbook */}
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-4 w-4 text-[#E5A823] shrink-0" />
            <span className="text-xs font-siloam font-bold text-white tracking-wide truncate max-w-[160px] sm:max-w-none">
              Sourcing_Matrix_2026.xlsx
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.2 rounded-full font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auto-Save Aktif
            </span>
          </div>
        </div>

        {/* Right: Vendor Account + Theme + Admin Link */}
        <div className="flex items-center gap-2">
          {/* Vendor Account Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsVendorDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs text-white border border-white/15 transition-colors cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5 text-[#E5A823]" />
              <span className="font-semibold text-xs truncate max-w-[110px] sm:max-w-[180px]">
                {vendor.companyName}
              </span>

              {isVerified ? (
                <span className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  Verified
                </span>
              ) : isProspect ? (
                <span className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-400/40">
                  Prospect
                </span>
              ) : null}

              <ChevronDown className="h-3 w-3 text-slate-300 ml-0.5" />
            </button>

            {/* Vendor Switcher Dropdown */}
            {isVendorDropdownOpen && (
              <div className="absolute right-0 mt-1 w-64 rounded-xl bg-white text-slate-900 shadow-xl border border-slate-200 p-2 z-50 dark:bg-slate-900 dark:text-white dark:border-slate-800 text-xs">
                <div className="px-2 py-1.5 font-bold text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-100 dark:border-slate-800">
                  Ganti Profil Rekanan
                </div>
                <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                  {allVendors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onSelectVendor(v.id);
                        setIsVendorDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        v.id === vendor.id
                          ? 'bg-blue-50 text-[#1B3F9B] font-bold dark:bg-blue-950 dark:text-blue-300'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{v.companyName}</span>
                      {v.id === vendor.id && <Check className="h-3.5 w-3.5 text-[#1B3F9B] shrink-0" />}
                    </button>
                  ))}
                </div>

                <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVendorDropdownOpen(false);
                      if (onLogoutOrChangeCompany) onLogoutOrChangeCompany();
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 text-xs font-semibold cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Keluar / Ganti Perusahaan Lain</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
            aria-label="Ganti mode tampilan"
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-[#E5A823]" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Staf Internal Siloam /admin */}
          <button
            type="button"
            onClick={onNavigateAdmin}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-[#1B3F9B] hover:bg-[#15337E] px-2 py-1 text-[11px] font-semibold text-white transition-colors cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="h-3 w-3 text-blue-200" />
            <span className="font-siloam">/admin</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. EXCEL RIBBON TABS BAR (~38px) - SEAMLESS UNIFIED BAR  */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-1 flex items-center justify-between gap-2 overflow-x-auto">
        {/* Left Side: Excel Sheet Tabs (Matriks Harga, Riwayat, Scope, AI) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Tab 1: Sheet Matriks Harga */}
          <button
            type="button"
            onClick={() => onSelectTab('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer border-b-2 ${
              activeTab === 'matrix'
                ? 'bg-blue-50/80 text-[#1B3F9B] border-[#1B3F9B] font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-400'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <TableProperties className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400" />
            <span>1. Matriks Penawaran</span>
          </button>

          {/* Tab 2: Sheet Riwayat Penawaran */}
          <button
            type="button"
            onClick={() => onSelectTab('submissions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer border-b-2 ${
              activeTab === 'submissions'
                ? 'bg-blue-50/80 text-[#1B3F9B] border-[#1B3F9B] font-bold dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-400'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>2. Riwayat ({submissionsCount})</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Action 3: AI Smart Matcher Tab */}
          <button
            type="button"
            onClick={onOpenAiMatcher}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>AI Matcher</span>
          </button>

          {/* Action 4: Ruang Lingkup Bisnis */}
          <button
            type="button"
            onClick={onOpenScopeModal}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Ubah Ruang Lingkup Komoditas"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#E5A823]" />
            <span className="truncate max-w-[150px]">{scopeTitle}</span>
          </button>

          {/* Scope Slicer Toggle */}
          {vendor.businessScope && (
            <button
              type="button"
              onClick={onToggleBypassScope}
              className={`hidden lg:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                bypassScopeFilter
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>
                {bypassScopeFilter
                  ? `Semua SKU (${totalAllSkus})`
                  : `Scope Anda (${totalVisibleSkus} SKU)`}
              </span>
            </button>
          )}
        </div>

        {/* Right Side: Excel Quick Tools (Export/Import) */}
        <div className="flex items-center gap-2 shrink-0">
          <ExcelTemplateExportImport
            masterSkus={masterSkus}
            vendor={vendor}
            onBulkSuccess={onBulkSave}
          />
        </div>
      </div>
    </div>
  );
};
