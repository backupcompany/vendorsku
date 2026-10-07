import React, { useState } from 'react';
import { useTenderView } from '../modules/tender/hooks/useTenderView';
import { SkuTenderComparison } from '../modules/tender/services/tenderService';
import { TenderSkuConsolidation } from '../modules/tender/components/TenderSkuConsolidation';
import { AiTenderReviewDrawer } from '../modules/tender/components/AiTenderReviewDrawer';
import { Button } from '../core/ui/Button';
import { Layers, Search, Download, CheckCircle, TrendingDown, Building } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useActiveHospitalCount } from '../core/api/options';

export const TenderEvaluationPage: React.FC = () => {
  const hospitalCount = useActiveHospitalCount();
  const {
    tenders,
    comparisons,
    allComparisons,
    isLoading,
    searchQuery,
    setSearchQuery,
    filterLevel1,
    setFilterLevel1,
    filterOnlyWithBids,
    setFilterOnlyWithBids,
    filterConfidence,
    setFilterConfidence,
    level1Options,
    totalBidsCount,
  } = useTenderView();

  const [selectedComparison, setSelectedComparison] = useState<SkuTenderComparison | null>(null);
  const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);

  const activeTender = tenders[0];

  const handleOpenAiReview = (item: SkuTenderComparison) => {
    setSelectedComparison(item);
    setIsAiReviewOpen(true);
  };

  const handleExportConsolidatedExcel = () => {
    const rows: any[] = [];
    allComparisons.forEach((item) => {
      if (item.submissions.length === 0) {
        rows.push({
          'Kode ERP': item.sku.erpCode,
          'Kategori (L1)': item.sku.level1,
          'Subkategori (L2)': item.sku.level2,
          'Kelompok (L3)': item.sku.level3,
          'Nama Komoditas (Bagian 1)': item.sku.commodityName,
          'Spesifikasi Umum (Bagian 2)': item.sku.generalSpec,
          'UoM': item.sku.uom,
          'HPS (IDR)': item.sku.benchmarkPrice || '',
          'Peringkat': 'Belum Ada Penawaran',
          'Nama Vendor': '-',
          'Brand Vendor (Bagian 3)': '-',
          'Part Number (Bagian 4)': '-',
          'Harga Satuan IDR': '-',
          'Harga + PPN': '-',
          'MOQ': '-',
          'Lead Time': '-',
          'Coverage Rumah Sakit': '-',
          'Izin AKD/AKL': '-',
        });
      } else {
        item.submissions.forEach((sub, idx) => {
          rows.push({
            'Kode ERP': item.sku.erpCode,
            'Kategori (L1)': item.sku.level1,
            'Subkategori (L2)': item.sku.level2,
            'Kelompok (L3)': item.sku.level3,
            'Nama Komoditas (Bagian 1)': item.sku.commodityName,
            'Spesifikasi Umum (Bagian 2)': item.sku.generalSpec,
            'UoM': item.sku.uom,
            'HPS (IDR)': item.sku.benchmarkPrice || '',
            'Peringkat': `Rank #${idx + 1} (${idx === 0 ? 'Terendah' : ''})`,
            'Nama Vendor': sub.vendorName,
            'Brand Vendor (Bagian 3)': sub.vendorBrand,
            'Part Number (Bagian 4)': sub.vendorPartNumber,
            'Harga Satuan IDR': sub.unitPrice,
            'Harga + PPN': sub.priceWithTax,
            'MOQ': `${sub.moq} ${sub.uom}`,
            'Lead Time': `${sub.leadTimeDays} Hari`,
            'Coverage Rumah Sakit': sub.installedHospitals?.join(', ') || 'Seluruh Unit RS',
            'Izin AKD/AKL': sub.kemenkesLicense || '-',
            'Confidence AI': sub.aiConfidenceScore !== undefined ? `${Math.round(sub.aiConfidenceScore * 100)}% (${sub.aiConfidenceLevel?.toUpperCase()})` : 'Manual',
            'Status Pairing': sub.pairingStatus || 'manual',
            'Item Dokumen Vendor': sub.aiRawItemName || '-',
            'File Dokumen': sub.aiRawDocumentSource || '-',
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Tender');
    XLSX.writeFile(wb, 'Rekapitulasi_Tender_PriceList.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Layers className="h-4 w-4" />
              <span>Komite Pengadaan & Evaluasi Tender Rumah Sakit</span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {activeTender?.title || 'Evaluasi Penawaran Harga SKU Tender'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Tinjau daftar seluruh SKU dalam bentuk taksonomi bertingkat. Bandingkan penawaran
              antar-vendor secara komprehensif (harga, spesifikasi, brand, lead time, MOQ, dan izin Kemenkes).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportConsolidatedExcel}
              icon={<Download className="h-4 w-4" />}
            >
              Export Rekap Komparasi (.xlsx)
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400">Penawaran Masuk:</span>
            <div className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
              {totalBidsCount} Penawaran
            </div>
          </div>
          <div>
            <span className="text-slate-400">Target Unit RS:</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {hospitalCount ?? '…'} Unit RS Nasional
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari SKU di tender: komoditas, spek umum, atau kode ERP..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Level 1 taxonomy filter & Confidence filter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterLevel1}
            onChange={(e) => setFilterLevel1(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Semua Kategori (Level 1)</option>
            {level1Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* AI Match Confidence Level Filter */}
          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Semua Tingkat Akurasi AI</option>
            <option value="high">🟢 Confidence Tinggi (≥80%)</option>
            <option value="medium">🟡 Confidence Sedang (50-79%)</option>
            <option value="low">🔴 Confidence Rendah (&lt;50% - Review)</option>
            <option value="manual">⚪ Input Manual</option>
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shrink-0">
            <input
              type="checkbox"
              checked={filterOnlyWithBids}
              onChange={(e) => setFilterOnlyWithBids(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
            />
            <span>Hanya yang Memiliki Penawaran</span>
          </label>
        </div>
      </div>

      {/* Tender SKU Consolidation View */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500">
          Memuat rekapitulasi penawaran tender...
        </div>
      ) : (
        <TenderSkuConsolidation
          comparisons={comparisons}
          onOpenAiReview={handleOpenAiReview}
        />
      )}

      {/* AI Tender Analysis Drawer */}
      <AiTenderReviewDrawer
        isOpen={isAiReviewOpen}
        onClose={() => setIsAiReviewOpen(false)}
        comparison={selectedComparison}
      />
    </div>
  );
};
