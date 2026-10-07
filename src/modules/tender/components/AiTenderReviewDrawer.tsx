import React, { useState, useEffect } from 'react';
import { SkuTenderComparison } from '../services/tenderService';
import { aiService } from '../../../core/services/ai/aiService';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { Sparkles, Trophy, CheckCircle, AlertTriangle, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

interface AiTenderReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: SkuTenderComparison | null;
}

export const AiTenderReviewDrawer: React.FC<AiTenderReviewDrawerProps> = ({
  isOpen,
  onClose,
  comparison,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{
    summary: string;
    recommendedVendorName?: string;
    keyStrengths: string[];
    riskWarnings: string[];
    savingPotentialPercent?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen && comparison) {
      setIsLoading(true);
      aiService
        .analyzeTenderSubmissions(comparison.sku, comparison.submissions)
        .then((data) => setAnalysis(data))
        .catch((err) => console.error(err))
        .finally(() => setIsLoading(false));
    } else {
      setAnalysis(null);
    }
  }, [isOpen, comparison]);

  if (!comparison) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit & Evaluasi Penawaran Tender (AI Procurement)"
      subtitle={`SKU: ${comparison.sku.commodityName} (${comparison.sku.erpCode})`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block animate-spin text-blue-600">
              <Sparkles className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Menganalisis matriks harga, MOQ, lead time, dan lisensi AKD/AKL...
            </p>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Top recommendation card */}
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 dark:border-blue-900 dark:from-blue-950/40 dark:to-indigo-950/20">
              <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-300 mb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Rekomendasi Pilihan Terbaik (Best Value)
                </span>
                {analysis.savingPotentialPercent ? (
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                    Potensi Hemat {analysis.savingPotentialPercent}%
                  </span>
                ) : null}
              </div>

              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {analysis.recommendedVendorName || comparison.submissions[0]?.vendorName}
              </h4>
              <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {analysis.summary}
              </p>
            </div>

            {/* Strengths */}
            {analysis.keyStrengths && analysis.keyStrengths.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <h5 className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Faktor Keunggulan Penawaran:
                </h5>
                <ul className="space-y-1 text-xs text-emerald-800 dark:text-emerald-300 list-disc list-inside">
                  {analysis.keyStrengths.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Warnings */}
            {analysis.riskWarnings && analysis.riskWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <h5 className="text-xs font-semibold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Poin Perhatian & Mitigasi Risiko:
                </h5>
                <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300 list-disc list-inside">
                  {analysis.riskWarnings.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Document & Confidence Level Audit for Admin Committee */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/20 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Audit Pairing Dokumen & Akurasi Statistik AI:
                </h5>
                <span className="text-[10px] font-medium text-slate-500">
                  {comparison.submissions.filter((s) => s.aiConfidenceScore !== undefined).length} dari {comparison.submissions.length} Penawaran Berbasis Dokumen
                </span>
              </div>

              <div className="space-y-2">
                {comparison.submissions.map((sub) => {
                  const hasAi = sub.aiConfidenceScore !== undefined;
                  const isLow = sub.aiConfidenceLevel === 'low';

                  return (
                    <div
                      key={sub.id}
                      className={`p-2.5 rounded-lg border bg-white dark:bg-slate-900 transition-colors ${
                        isLow
                          ? 'border-rose-300 dark:border-rose-800 bg-rose-50/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {sub.vendorName} ({sub.vendorBrand})
                        </span>
                        {hasAi ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.aiConfidenceLevel === 'high'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                : sub.aiConfidenceLevel === 'medium'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 font-extrabold'
                            }`}
                          >
                            {sub.aiConfidenceLevel === 'high' ? '🟢' : sub.aiConfidenceLevel === 'medium' ? '🟡' : '🔴'}{' '}
                            Confidence: {Math.round((sub.aiConfidenceScore || 0) * 100)}% (
                            {sub.aiConfidenceLevel === 'high' ? 'Tinggi' : sub.aiConfidenceLevel === 'medium' ? 'Sedang' : 'Rendah'}
                            )
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            ⚪ Input Manual Langsung
                          </span>
                        )}
                      </div>

                      {hasAi && (
                        <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                          {sub.aiRawItemName && (
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">Deskripsi Dokumen Asli:</span>{' '}
                              "{sub.aiRawItemName}"
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                            {sub.aiRawDocumentSource && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3 text-slate-400" />
                                File: {sub.aiRawDocumentSource}
                              </span>
                            )}
                            {sub.pairingStatus === 'vendor_confirmed' && (
                              <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Telah dikonfirmasi manual oleh Vendor
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {isLow && (
                        <div className="mt-2 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/50 p-1.5 rounded flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Perhatian Tim Evaluasi: Skor akurasi di bawah 50%. Verifikasi kesesuaian fisik & spesifikasi teknis katalog vendor dengan Master SKU sebelum evaluasi final.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick summary comparison table */}
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Rangkuman Penawaran Seluruh Vendor:
              </span>
              <div className="space-y-1.5">
                {comparison.submissions.map((sub, i) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <span className="text-slate-800 dark:text-slate-200">
                      #{i + 1} {sub.vendorName} ({sub.vendorBrand})
                    </span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">
                      Rp {sub.unitPrice.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
