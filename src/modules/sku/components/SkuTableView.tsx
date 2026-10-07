import React from 'react';
import { MasterSku } from '../types';
import { Badge } from '../../../core/ui/Badge';
import { Button } from '../../../core/ui/Button';
import { PlusCircle, Lock } from 'lucide-react';

interface SkuTableViewProps {
  skus: MasterSku[];
  onSelectForPriceInput?: (sku: MasterSku) => void;
  onToggleOpen?: (id: string, isOpen: boolean) => void;
  showAdminControls?: boolean;
}

export const SkuTableView: React.FC<SkuTableViewProps> = ({
  skus,
  onSelectForPriceInput,
  onToggleOpen,
  showAdminControls = false,
}) => {
  if (skus.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Tidak ada data SKU yang cocok dengan filter atau pencarian Anda.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 font-semibold">Kode ERP</th>
            <th className="px-4 py-3 font-semibold">Taksonomi (L1 › L2 › L3)</th>
            <th className="px-4 py-3 font-semibold">Bagian 1: Nama Komoditas</th>
            <th className="px-4 py-3 font-semibold">Bagian 2: Spesifikasi Umum</th>
            <th className="px-4 py-3 font-semibold">Satuan (UoM)</th>
            <th className="px-4 py-3 font-semibold text-right">HPS</th>
            <th className="px-4 py-3 font-semibold text-center">Status Vendor</th>
            <th className="px-4 py-3 font-semibold text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {skus.map((sku) => (
            <tr
              key={sku.id}
              className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50"
            >
              <td className="px-4 py-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {sku.erpCode}
              </td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <div className="max-w-[180px] truncate" title={`${sku.level1} › ${sku.level2} › ${sku.level3}`}>
                  {sku.level1} › {sku.level2}
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[200px]">
                {sku.commodityName}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[250px] line-clamp-1">
                {sku.generalSpec}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {sku.uom}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                {sku.benchmarkPrice ? `Rp ${sku.benchmarkPrice.toLocaleString('id-ID')}` : '-'}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                {sku.isOpenForVendor ? (
                  <Badge variant="success" size="sm">
                    Terbuka
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    Terkunci
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {showAdminControls ? (
                  <button
                    onClick={() => onToggleOpen && onToggleOpen(sku.id, !sku.isOpenForVendor)}
                    className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                      sku.isOpenForVendor
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
                    }`}
                  >
                    {sku.isOpenForVendor ? 'Kunci' : 'Buka'}
                  </button>
                ) : sku.isOpenForVendor ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<PlusCircle className="h-3 w-3" />}
                    onClick={() => onSelectForPriceInput && onSelectForPriceInput(sku)}
                  >
                    Isi Harga
                  </Button>
                ) : (
                  <span className="text-slate-400 text-xs flex items-center justify-end gap-1">
                    <Lock className="h-3 w-3" /> Terkunci
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
