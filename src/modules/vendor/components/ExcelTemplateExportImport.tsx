import React, { useState, useRef, useMemo } from 'react';
import { MasterSku, VendorProfile, VendorPriceSubmission } from '../types';
import { vendorService } from '../services/vendorService';
import { Button } from '../../../core/ui/Button';
import { Modal } from '../../../core/ui/Modal';
import { Badge } from '../../../core/ui/Badge';
import { Download, Upload, Check, AlertTriangle, Filter, CheckCircle2 } from 'lucide-react';

interface ExcelTemplateExportImportProps {
  masterSkus: MasterSku[];
  vendor: VendorProfile;
  onBulkSuccess: (items: VendorPriceSubmission[]) => Promise<void>;
  activeCategory?: string;
}

export const ExcelTemplateExportImport: React.FC<ExcelTemplateExportImportProps> = ({
  masterSkus,
  vendor,
  onBulkSuccess,
  activeCategory,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validItems, setValidItems] = useState<VendorPriceSubmission[]>([]);
  const [errors, setErrors] = useState<{ row: number; reason: string; rawRow: any }[]>([]);
  const [exportCategory, setExportCategory] = useState<string>(activeCategory || 'ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available categories for pre-filtered download
  const categoryOptions = useMemo(() => {
    return Array.from(new Set(masterSkus.filter((s) => s.isOpenForVendor).map((s) => s.level1))).filter(Boolean);
  }, [masterSkus]);

  const handleDownloadTemplate = () => {
    vendorService.exportExcelTemplate(masterSkus, exportCategory);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await vendorService.parseExcelPriceList(buffer, masterSkus, vendor);
      setValidItems(result.validItems);
      setErrors(result.errors);
      setIsPreviewOpen(true);
    } catch (err: any) {
      alert('Gagal membaca file Excel. Pastikan format file .xlsx atau .xls valid: ' + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = async () => {
    if (validItems.length === 0) return;
    setIsProcessing(true);
    try {
      await onBulkSuccess(validItems);
      setIsPreviewOpen(false);
    } catch (err: any) {
      alert('Gagal menyimpan penawaran: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Download Template Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          icon={<Download className="h-3.5 w-3.5 text-emerald-600" />}
          className="border-slate-300 dark:border-slate-700 text-xs h-8 px-2.5"
        >
          Template Excel
        </Button>

        {/* Upload Excel Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
          id="vendor-excel-upload"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          isLoading={isProcessing}
          icon={<Upload className="h-3.5 w-3.5" />}
          className="text-xs h-8 px-2.5"
        >
          Import Excel
        </Button>
      </div>

      {/* Live Grid Validator Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Live Grid Validator: Hasil Pembacaan File Excel"
        subtitle={`Ditemukan ${validItems.length} baris valid dan ${errors.length} baris ditolak/tidak sesuai`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Summary stats & parity banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>Baris Lolos Validasi ({validItems.length} Item)</span>
              </div>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Item berhasil dipetakan ke Master SKU beserta kalkulasi otomatis Price List, Diskon, dan Nett Price.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Baris Ditolak / Perlu Perbaikan ({errors.length} Item)</span>
              </div>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Baris dilewati karena nama item tidak dikenali di katalog atau harga kosong.
              </p>
            </div>
          </div>

          {/* Errors list if any */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/20 max-h-36 overflow-y-auto">
              <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Detail Baris Error:</span>
              </div>
              <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
                {errors.map((err, i) => (
                  <li key={i} className="font-mono text-[11px]">
                    Baris {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Valid Items Table with live color indicators */}
          {validItems.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white sticky top-0 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Item Name (RS)</th>
                    <th className="px-3 py-2">Brand Vendor</th>
                    <th className="px-3 py-2">Model/PartNumber</th>
                    <th className="px-3 py-2 text-right">Price list (EXCL. VAT)</th>
                    <th className="px-3 py-2 text-center">Disc (%)</th>
                    <th className="px-3 py-2 text-right">Nett Price (EXCL. VAT)</th>
                    <th className="px-3 py-2">Coverage RS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {validItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded dark:bg-emerald-950 dark:text-emerald-300">
                          <Check className="h-3 w-3" /> Valid
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900 dark:text-white max-w-[200px] truncate">
                          {item.commodityName}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {item.vendorBrand}
                      </td>
                      <td className="px-3 py-2 font-mono text-purple-700 dark:text-purple-400 whitespace-nowrap">
                        {item.vendorPartNumber || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        Rp {item.priceListExcludeVat.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-nums whitespace-nowrap">
                        {item.discountPercent}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                        Rp {item.nettPriceExcludeVat.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
                        {item.installedHospitals && item.installedHospitals.length > 0
                          ? `${item.installedHospitals.length} RS Terpilih`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Tidak ada baris valid yang ditemukan dalam file yang diunggah.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={validItems.length === 0}
              isLoading={isProcessing}
              onClick={handleConfirmUpload}
              icon={<Check className="h-4 w-4" />}
            >
              Terapkan {validItems.length} Penawaran ke Matriks Sourcing
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
