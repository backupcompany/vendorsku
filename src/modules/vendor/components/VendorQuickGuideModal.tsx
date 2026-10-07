import React from 'react';
import { X, HelpCircle, CheckCircle2, TableProperties, Edit3, Save, Download } from 'lucide-react';

interface VendorQuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VendorQuickGuideModal: React.FC<VendorQuickGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-white space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header with Help icon */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-siloam font-bold text-[#0B2361] dark:text-white">
                Panduan Singkat 3 Langkah Pengisian Harga
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khusus Calon Rekanan & Distributor Resmi Grup Rumah Sakit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 3 Clear Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          {/* Step 1 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-2xs">
                1
              </span>
              <span className="font-siloam font-bold text-blue-950 dark:text-blue-200">
                Pilih Baris Produk
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              Telusuri item komoditas SKU yang sesuai dengan barang dagang Anda pada daftar SKU. Gunakan filter kategori atau kotak pencarian utama di bagian atas.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-2xs">
                2
              </span>
              <span className="font-siloam font-bold text-blue-950 dark:text-blue-200">
                Isi Merk & Harga
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              Ketik Brand/Merk Anda & Harga Satuan Nett (<em>Exclude VAT</em>) langsung pada sel spreadsheet tabel. Diskon dan PPN 11% terhitung otomatis.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-2xs">
                3
              </span>
              <span className="font-siloam font-bold text-blue-950 dark:text-blue-200">
                Simpan / Excel
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              Klik tombol <strong>Simpan Semua</strong> atau manfaatkan fitur <strong>Export / Import Excel</strong> untuk mengisi ratusan SKU secara massal sekaligus.
            </p>
          </div>
        </div>

        {/* Regulatory Notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-1.5 font-bold mb-0.5">
            <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Kualifikasi Dokumen Legalitas:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/90">
            Sebagai calon rekanan baru, Anda bebas mengisi penawaran harga. Unggah dokumen legalitas & rekening bank hanya diwajibkan saat penawaran Anda terpilih sebagai pemenang tender.
          </p>
        </div>

        {/* Footer Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1B3F9B] hover:bg-[#15337E] text-white text-xs font-siloam font-bold shadow-md shadow-[#1B3F9B]/20 transition-colors cursor-pointer"
          >
            Mengerti, Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
