import React from 'react';
import { MasterSku } from '../types';
import { Button } from '../../../core/ui/Button';
import { Badge } from '../../../core/ui/Badge';
import { PlusCircle, Lock, Layers } from 'lucide-react';

interface SkuCardProps {
  sku: MasterSku;
  onSelectForPriceInput?: (sku: MasterSku) => void;
  onToggleOpen?: (id: string, isOpen: boolean) => void;
  showAdminControls?: boolean;
  submissionCount?: number;
}

export const SkuCard: React.FC<SkuCardProps> = ({
  sku,
  onSelectForPriceInput,
  onToggleOpen,
  showAdminControls = false,
  submissionCount = 0,
}) => {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div>
        {/* Top bar: ERP code & status */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
            <span>{sku.erpCode}</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-500 font-sans font-normal text-xs">{sku.uom}</span>
          </div>

          <div>
            {sku.isOpenForVendor ? (
              <Badge variant="success" size="sm">
                Bisa Diisi Vendor
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Terkunci (Ditutup)
              </Badge>
            )}
          </div>
        </div>

        {/* 4-Level Taxonomy Line */}
        <div className="mb-2 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          <Layers className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate">
            {sku.level1} › {sku.level2} › {sku.level3}
          </span>
        </div>

        {/* Part 1: Commodity Name (Bagian 1) */}
        <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
          {sku.commodityName}
        </h3>

        {/* Part 2: General Specification (Bagian 2) */}
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
          {sku.generalSpec}
        </p>

        {/* 4-Part Structure Preview Pill */}
        <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-850 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
          <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Format Standar Penamaan SKU Siloam:
          </div>
          <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 leading-normal break-words">
            <span className="text-blue-700 dark:text-blue-300 font-medium">
              {sku.commodityName}
            </span>{' '}
            ;{' '}
            <span className="text-slate-600 dark:text-slate-400">
              {sku.generalSpec}
            </span>{' '}
            ;{' '}
            <span className="text-amber-700 dark:text-amber-400 italic">
              [Brand Vendor]
            </span>{' '}
            ;{' '}
            <span className="text-purple-700 dark:text-purple-400 italic">
              [Part / REF No]
            </span>
          </div>
        </div>

        {/* Benchmark / Submissions info */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {sku.benchmarkPrice ? (
            <div>
              <span>HPS Siloam: </span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                Rp {sku.benchmarkPrice.toLocaleString('id-ID')}
              </span>
            </div>
          ) : (
            <span />
          )}

          {submissionCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {submissionCount} Vendor Terdaftar
            </span>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        {showAdminControls ? (
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-slate-500">Izin Pengisian Vendor:</span>
            <button
              onClick={() => onToggleOpen && onToggleOpen(sku.id, !sku.isOpenForVendor)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                sku.isOpenForVendor
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
              }`}
            >
              {sku.isOpenForVendor ? 'Kunci SKU' : 'Buka untuk Vendor'}
            </button>
          </div>
        ) : (
          <>
            {sku.isOpenForVendor ? (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                icon={<PlusCircle className="h-3.5 w-3.5" />}
                onClick={() => onSelectForPriceInput && onSelectForPriceInput(sku)}
              >
                Daftarkan Harga & Brand
              </Button>
            ) : (
              <div className="w-full text-center py-1.5 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>SKU Ditutup untuk Penawaran Baru</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
