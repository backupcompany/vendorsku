import React from 'react';
import { ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { TaxonomyFilters } from '../hooks/useMasterSku';

interface TaxonomyFilterTreeProps {
  filters: TaxonomyFilters;
  options: {
    level1Options: string[];
    level2Options: string[];
    level3Options: string[];
    level4Options: string[];
  };
  onFilterChange: (key: keyof TaxonomyFilters, value: any) => void;
  onClearFilters: () => void;
  totalFiltered: number;
  totalSkus: number;
}

export const TaxonomyFilterTree: React.FC<TaxonomyFilterTreeProps> = ({
  filters,
  options,
  onFilterChange,
  onClearFilters,
  totalFiltered,
  totalSkus,
}) => {
  const hasActiveFilters = Boolean(
    filters.level1 || filters.level2 || filters.level3 || filters.level4
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors dark:border-slate-800 dark:bg-slate-900">
      {/* Title & Count Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Filter Taksonomi Berjenjang (4 Level)
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Menampilkan <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{totalFiltered}</span> dari{' '}
            <span className="font-mono">{totalSkus}</span> SKU
          </span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Taksonomi</span>
          </button>
        )}
      </div>

      {/* Cascaded 4-Level Selectors Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Level 1: Kategori */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Level 1: Kategori Utama
          </label>
          <select
            value={filters.level1 || ''}
            onChange={(e) => onFilterChange('level1', e.target.value || undefined)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">Semua Kategori (Level 1)</option>
            {options.level1Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Level 2: Sub-Kategori */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Level 2: Sub-Kategori
          </label>
          <select
            value={filters.level2 || ''}
            onChange={(e) => onFilterChange('level2', e.target.value || undefined)}
            disabled={!filters.level1 && options.level2Options.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-850"
          >
            <option value="">Semua Sub-Kategori (Level 2)</option>
            {options.level2Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Level 3: Kelompok Produk */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Level 3: Kelompok Produk
          </label>
          <select
            value={filters.level3 || ''}
            onChange={(e) => onFilterChange('level3', e.target.value || undefined)}
            disabled={!filters.level2 && options.level3Options.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-850"
          >
            <option value="">Semua Kelompok Produk (Level 3)</option>
            {options.level3Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Level 4: Tipe Teknis */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Level 4: Tipe Teknis Spesifik
          </label>
          <select
            value={filters.level4 || ''}
            onChange={(e) => onFilterChange('level4', e.target.value || undefined)}
            disabled={!filters.level3 && options.level4Options.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-850"
          >
            <option value="">Semua Tipe Teknis (Level 4)</option>
            {options.level4Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Taxonomy Trail Breadcrumbs */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="font-semibold text-slate-500">Jalur Taksonomi:</span>
          {filters.level1 && (
            <span className="font-medium text-slate-800 dark:text-white">{filters.level1}</span>
          )}
          {filters.level2 && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-800 dark:text-white">{filters.level2}</span>
            </>
          )}
          {filters.level3 && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-800 dark:text-white">{filters.level3}</span>
            </>
          )}
          {filters.level4 && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-800 dark:text-white">{filters.level4}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
