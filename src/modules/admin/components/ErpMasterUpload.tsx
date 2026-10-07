import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MasterSku } from '../types';
import { saveMasterSkus } from '../../../core/api/catalog';
import { ErpIssue, importInChunks, parseErpWorkbook } from '../erpParser';
import { Button } from '../../../core/ui/Button';
import { Modal } from '../../../core/ui/Modal';
import {
  Upload,
  FileSpreadsheet,
  Check,
  Download,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface ErpMasterUploadProps {
  onUploadSuccess: () => void;
}

export const ErpMasterUpload: React.FC<ErpMasterUploadProps> = ({ onUploadSuccess }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedSkus, setParsedSkus] = useState<MasterSku[]>([]);
  const [issues, setIssues] = useState<ErpIssue[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [progress, setProgress] = useState('');
  const [defaultOpenForVendor, setDefaultOpenForVendor] = useState(true);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState<number>(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination calculation for modal preview to handle huge ERP datasets smoothly
  const totalPreviewItems = parsedSkus.length;
  const totalPreviewPages = Math.max(1, Math.ceil(totalPreviewItems / previewPageSize));
  const activePreviewPage = Math.min(previewPage, totalPreviewPages);
  const previewStartIdx = (activePreviewPage - 1) * previewPageSize;
  const previewEndIdx = Math.min(previewStartIdx + previewPageSize, totalPreviewItems);
  const paginatedPreviewSkus = parsedSkus.slice(previewStartIdx, previewEndIdx);

  /**
   * Generates and downloads exact ERP Master SKU Excel template matching
   * the 20 columns from the ERP system.
   */
  const handleDownloadErpSample = () => {
    const sampleRows = [
      {
        'Product ID': '150603050186',
        'Name': 'SAUS',
        'Purch Category Lv 1': 'GENERAL SUPPLIES',
        'Purch Category Lv 2': 'KITCHEN SUPPLIES',
        'Purch Category Lv 3': 'FOOD SERVICE SUPPLIES',
        'Purch Category Lv 4': 'FOOD INGREDIENTS',
        'Document Type': 'pr',
        'Item Id': '490110027',
        'Fa Category': '',
        'Sp Item Id': '',
        'Unit of Measurement': 'pcs',
        'Is Generic Product': 'FALSE',
        'Brand': '3 TOMAT',
        'Specification 1': 'TOMAT',
        'Specification 2': '-',
        'Specification 3': '-',
        'Part Number': 'NP',
        'Standard Price': 20444,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '150603050213',
        'Name': 'SAUS TOMAT',
        'Purch Category Lv 1': 'GENERAL SUPPLIES',
        'Purch Category Lv 2': 'KITCHEN SUPPLIES',
        'Purch Category Lv 3': 'FOOD SERVICE SUPPLIES',
        'Purch Category Lv 4': 'FOOD INGREDIENTS',
        'Document Type': 'pr',
        'Item Id': '490110027',
        'Fa Category': '',
        'Sp Item Id': '',
        'Unit of Measurement': 'pcs',
        'Is Generic Product': 'FALSE',
        'Brand': 'ABC',
        'Specification 1': 'PACK',
        'Specification 2': '-',
        'Specification 3': '-',
        'Part Number': 'NP',
        'Standard Price': 10000,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '120502070634',
        'Name': 'NMES ACCESSORIES',
        'Purch Category Lv 1': 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Purch Category Lv 2': 'FACILITY & GENERAL MEDICAL EQUIPMENT',
        'Purch Category Lv 3': 'GENERAL MEDICAL EQUIPMENT',
        'Purch Category Lv 4': 'EQUIPMENT PARTS & ACCESSORIES',
        'Document Type': 'pr',
        'Item Id': '480110020',
        'Fa Category': '',
        'Sp Item Id': '',
        'Unit of Measurement': 'pcs1',
        'Is Generic Product': 'TRUE',
        'Brand': 'NB',
        'Specification 1': 'BUTTERFLY ELECTRODES',
        'Specification 2': '',
        'Specification 3': '',
        'Part Number': 'NP',
        'Standard Price': 1,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '170104030411',
        'Name': 'DOOR MOTOR',
        'Purch Category Lv 1': 'INFRASTRUCTURE & FACILITY MAINTENANCE',
        'Purch Category Lv 2': 'BUILDING MAINTENANCE',
        'Purch Category Lv 3': 'GENERAL BUILDING MAINTENANCE SERVICES',
        'Purch Category Lv 4': 'GENERAL BUILDING MAINTENANCE',
        'Document Type': 'pr',
        'Item Id': '480110001',
        'Fa Category': '',
        'Sp Item Id': '',
        'Unit of Measurement': 'unit',
        'Is Generic Product': 'FALSE',
        'Brand': 'NB',
        'Specification 1': 'STANDARD',
        'Specification 2': '',
        'Specification 3': '',
        'Part Number': 'NP',
        'Standard Price': 1,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '121107090637',
        'Name': 'INSTRUMENT TUR',
        'Purch Category Lv 1': 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Purch Category Lv 2': 'SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS',
        'Purch Category Lv 3': 'SURGICAL',
        'Purch Category Lv 4': 'SURGICAL HAND INSTRUMENTS',
        'Document Type': 'cpr',
        'Item Id': '710000019',
        'Fa Category': '720000010',
        'Sp Item Id': '',
        'Unit of Measurement': 'pcs1',
        'Is Generic Product': 'FALSE',
        'Brand': 'STORZ',
        'Specification 1': 'WORKING ELEMENT',
        'Specification 2': '',
        'Specification 3': 'MONOPOLAR (PASSIVE)',
        'Part Number': '27050E',
        'Standard Price': 1,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '120901040007',
        'Name': 'CT SCAN',
        'Purch Category Lv 1': 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Purch Category Lv 2': 'RADIOLOGY & RADIATION THERAPY',
        'Purch Category Lv 3': 'DIAGNOSTIC IMAGING SERVICES',
        'Purch Category Lv 4': 'TOMOGRAPHIC IMAGING',
        'Document Type': 'cpr',
        'Item Id': '710000017',
        'Fa Category': '720000010',
        'Sp Item Id': '',
        'Unit of Measurement': 'unit',
        'Is Generic Product': 'FALSE',
        'Brand': 'PHILIPS',
        'Specification 1': '-',
        'Specification 2': '',
        'Specification 3': '',
        'Part Number': 'NP',
        'Standard Price': 1,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '120502070635',
        'Name': 'KOMPRESOR CPAP',
        'Purch Category Lv 1': 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Purch Category Lv 2': 'FACILITY & GENERAL MEDICAL EQUIPMENT',
        'Purch Category Lv 3': 'GENERAL MEDICAL EQUIPMENT',
        'Purch Category Lv 4': 'EQUIPMENT PARTS & ACCESSORIES',
        'Document Type': 'cpr',
        'Item Id': '710000019',
        'Fa Category': '',
        'Sp Item Id': '',
        'Unit of Measurement': 'unit',
        'Is Generic Product': 'FALSE',
        'Brand': 'EKOM',
        'Specification 1': 'NEUROLOGY',
        'Specification 2': '',
        'Specification 3': '',
        'Part Number': 'NP',
        'Standard Price': 69795690,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
      {
        'Product ID': '140303010130',
        'Name': 'SOFA BED & DINNING TABLE',
        'Purch Category Lv 1': 'GENERAL EQUIPMENT',
        'Purch Category Lv 2': 'FURNITURE & FIXTURES',
        'Purch Category Lv 3': 'SUPPORT EQUIPMENT',
        'Purch Category Lv 4': 'FURNITURE & EQUIPMENT COMPONENTS',
        'Document Type': 'cpr',
        'Item Id': '710000008',
        'Fa Category': '',
        'Sp Item Id': '',
        'Unit of Measurement': 'unit',
        'Is Generic Product': 'TRUE',
        'Brand': 'NB',
        'Specification 1': 'STANDART',
        'Specification 2': '',
        'Specification 3': '',
        'Part Number': 'NP',
        'Standard Price': 14000000,
        'Is Active': 'TRUE',
        'Is Contract': 'FALSE',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);

    // Auto fit column widths
    ws['!cols'] = [
      { wch: 18 }, // Product ID
      { wch: 28 }, // Name
      { wch: 35 }, // Purch Category Lv 1
      { wch: 40 }, // Purch Category Lv 2
      { wch: 35 }, // Purch Category Lv 3
      { wch: 35 }, // Purch Category Lv 4
      { wch: 15 }, // Document Type
      { wch: 15 }, // Item Id
      { wch: 15 }, // Fa Category
      { wch: 12 }, // Sp Item Id
      { wch: 20 }, // Unit of Measurement
      { wch: 18 }, // Is Generic Product
      { wch: 18 }, // Brand
      { wch: 28 }, // Specification 1
      { wch: 20 }, // Specification 2
      { wch: 28 }, // Specification 3
      { wch: 18 }, // Part Number
      { wch: 18 }, // Standard Price
      { wch: 12 }, // Is Active
      { wch: 12 }, // Is Contract
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ERP_Master_SKU');
    XLSX.writeFile(wb, 'ERP_Master_Data_Export.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const parsed = parseErpWorkbook(await file.arrayBuffer(), defaultOpenForVendor);
      if (parsed.rowCount === 0) {
        alert('File Excel kosong atau tidak memiliki data.');
        return;
      }
      setParsedSkus(parsed.skus);
      setIssues(parsed.issues);
      setRowCount(parsed.rowCount);
      setPreviewPage(1);
      setIsPreviewOpen(true);
    } catch (err: any) {
      alert('Gagal membaca file ERP: ' + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle open status for an item in preview
  const handleToggleItemOpen = (index: number) => {
    setParsedSkus((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], isOpenForVendor: !next[index].isOpenForVendor };
      return next;
    });
  };

  // Bulk toggle open status in preview
  const handleSetAllOpen = (isOpen: boolean) => {
    setParsedSkus((prev) => prev.map((s) => ({ ...s, isOpenForVendor: isOpen })));
  };

  const handleConfirmImport = async () => {
    if (parsedSkus.length === 0) return;
    setIsProcessing(true);
    let done = 0;
    try {
      const saved = await importInChunks(parsedSkus, saveMasterSkus, (n, total) => {
        done = n;
        setProgress(`${n.toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')} SKU tersimpan`);
      });
      setIsPreviewOpen(false);
      onUploadSuccess();
      alert(
        `Berhasil mengimpor ${saved.toLocaleString('id-ID')} dari ${rowCount.toLocaleString('id-ID')} baris ERP.` +
          (issues.length > 0 ? ` ${issues.length} baris ditolak, perbaiki lalu unggah ulang.` : ''),
      );
    } catch (err: any) {
      alert(`Gagal mengimpor ke database setelah ${done} SKU tersimpan: ${err.message}. Unggah ulang aman, SKU yang sama akan diperbarui.`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  // Unique categories detected in uploaded file
  const categoriesDetected = Array.from(new Set(parsedSkus.map((s) => s.level1)));
  const openCount = parsedSkus.filter((s) => s.isOpenForVendor).length;

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-2xs transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Integrasi & Upload Master Data SKU dari ERP</span>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            Unggah File Excel Master SKU ERP (20 Kolom Standar)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
            Sistem otomatis memetakan <strong>Product ID</strong>, <strong>Name</strong>, <strong>Purch Category Lv 1-4</strong>, <strong>Specification 1-3</strong>, <strong>Brand</strong>, <strong>Part Number</strong>, dan <strong>Standard Price</strong> menjadi basis data SKU untuk diisi oleh vendor.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadErpSample}
            icon={<Download className="h-3.5 w-3.5 text-blue-600" />}
            className="text-xs h-8"
          >
            Format Contoh ERP (.xlsx)
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isProcessing}
            icon={<Upload className="h-3.5 w-3.5" />}
            className="text-xs h-8 font-semibold shadow-xs"
          >
            Upload File ERP
          </Button>
        </div>
      </div>

      {/* Live Preview Modal before committing to database */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Live Validator & Konfirmasi Impor Master Data ERP"
        subtitle={`Ditemukan ${parsedSkus.length} SKU dari ${categoriesDetected.length} Kategori Purch Level 1`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Total Item Terbaca</span>
              <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">
                {parsedSkus.length} SKU
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400">
                Dari file Excel ERP
              </span>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 dark:border-purple-900/50 dark:bg-purple-950/30">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">Kategori Level 1</span>
              <div className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-0.5">
                {categoriesDetected.length} Kategori
              </div>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 truncate block">
                {categoriesDetected.slice(0, 2).join(', ')}...
              </span>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Diizinkan Diisi Vendor</span>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-0.5">
                {openCount} / {parsedSkus.length}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Status terbuka untuk rekanan
              </span>
            </div>
          </div>

          {issues.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4" />
                {issues.length} dari {rowCount} baris ditolak dan tidak akan diimpor. Perbaiki di Excel lalu unggah ulang.
              </div>
              <ul className="mt-2 max-h-32 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                {issues.slice(0, 200).map((issue) => (
                  <li key={issue.row}>Baris {issue.row}: {issue.reason}</li>
                ))}
                {issues.length > 200 && <li>… {issues.length - 200} baris lain</li>}
              </ul>
            </div>
          )}

          {/* Quick Filter & Toggle Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Pengaturan Hak Akses Vendor pada SKU yang Diimpor:
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetAllOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 dark:bg-slate-750 dark:border-emerald-800 dark:text-emerald-300"
              >
                <Unlock className="h-3 w-3" /> Buka Semua ({parsedSkus.length})
              </button>

              <button
                type="button"
                onClick={() => handleSetAllOpen(false)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-white text-amber-700 border border-amber-300 hover:bg-amber-50 dark:bg-slate-750 dark:border-amber-800 dark:text-amber-300"
              >
                <Lock className="h-3 w-3" /> Kunci Semua (0)
              </button>
            </div>
          </div>

          {/* Pagination Toolbar for Upload Preview Modal */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Per halaman:</span>
              <select
                value={previewPageSize}
                onChange={(e) => {
                  setPreviewPageSize(Number(e.target.value));
                  setPreviewPage(1);
                }}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
                <option value={100}>100 baris</option>
              </select>
              <span>|</span>
              <span>
                Menampilkan <strong>{totalPreviewItems > 0 ? previewStartIdx + 1 : 0}-{previewEndIdx}</strong> dari <strong>{totalPreviewItems}</strong> SKU
              </span>
            </div>

            {totalPreviewPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewPage(1)}
                  disabled={activePreviewPage === 1}
                  className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={activePreviewPage === 1}
                  className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 flex items-center gap-0.5 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="px-2 py-0.5 font-bold text-xs bg-slate-100 dark:bg-slate-800 rounded">
                  {activePreviewPage} / {totalPreviewPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                  disabled={activePreviewPage >= totalPreviewPages}
                  className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 flex items-center gap-0.5 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPage(totalPreviewPages)}
                  disabled={activePreviewPage >= totalPreviewPages}
                  className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700 max-h-80">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white sticky top-0 text-[11px] select-none z-10">
                <tr>
                  <th className="px-2.5 py-2 text-center w-10">#</th>
                  <th className="px-2.5 py-2 w-32">Product ID (ERP)</th>
                  <th className="px-3 py-2 min-w-[180px]">Name (Komoditas)</th>
                  <th className="px-3 py-2 min-w-[200px]">Purch Category (Lv 1 & 2)</th>
                  <th className="px-3 py-2 min-w-[200px]">Spesifikasi (Spec 1-3)</th>
                  <th className="px-2.5 py-2 w-24">Brand</th>
                  <th className="px-2.5 py-2 w-24">Part Number</th>
                  <th className="px-2 py-2 text-center w-16">UoM</th>
                  <th className="px-2.5 py-2 text-right w-28">Standard Price</th>
                  <th className="px-2.5 py-2 text-center w-24">Is Active</th>
                  <th className="px-2.5 py-2 text-center w-28">Buka Vendor?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedPreviewSkus.map((item, pageIdx) => {
                  const actualIdx = previewStartIdx + pageIdx;
                  const isItemActive = item.isActive !== false && item.status !== 'archived';
                  return (
                    <tr
                      key={actualIdx}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-850/60 ${
                        !isItemActive
                          ? 'bg-rose-50/20 dark:bg-rose-950/10 text-slate-500'
                          : item.isOpenForVendor
                          ? ''
                          : 'bg-slate-50/50 dark:bg-slate-900/40 text-slate-400'
                      }`}
                    >
                      <td className="px-2.5 py-2 text-center text-slate-400">{actualIdx + 1}</td>
                      <td className="px-2.5 py-2 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {item.erpCode}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                        {item.commodityName}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.level1}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.level2} › {item.level3}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[220px]">
                        {item.generalSpec}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {item.defaultBrand || '-'}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {item.defaultPartNumber || '-'}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-700 dark:text-slate-300">
                        {item.uom}
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap">
                        {item.benchmarkPrice ? `Rp ${item.benchmarkPrice.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        {isItemActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            TRUE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            FALSE
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.isOpenForVendor}
                          onChange={() => handleToggleItemOpen(actualIdx)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              {progress || '* Data yang diimpor akan menjadi basis SKU untuk pengisian harga rekanan vendor.'}
            </span>

            <div className="flex items-center gap-2">
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
                isLoading={isProcessing}
                onClick={handleConfirmImport}
                icon={<Check className="h-4 w-4" />}
                className="font-semibold shadow-xs"
              >
                Konfirmasi & Impor {parsedSkus.length} SKU ke Database
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
