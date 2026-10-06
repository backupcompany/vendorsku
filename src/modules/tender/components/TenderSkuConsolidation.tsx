import React, { useState, useMemo, useEffect } from 'react';
import { SkuTenderComparison } from '../services/tenderService';
import { Badge } from '../../../core/ui/Badge';
import { Button } from '../../../core/ui/Button';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trophy,
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface TenderSkuConsolidationProps {
  comparisons: SkuTenderComparison[];
  onOpenAiReview: (comparison: SkuTenderComparison) => void;
}

export const TenderSkuConsolidation: React.FC<TenderSkuConsolidationProps> = ({
  comparisons,
  onOpenAiReview,
}) => {
  const [expandedSkuId, setExpandedSkuId] = useState<string | null>(null);

  // Pagination states to prevent DOM halt on thousands of comparisons
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const totalItems = comparisons.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems, pageSize]);

  const paginatedComparisons = useMemo(() => {
    return comparisons.slice(startIndex, endIndex);
  }, [comparisons, startIndex, endIndex]);

  const toggleExpand = (skuId: string) => {
    setExpandedSkuId((prev) => (prev === skuId ? null : skuId));
  };

  if (comparisons.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Tidak ada data SKU yang sesuai dengan filter.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pagination Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span>Tampilkan per halaman:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value={15}>15 SKU</option>
            <option value={25}>25 SKU</option>
            <option value={50}>50 SKU</option>
            <option value={100}>100 SKU</option>
          </select>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            Menampilkan <strong className="text-slate-900 dark:text-white font-bold">{totalItems > 0 ? startIndex + 1 : 0}-{endIndex}</strong> dari <strong className="text-slate-900 dark:text-white font-bold">{totalItems}</strong> SKU
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={activePage === 1}
              className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-xs flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
            </button>
            <span className="px-2 py-0.5 font-bold text-xs bg-slate-100 dark:bg-slate-800 rounded">
              {activePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage >= totalPages}
              className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-xs flex items-center gap-1 font-medium"
            >
              Berikutnya <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={activePage >= totalPages}
              className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Accordion Cards (paginated) */}
      {paginatedComparisons.map((item) => {
        const isExpanded = expandedSkuId === item.sku.id;

        return (
          <div
            key={item.sku.id}
            className="rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 overflow-hidden shadow-2xs"
          >
            {/* Header row */}
            <div
              onClick={() => toggleExpand(item.sku.id)}
              className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {item.sku.erpCode}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-xs text-slate-500 truncate">
                    {item.sku.level1} › {item.sku.level2}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {item.sku.commodityName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {item.sku.generalSpec}
                </p>
              </div>

              {/* Stats & Badge on the right */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  {item.submissionCount > 0 ? (
                    <div>
                      <div className="text-xs text-slate-400">Harga Terendah:</div>
                      <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        Rp {item.lowestPrice?.toLocaleString('id-ID')}
                      </div>
                      {item.savingVsHpsPercent ? (
                        <div className="text-[10px] text-emerald-600 font-medium">
                          Hemat {item.savingVsHpsPercent}% vs HPS
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Belum ada penawaran</div>
                  )}
                </div>

                {/* AI Document & Confidence indicator badge */}
                {item.submissions.some((s) => s.aiConfidenceLevel === 'low') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse" title="Terdapat penawaran dari upload dokumen dengan confidence level rendah yang memerlukan review admin">
                    <AlertTriangle className="h-3 w-3" />
                    Review AI
                  </span>
                )}
                {item.submissions.some((s) => s.aiConfidenceScore !== undefined && s.aiConfidenceLevel !== 'low') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" title="Penawaran diproses via AI Document Parser & Statistical Matcher">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    AI Match
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  <Badge variant={item.submissionCount > 0 ? 'info' : 'neutral'} size="sm">
                    {item.submissionCount} Vendor
                  </Badge>

                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Toggle rincian penawaran"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded Accordion: Side-by-side vendor quotes */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-850/50">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Rincian Penawaran Masuk ({item.submissionCount} Vendor):
                  </div>

                  {item.submissionCount > 0 && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenAiReview(item)}
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                    >
                      AI Evaluasi & Rekomendasi Pemenang
                    </Button>
                  )}
                </div>

                {item.submissionCount > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">Peringkat & Vendor</th>
                          <th className="px-3 py-2.5 font-semibold">Brand / Merk (Bagian 3)</th>
                          <th className="px-3 py-2.5 font-semibold">Part Number (Bagian 4)</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Harga Satuan (IDR)</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Harga + PPN</th>
                          <th className="px-3 py-2.5 font-semibold text-center">MOQ</th>
                          <th className="px-3 py-2.5 font-semibold text-center">Lead Time</th>
                          <th className="px-3 py-2.5 font-semibold">Izin Edar AKD/AKL</th>
                          <th className="px-3 py-2.5 font-semibold">Confidence AI & Pairing</th>
                          <th className="px-3 py-2.5 font-semibold">Negara Asal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {item.submissions.map((sub, index) => {
                          const isLowest = index === 0;

                          return (
                            <tr
                              key={sub.id}
                              className={`transition-colors ${
                                isLowest
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {isLowest && (
                                    <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  )}
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    #{index + 1} {sub.vendorName}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {sub.vendorEmail}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                {sub.vendorBrand}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-purple-700 dark:text-purple-400 whitespace-nowrap">
                                {sub.vendorPartNumber || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                Rp {sub.unitPrice.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                Rp {sub.priceWithTax.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums whitespace-nowrap">
                                {sub.moq} {sub.uom}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums whitespace-nowrap">
                                {sub.leadTimeDays} Hari
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {sub.kemenkesLicense ? (
                                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                                    {sub.kemenkesLicense}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {sub.aiConfidenceScore !== undefined ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          sub.aiConfidenceLevel === 'high'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                            : sub.aiConfidenceLevel === 'medium'
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-extrabold'
                                        }`}
                                      >
                                        {sub.aiConfidenceLevel === 'high' ? '🟢' : sub.aiConfidenceLevel === 'medium' ? '🟡' : '🔴'}{' '}
                                        {Math.round(sub.aiConfidenceScore * 100)}% ({sub.aiConfidenceLevel === 'high' ? 'Tinggi' : sub.aiConfidenceLevel === 'medium' ? 'Sedang' : 'Rendah'})
                                      </span>
                                      {sub.pairingStatus === 'vendor_confirmed' && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5" title="Vendor telah mengonfirmasi kesesuaian produk ini satu per satu">
                                          <CheckCircle2 className="h-3 w-3" /> Konfirmasi
                                        </span>
                                      )}
                                    </div>
                                    {sub.aiRawItemName && (
                                      <div
                                        className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[200px] truncate"
                                        title={`Item Dokumen Vendor: "${sub.aiRawItemName}" (${sub.aiRawDocumentSource || 'Upload Dokumen'})`}
                                      >
                                        <span className="font-medium text-slate-600 dark:text-slate-300">Asli:</span> {sub.aiRawItemName}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    ⚪ Manual Input
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {sub.countryOfOrigin || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Belum ada vendor yang mengirimkan penawaran harga untuk SKU ini.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
          <span>
            Halaman {activePage} dari {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage >= totalPages}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
