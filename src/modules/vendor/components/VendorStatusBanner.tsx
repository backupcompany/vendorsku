import React from 'react';
import { VendorProfile, BusinessScope } from '../types';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  RefreshCw,
  Tag,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';

interface VendorStatusBannerProps {
  vendor: VendorProfile;
  onOpenScopeModal: () => void;
  onOpenIdentificationModal: () => void;
  totalVisibleSkus: number;
  totalAllSkus: number;
}

export const VendorStatusBanner: React.FC<VendorStatusBannerProps> = ({
  vendor,
  onOpenScopeModal,
  onOpenIdentificationModal,
  totalVisibleSkus,
  totalAllSkus,
}) => {
  const isProspect = vendor.status === 'prospect' || (!vendor.verified && !vendor.isExistingSupplier);
  const isVerified = vendor.status === 'verified' || vendor.verified;

  const scope = vendor.businessScope;

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3.5 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900 space-y-3">
      {/* Row 1: Profile, Status Progression, and Scope Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Vendor Name & Status Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-bold shrink-0">
            <Building2 className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {vendor.companyName}
              </span>

              {/* Status Badge */}
              {isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3" />
                  Existing Supplier (Terverifikasi)
                </span>
              ) : isProspect ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Clock className="h-3 w-3" />
                  Status: Prospect (Calon Supplier)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                  <ShieldCheck className="h-3 w-3" />
                  Status: Identified
                </span>
              )}

              {vendor.npwp && (
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                  NPWP: {vendor.npwp}
                </span>
              )}
            </div>

            {/* Subtitle / PIC details */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>PIC: {vendor.authorizedPerson || 'PIC Vendor'}</span>
              <span>·</span>
              <span>WA: {vendor.phone || '-'}</span>
              <span>·</span>
              <span>Email: {vendor.email || '-'}</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Scope & Re-identification Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenScopeModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50/70 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition-colors cursor-pointer shadow-2xs"
            title="Ubah ruang lingkup komoditas yang tampil di matriks penawaran Anda"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Ubah Scope Bisnis</span>
          </button>

          <button
            type="button"
            onClick={onOpenIdentificationModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs"
            title="Ganti atau identifikasi ulang identitas rekanan Anda"
          >
            <RefreshCw className="h-3 w-3 text-slate-500" />
            <span className="hidden sm:inline">Ganti Perusahaan</span>
          </button>
        </div>
      </div>

      {/* Row 2: Business Scope Tag & Qualification Guidance */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        {/* Active Business Scope Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-slate-500 text-[11px] font-semibold">
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>Scope Bisnis Aktif:</span>
          </span>

          {scope ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-bold text-[11px]">
                {scope.level1}
              </span>
              <span className="text-slate-400">›</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium text-[11px]">
                {scope.level2List.length} Sub-Kategori Terpilih
              </span>
              <span className="text-[11px] text-slate-500">
                ({totalVisibleSkus} dari {totalAllSkus} SKU komoditas terbuka)
              </span>
            </div>
          ) : (
            <span className="text-slate-500 italic text-[11px]">
              Belum ditentukan (Menampilkan semua komoditas terbuka)
            </span>
          )}
        </div>

        {/* Qualification notice for Prospect/New Suppliers */}
        {isProspect && (
          <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/50">
            <strong>Aturan Pengadaan:</strong> Anda bebas mengajukan penawaran harga. Kualifikasi dokumen legalitas hanya diwajibkan saat penetapan transaksi/kontrak pengadaan.
          </div>
        )}
      </div>
    </div>
  );
};
