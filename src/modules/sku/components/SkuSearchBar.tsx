import React from 'react';
import { Search, X } from 'lucide-react';
import { useOptions } from '../../../core/api/options';

interface SkuSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  isOpenOnly: boolean;
  onToggleOpenOnly: (openOnly: boolean) => void;
  showOpenToggle?: boolean;
  activeStatus?: 'all' | 'active' | 'inactive';
  onActiveStatusChange?: (status: 'all' | 'active' | 'inactive') => void;
}

export const SkuSearchBar: React.FC<SkuSearchBarProps> = ({
  value,
  onChange,
  isOpenOnly,
  onToggleOpenOnly,
  showOpenToggle = true,
  activeStatus = 'all',
  onActiveStatusChange,
}) => {
  const quickTags = useOptions('sku_quick_search');

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Cari SKU: nama komoditas, spek umum, ERP code (contoh: 190401010002, sarung tangan, stetoskop)..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
          />
          {value && (
            <button
              onClick={() => onChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter ERP Active Status (Kolom 'Is Active') */}
        {onActiveStatusChange && (
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 shrink-0">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Status ERP:</span>
            <select
              value={activeStatus}
              onChange={(e) => onActiveStatusChange(e.target.value as any)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-none px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Status ERP</option>
              <option value="active">Hanya Aktif (Active)</option>
              <option value="inactive">Hanya Deactive (Nonaktif)</option>
            </select>
          </div>
        )}

        {/* Toggle Open For Vendor */}
        {showOpenToggle && (
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shrink-0">
            <input
              type="checkbox"
              checked={isOpenOnly}
              onChange={(e) => onToggleOpenOnly(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
            <span>Hanya SKU Terbuka untuk Vendor</span>
          </label>
        )}
      </div>

      {/* Quick Search Tag Suggestions */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">Pencarian Cepat:</span>
        {quickTags.map((tag) => (
          <button
            key={tag.value}
            type="button"
            onClick={() => onChange(tag.value)}
            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
};
