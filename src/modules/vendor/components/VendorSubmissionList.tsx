import React from 'react';
import { VendorPriceSubmission } from '../types';
import { Badge } from '../../../core/ui/Badge';
import { Button } from '../../../core/ui/Button';
import { Trash2, Edit2, Download, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface VendorSubmissionListProps {
  submissions: VendorPriceSubmission[];
  onEdit: (submission: VendorPriceSubmission) => void;
  onDelete: (id: string) => void;
}

export const VendorSubmissionList: React.FC<VendorSubmissionListProps> = ({
  submissions,
  onEdit,
  onDelete,
}) => {
  const handleExport = () => {
    const data = submissions.map((s) => ({
      'ERP Code': s.skuErpCode,
      'Nama Komoditas (Bagian 1)': s.commodityName,
      'Spesifikasi Umum (Bagian 2)': s.generalSpec,
      'Brand Vendor (Bagian 3)': s.vendorBrand,
      'Part Number (Bagian 4)': s.vendorPartNumber,
      'Nama SKU Lengkap Siloam': s.fullFormattedSkuName,
      'Price List EXCL. VAT': s.priceListExcludeVat || s.unitPrice,
      'Discount (%)': s.discountPercent || 0,
      'Nett Price EXCL. VAT': s.nettPriceExcludeVat || s.unitPrice,
      'Harga Satuan + PPN (IDR)': s.priceWithTax,
      'Coverage Rumah Sakit': s.installedHospitals?.join(', ') || 'Seluruh RS Siloam',
      'Satuan UoM': s.uom,
      'MOQ': s.moq,
      'Lead Time (Hari)': s.leadTimeDays,
      'Masa Berlaku': s.priceValidUntil,
      'Izin Edar Kemenkes': s.kemenkesLicense || '-',
      'Negara Asal': s.countryOfOrigin || '-',
      'Status': s.status,
      'Tanggal Input': s.submittedAt,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar_Penawaran');
    XLSX.writeFile(wb, 'Siloam_Daftar_Penawaran_Vendor.xlsx');
  };

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm font-medium">Belum ada penawaran harga yang Anda daftarkan.</p>
        <p className="text-xs text-slate-400 mt-1">
          Pilih SKU yang terbuka pada katalog di atas, atau download template Excel untuk upload massal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Total Terdaftar: <span className="font-mono">{submissions.length}</span> Penawaran
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          Export Rekap Penawaran (.xlsx)
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300">
            <tr>
              <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
              <th className="px-3 py-3 font-semibold">Nama SKU Lengkap (4 Bagian)</th>
              <th className="px-3 py-3 font-semibold">Brand & REF</th>
              <th className="px-3 py-3 font-semibold text-right">Harga Satuan (IDR)</th>
              <th className="px-3 py-3 font-semibold text-right">Harga + PPN</th>
              <th className="px-3 py-3 font-semibold text-center">MOQ / Lead Time</th>
              <th className="px-3 py-3 font-semibold">Izin Edar KEMENKES</th>
              <th className="px-3 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {submissions.map((sub, idx) => (
              <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50">
                <td className="px-3 py-3 text-center text-[11px] text-slate-500 whitespace-nowrap">
                  {idx + 1}
                </td>
                <td className="px-3 py-3 max-w-[280px]">
                  <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-words">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      {sub.commodityName}
                    </span>{' '}
                    ; {sub.generalSpec} ;{' '}
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {sub.vendorBrand}
                    </span>{' '}
                    ;{' '}
                    <span className="font-mono text-purple-700 dark:text-purple-400">
                      {sub.vendorPartNumber || '-'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Satuan: {sub.uom} · Berlaku s/d: {sub.priceValidUntil}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {sub.vendorBrand}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {sub.vendorPartNumber || '-'}
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                  Rp {sub.unitPrice.toLocaleString('id-ID')}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  Rp {sub.priceWithTax.toLocaleString('id-ID')}
                </td>
                <td className="px-3 py-3 text-center font-mono tabular-nums whitespace-nowrap">
                  <span className="text-slate-700 dark:text-slate-300">{sub.moq} {sub.uom}</span>
                  <span className="text-slate-400 block text-[10px]">{sub.leadTimeDays} Hari Kerja</span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {sub.kemenkesLicense ? (
                    <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      {sub.kemenkesLicense}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(sub)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:text-slate-400"
                      title="Edit Penawaran"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus penawaran untuk ${sub.commodityName}?`)) {
                          onDelete(sub.id);
                        }
                      }}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:text-slate-400"
                      title="Hapus Penawaran"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
