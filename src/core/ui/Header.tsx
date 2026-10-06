import React from 'react';
import { Sun, Moon, ShoppingBag, Building, HelpCircle, LogOut, KeyRound } from 'lucide-react';
import { SiloamLogo } from './SiloamLogo';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  vendorName?: string;
  vendorStatus?: 'prospect' | 'identified' | 'verified';
  onOpenQuickGuide?: () => void;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDark,
  onToggleTheme,
  vendorName = 'PT Medika Farma',
  vendorStatus,
  onOpenQuickGuide,
  onLogout,
  onOpenChangePassword,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-[#071536]/95">
      <div className="w-full flex h-16 items-center justify-between px-3 sm:px-5 lg:px-6">
        {/* Zone 1: Official Siloam Logo & Wordmark */}
        <div className="flex items-center gap-3">
          <SiloamLogo size="sm" variant="full" />
          <span className="hidden lg:inline-flex items-center gap-1 rounded-full bg-[#1B3F9B]/10 px-2.5 py-0.5 text-[10px] font-siloam font-bold text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 border border-[#1B3F9B]/20 ml-1">
            <ShoppingBag className="h-3 w-3 text-[#E5A823]" />
            Portal Rekanan
          </span>
        </div>

        {/* Zone 2: Large Company Name & Ribbon Action Controls (No 'vendor aktif' field!) */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          {/* Prominent Company Name (Bigger & Cleaner Typography) */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1B3F9B]/10 text-[#1B3F9B] dark:bg-blue-900/40 dark:text-blue-300 shrink-0 shadow-2xs">
              <Building className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base md:text-lg font-siloam font-extrabold text-[#0B2361] dark:text-white leading-tight">
                  {vendorName}
                </span>
                {vendorStatus === 'verified' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hidden sm:inline">
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hidden sm:inline">
                    Calon Rekanan
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="h-7 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* Atur / Ganti Password Button */}
          {onOpenChangePassword && (
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors shadow-2xs text-xs font-semibold cursor-pointer"
              title="Buat atau perbarui password akun portal rekanan Anda"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400" />
              <span>Ganti Password</span>
            </button>
          )}

          {/* Quick Help Icon '?' Popup Trigger */}
          {onOpenQuickGuide && (
            <button
              type="button"
              onClick={onOpenQuickGuide}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 hover:border-blue-300 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 transition-colors shadow-2xs text-xs font-semibold cursor-pointer"
              title="Klik untuk membuka Panduan 3 Langkah Pengisian Harga"
            >
              <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden lg:inline">Panduan (?)</span>
            </button>
          )}

          {/* Theme switch */}
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 focus:outline-none dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
            aria-label="Ganti mode tampilan"
          >
            {isDark ? <Sun className="h-4 w-4 text-[#E5A823]" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Vendor Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 transition-colors shadow-2xs cursor-pointer"
              title="Keluar dari sesi akun rekanan (Logout)"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
