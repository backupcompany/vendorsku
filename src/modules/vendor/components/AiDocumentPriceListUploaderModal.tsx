import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Search,
  Check,
  Filter,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Building,
  Info,
  Database
} from 'lucide-react';
import { MasterSku, VendorProfile, VendorPriceSubmission, DocumentColumnMapping, DocumentMatchItem } from '../../../core/types';
import { aiService } from '../../../core/services/ai/aiService';
import { calculateStatisticalMatch, preprocessMasterSkus } from '../../../core/services/ai/statisticalMatcher';
import { skuService } from '../../sku/services/skuService';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { matchesSearch, searchTokens } from '../../../core/search';

interface AiDocumentPriceListUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterSkus: MasterSku[];
  allMasterSkus?: MasterSku[];
  vendor: VendorProfile;
  onBulkSaveSubmissions: (submissions: VendorPriceSubmission[]) => Promise<void>;
}

type WizardStep = 'upload' | 'mapping' | 'matching' | 'confirmation';

export const AiDocumentPriceListUploaderModal: React.FC<AiDocumentPriceListUploaderModalProps> = ({
  isOpen,
  onClose,
  masterSkus,
  allMasterSkus,
  vendor,
  onBulkSaveSubmissions,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guarantee 100% of Master SKUs from Database are loaded for reference matching
  const [allDatabaseSkus, setAllDatabaseSkus] = useState<MasterSku[]>([]);
  const [isDeepAiRunning, setIsDeepAiRunning] = useState(false);

  useEffect(() => {
    async function loadAllDbSkus() {
      try {
        const dbSkus = await skuService.getAllSkus();
        if (dbSkus && dbSkus.length > 0) {
          setAllDatabaseSkus(dbSkus);
        }
      } catch (err) {
        console.warn('Gagal memuat seluruh Master SKU dari database:', err);
      }
    }
    if (isOpen) {
      loadAllDbSkus();
    }
  }, [isOpen]);

  // Unified full reference pool: ALL ACTIVE Master SKUs in ERP catalog (Deactive ERP SKUs strictly excluded)
  const referenceSkus = useMemo(() => {
    const raw = allDatabaseSkus.length > 0
      ? allDatabaseSkus
      : (allMasterSkus && allMasterSkus.length > 0 ? allMasterSkus : masterSkus);
    return raw.filter((s) => s.status !== 'archived' && s.isActive !== false);
  }, [allDatabaseSkus, allMasterSkus, masterSkus]);

  // File info
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Column Mapping
  const [columnMapping, setColumnMapping] = useState<DocumentColumnMapping>({
    productNameCol: '',
    specCol: '',
    brandCol: '',
    partNumberCol: '',
    uomCol: '',
    priceCol: '',
    discountCol: '',
    kemenkesCol: '',
  });
  const [mappingExplanation, setMappingExplanation] = useState('');

  // Paired Items & Confirmation State
  const [matchItems, setMatchItems] = useState<DocumentMatchItem[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'unconfirmed' | 'confirmed'>('unconfirmed');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Manual SKU Replacement Modal State
  const [replaceTargetItemId, setReplaceTargetItemId] = useState<string | null>(null);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when closed
  const handleClose = () => {
    if (isProcessing) return;
    setCurrentStep('upload');
    setUploadedFile(null);
    setDetectedColumns([]);
    setRawRows([]);
    setMatchItems([]);
    setErrorMessage(null);
    onClose();
  };

  // 1. Handle File Upload (PDF, Excel, CSV)
  const handleFileUpload = async (file: File) => {
    setErrorMessage(null);
    setUploadedFile(file);
    setIsProcessing(true);
    setProcessingMsg(`Membaca dokumen ${file.name}...`);

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
        // Parse with XLSX
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Parse rows as array of objects
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          throw new Error('Dokumen Excel/CSV kosong atau tidak memiliki data.');
        }

        // Enforce maximum 1,000 lines
        const limitedRows = json.slice(0, 1000);
        const headers = Object.keys(limitedRows[0] || {});

        if (headers.length === 0) {
          throw new Error('Tidak dapat mendeteksi header kolom pada spreadsheet.');
        }

        setDetectedColumns(headers);
        setRawRows(limitedRows);

        // Step 2: Trigger AI Column Mapping
        setProcessingMsg('AI sedang menganalisis struktur kolom dan tipe data...');
        const aiMapping = await aiService.mapColumnsWithAi(headers, limitedRows.slice(0, 5), file.name);
        setColumnMapping(aiMapping.mapping);
        setMappingExplanation(aiMapping.explanation);
        setCurrentStep('mapping');
      } else if (extension === 'pdf') {
        // PDF Processing via Gemini 3.8 Flash Multimodal or Fallback
        setProcessingMsg('AI sedang membaca dan mengekstrak tabel price list dari file PDF...');

        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        try {
          const pdfResult = await aiService.parsePdfWithAi(base64, file.name);
          const cols = pdfResult.detectedColumns || ['Nama Produk', 'Spesifikasi', 'Merk', 'Satuan', 'Harga Satuan'];
          const rows = (pdfResult.rows || []).slice(0, 1000);

          if (rows.length === 0) {
            throw new Error('AI tidak menemukan tabel data produk yang terbaca dalam PDF ini.');
          }

          setDetectedColumns(cols);
          setRawRows(rows);

          setProcessingMsg('AI sedang memetakan kolom hasil ekstraksi PDF...');
          const aiMapping = await aiService.mapColumnsWithAi(cols, rows.slice(0, 3), file.name);
          setColumnMapping(aiMapping.mapping);
          setMappingExplanation(aiMapping.explanation);
          setCurrentStep('mapping');
        } catch (pdfErr: any) {
          throw new Error('Gagal memproses file PDF: ' + (pdfErr.message || 'Format tidak didukung. Coba konversi ke format Excel/CSV.'));
        }
      } else {
        throw new Error('Format file tidak didukung. Harap unggah file .xlsx, .xls, .csv, atau .pdf.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses dokumen.');
      setCurrentStep('upload');
    } finally {
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  // 2. Run Statistical Matching on Rows
  const handleProceedToMatching = () => {
    if (!columnMapping.productNameCol || !columnMapping.priceCol) {
      setErrorMessage('Kolom "Nama Produk" dan "Harga Satuan" wajib dipetakan.');
      return;
    }

    setIsProcessing(true);
    setProcessingMsg(`Menghitung kecocokan komoditas terhadap Master SKU ERP...`);

    setTimeout(() => {
      try {
        const items: DocumentMatchItem[] = [];
        const preprocessedCandidates = preprocessMasterSkus(referenceSkus);

        rawRows.forEach((row, idx) => {
          const rawItemName = String(row[columnMapping.productNameCol] || '').trim();
          if (!rawItemName) return; // Skip empty rows

          const rawSpec = columnMapping.specCol ? String(row[columnMapping.specCol] || '').trim() : '';
          const rawBrand = columnMapping.brandCol ? String(row[columnMapping.brandCol] || '').trim() : '';
          const rawPartNumber = columnMapping.partNumberCol ? String(row[columnMapping.partNumberCol] || '').trim() : '';
          const rawUom = columnMapping.uomCol ? String(row[columnMapping.uomCol] || '').trim() : 'Pcs';

          // Clean Price Number
          let rawPrice = 0;
          const rawPriceVal = row[columnMapping.priceCol];
          if (typeof rawPriceVal === 'number') {
            rawPrice = rawPriceVal;
          } else {
            const cleaned = String(rawPriceVal || '').replace(/[^0-9.-]/g, '');
            rawPrice = parseFloat(cleaned) || 0;
          }

          // Clean Discount
          let rawDiscount = 0;
          if (columnMapping.discountCol && row[columnMapping.discountCol]) {
            const discVal = row[columnMapping.discountCol];
            rawDiscount = typeof discVal === 'number' ? discVal : parseFloat(String(discVal).replace(/[^0-9.-]/g, '')) || 0;
          }

          const rawKemenkes = columnMapping.kemenkesCol ? String(row[columnMapping.kemenkesCol] || '').trim() : '';

          // Run Statistical Match against Candidate Master SKUs
          const matchResult = calculateStatisticalMatch(
            { rawItemName, rawSpec, rawBrand, rawPartNumber },
            preprocessedCandidates
          );

          if (matchResult) {
            const isAutoHigh = matchResult.confidenceLevel === 'high';
            items.push({
              id: `doc-item-${idx}`,
              rawIndex: idx + 1,
              rawItemName,
              rawSpec,
              rawBrand,
              rawPartNumber,
              rawUom: rawUom || (matchResult.matchedSku ? matchResult.matchedSku.uom : 'Pcs'),
              rawPrice,
              rawDiscount,
              rawKemenkes,
              matchedSkuId: matchResult.matchedSku ? matchResult.matchedSku.id : undefined,
              matchedSku: matchResult.matchedSku,
              confidenceScore: matchResult.confidenceScore,
              confidenceLevel: matchResult.confidenceLevel,
              matchExplanation: matchResult.matchExplanation,
              topCandidates: matchResult.topCandidates || [],
              isConfirmed: isAutoHigh, // Auto confirm high confidence
            });
          }
        });

        if (items.length === 0) {
          throw new Error('Tidak ada baris produk valid yang dapat diekstrak dari tabel.');
        }

        setMatchItems(items);
        setCurrentStep('confirmation');
      } catch (err: any) {
        setErrorMessage(err.message || 'Gagal memproses pencocokan SKU.');
      } finally {
        setIsProcessing(false);
        setProcessingMsg('');
      }
    }, 150);
  };

  // 2b. Optional Deep AI Semantic Match via Gemini
  const handleDeepAiEnhancement = async () => {
    const unconfirmedItems = matchItems.filter(
      (m) => (!m.isConfirmed || m.confidenceLevel !== 'high') && !m.isIgnored
    );

    if (unconfirmedItems.length === 0) {
      alert('Semua item telah terkonfirmasi dengan confidence tinggi.');
      return;
    }

    setIsDeepAiRunning(true);
    try {
      const batchSize = 15;
      const batches = [];
      for (let i = 0; i < unconfirmedItems.length; i += batchSize) {
        batches.push(unconfirmedItems.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const payloadItems = batch.map((item) => ({
          id: item.id,
          rawItemName: item.rawItemName,
          rawSpec: item.rawSpec,
          rawBrand: item.rawBrand,
          rawPartNumber: item.rawPartNumber,
        }));

        const candidateSet = new Map<string, MasterSku>();
        for (const item of batch) {
          if (item.topCandidates) {
            item.topCandidates.forEach((c) => candidateSet.set(c.sku.id, c.sku));
          }
          if (item.matchedSku) {
            candidateSet.set(item.matchedSku.id, item.matchedSku);
          }
        }
        for (const s of referenceSkus) {
          if (candidateSet.size >= 60) break;
          candidateSet.set(s.id, s);
        }

        const candidateList = Array.from(candidateSet.values());

        const aiResult = await aiService.matchSkusWithAi(payloadItems, candidateList);
        if (aiResult.matches && aiResult.matches.length > 0) {
          const matchMap = new Map(aiResult.matches.map((m) => [m.itemId, m]));

          setMatchItems((prev) =>
            prev.map((item) => {
              const aiMatch = matchMap.get(item.id);
              if (aiMatch && aiMatch.matchedSkuId) {
                const foundSku = referenceSkus.find((s) => s.id === aiMatch.matchedSkuId);
                if (foundSku) {
                  return {
                    ...item,
                    matchedSkuId: foundSku.id,
                    matchedSku: foundSku,
                    confidenceScore: aiMatch.confidenceScore,
                    confidenceLevel: aiMatch.confidenceLevel,
                    matchExplanation: `[AI Gemini] ${aiMatch.matchExplanation}`,
                    isConfirmed: aiMatch.confidenceLevel === 'high',
                  };
                }
              }
              return item;
            })
          );
        }
      }
    } catch (err: any) {
      console.warn('Deep AI enhancement failed:', err);
      alert('Analisis Deep AI mengalami kendala jaringan. Menggunakan pencocokan statistik lokal.');
    } finally {
      setIsDeepAiRunning(false);
    }
  };

  // 3. Confirmations
  const handleConfirmItem = (itemId: string) => {
    setMatchItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isConfirmed: true, isIgnored: false } : item))
    );
  };

  const handleIgnoreItem = (itemId: string) => {
    setMatchItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isIgnored: true, isConfirmed: false } : item))
    );
  };

  const handleBulkConfirmHigh = () => {
    setMatchItems((prev) =>
      prev.map((item) =>
        item.confidenceLevel === 'high' ? { ...item, isConfirmed: true, isIgnored: false } : item
      )
    );
  };

  const handleSelectAlternativeSku = (itemId: string, newSku: MasterSku) => {
    setMatchItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            matchedSkuId: newSku.id,
            matchedSku: newSku,
            confidenceScore: 1.0, // Vendor manually selected
            confidenceLevel: 'high',
            matchExplanation: `Dipilih dan dikonfirmasi langsung oleh Vendor (${newSku.erpCode}).`,
            isConfirmed: true,
            isIgnored: false,
          };
        }
        return item;
      })
    );
    setReplaceTargetItemId(null);
  };

  // 4. Save Final Submissions
  const handleSaveConfirmed = async () => {
    const confirmedItems = matchItems.filter((m) => m.isConfirmed && !m.isIgnored && m.matchedSku);
    if (confirmedItems.length === 0) {
      alert('Belum ada pasangan SKU yang dikonfirmasi. Konfirmasi minimal 1 item.');
      return;
    }

    setIsProcessing(true);
    setProcessingMsg(`Menyimpan ${confirmedItems.length} penawaran harga ke sistem...`);

    try {
      const submissionsToSave: VendorPriceSubmission[] = confirmedItems.map((item) => {
        const sku = item.matchedSku!;
        const priceList = item.rawPrice;
        const discount = item.rawDiscount || 0;
        const nettPrice = Math.round(priceList * (1 - discount / 100));
        const priceWithTax = Math.round(nettPrice * 1.11);

        return {
          id: `sub-${vendor.id}-${sku.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          skuId: sku.id,
          skuErpCode: sku.erpCode,
          vendorId: vendor.id,
          vendorName: vendor.companyName,
          vendorEmail: vendor.email,
          vendorPhone: vendor.phone,
          vendorNpwp: vendor.npwp,

          commodityName: sku.commodityName,
          generalSpec: sku.generalSpec,
          vendorBrand: item.rawBrand || sku.defaultBrand || vendor.companyName,
          vendorPartNumber: item.rawPartNumber || sku.defaultPartNumber || 'REF-STD',
          fullFormattedSkuName: `${sku.commodityName} ; ${sku.generalSpec} ; ${item.rawBrand || sku.defaultBrand || 'STANDAR'} ; ${item.rawPartNumber || sku.defaultPartNumber || 'REF-STD'}`,
          vendorSpecDetail: item.rawSpec || undefined,

          priceListExcludeVat: priceList,
          discountPercent: discount,
          nettPriceExcludeVat: nettPrice,
          unitPrice: nettPrice,
          taxPercent: 11,
          priceWithTax,
          uom: item.rawUom || sku.uom,
          moq: 1,
          leadTimeDays: 7,
          priceValidUntil: vendor.commercialTerms?.priceValidUntil || '2026-12-31',
          installedHospitals:
            vendor.commercialTerms?.coverageType === 'selected_units'
              ? vendor.commercialTerms?.coveredHospitalUnits || ['Semua Unit RS']
              : ['Semua Unit RS'],
          kemenkesLicense: item.rawKemenkes || undefined,

          // Metadata AI Match
          aiConfidenceScore: item.confidenceScore,
          aiConfidenceLevel: item.confidenceLevel,
          aiRawDocumentSource: uploadedFile?.name || 'Uploaded Document',
          aiRawItemName: item.rawItemName,
          aiRawSpec: item.rawSpec,
          aiRawPrice: item.rawPrice,
          pairingStatus: item.confidenceLevel === 'high' && item.confidenceScore >= 0.85 ? 'auto_paired' : 'vendor_confirmed',
          adminReviewStatus: 'pending',

          status: 'submitted',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await onBulkSaveSubmissions(submissionsToSave);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan penawaran harga.');
    } finally {
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = matchItems.length;
    const confirmed = matchItems.filter((i) => i.isConfirmed && !i.isIgnored).length;
    const high = matchItems.filter((i) => i.confidenceLevel === 'high').length;
    const medium = matchItems.filter((i) => i.confidenceLevel === 'medium').length;
    const low = matchItems.filter((i) => i.confidenceLevel === 'low').length;
    const unconfirmed = matchItems.filter((i) => !i.isConfirmed && !i.isIgnored).length;

    return { total, confirmed, high, medium, low, unconfirmed };
  }, [matchItems]);

  // Filtered displayed match items
  const filteredItems = useMemo(() => {
    return matchItems.filter((item) => {
      // Tab filter
      if (filterTab === 'unconfirmed' && (item.isConfirmed || item.isIgnored)) return false;
      if (filterTab === 'confirmed' && (!item.isConfirmed || item.isIgnored)) return false;

      // Confidence filter
      if (confidenceFilter !== 'all' && item.confidenceLevel !== confidenceFilter) return false;

      // Search filter
      return matchesSearch(searchTokens(searchFilter), item.rawItemName, item.rawSpec, item.matchedSku?.commodityName, item.matchedSku?.erpCode);
    });
  }, [matchItems, filterTab, confidenceFilter, searchFilter]);

  // Candidate SKUs for manual replacement search modal
  const searchResultsSkus = useMemo(() => {
    if (!skuSearchQuery.trim()) {
      const curItem = matchItems.find((i) => i.id === replaceTargetItemId);
      if (curItem?.topCandidates && curItem.topCandidates.length > 0) {
        return curItem.topCandidates.map((c) => c.sku);
      }
      return referenceSkus.slice(0, 25);
    }
    const tokens = searchTokens(skuSearchQuery);
    return referenceSkus
      .filter((s) =>
        matchesSearch(tokens, s.commodityName, s.generalSpec, s.erpCode, s.level1, s.level2, s.level3, s.level4, s.defaultBrand, s.defaultPartNumber)
      )
      .slice(0, 50);
  }, [referenceSkus, skuSearchQuery, replaceTargetItemId, matchItems]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Price List Cerdas dengan AI (PDF, Excel, CSV)"
      subtitle="AI otomatis mendeteksi struktur kolom, memetakan tabel, dan mencocokkan pasangan SKU berdasarkan skor statistik."
      maxWidth="5xl"
    >
      <div className="space-y-5">
        {/* Step Indicator Wizard Bar */}
        <div className="grid grid-cols-4 gap-2 text-xs border-b border-slate-200 pb-3 dark:border-slate-800">
          <div
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              currentStep === 'upload'
                ? 'bg-blue-50 text-[#1B3F9B] font-bold dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-400 font-medium'
            }`}
          >
            <span className="flex h-5 w-5 rounded-full items-center justify-center bg-current text-white text-[10px]">
              1
            </span>
            <span className="truncate">Upload Dokumen</span>
          </div>

          <div
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              currentStep === 'mapping'
                ? 'bg-blue-50 text-[#1B3F9B] font-bold dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-400 font-medium'
            }`}
          >
            <span className="flex h-5 w-5 rounded-full items-center justify-center bg-current text-white text-[10px]">
              2
            </span>
            <span className="truncate">Pemetaan Kolom AI</span>
          </div>

          <div
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              currentStep === 'matching'
                ? 'bg-blue-50 text-[#1B3F9B] font-bold dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-400 font-medium'
            }`}
          >
            <span className="flex h-5 w-5 rounded-full items-center justify-center bg-current text-white text-[10px]">
              3
            </span>
            <span className="truncate">Analisis Statistik</span>
          </div>

          <div
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              currentStep === 'confirmation'
                ? 'bg-blue-50 text-[#1B3F9B] font-bold dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-400 font-medium'
            }`}
          >
            <span className="flex h-5 w-5 rounded-full items-center justify-center bg-current text-white text-[10px]">
              4
            </span>
            <span className="truncate">Konfirmasi Pasangan</span>
          </div>
        </div>

        {/* Master SKU Active Reference Database Indicator Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[#1B3F9B] dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-300 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <Database className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Basis data referensi Master SKU ERP siap dipakai untuk pencocokan.
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Bidirectional Clinical Synonyms + Multi-field Scoring
          </span>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isProcessing && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in">
            <RefreshCw className="h-8 w-8 text-[#1B3F9B] animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{processingMsg}</p>
              <p className="text-xs text-slate-400">Harap tunggu, model AI sedang bekerja...</p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: UPLOAD DOKUMEN                                  */}
        {/* ======================================================== */}
        {!isProcessing && currentStep === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 hover:border-blue-600 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-blue-50/40 hover:bg-blue-50/80 dark:border-blue-900/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf, .xlsx, .xls, .csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />

              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-white text-[#1B3F9B] shadow-md dark:bg-slate-800 dark:text-blue-400">
                <Upload className="h-7 w-7" />
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                  Klik untuk pilih file atau seret dokumen ke sini
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Mendukung dokumen <strong>PDF Price List</strong>, <strong>Excel (.xlsx, .xls)</strong>, atau <strong>CSV</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <FileText className="h-3 w-3 text-red-500" />
                  <span>PDF Price List</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                  <span>Excel (.xlsx, .xls)</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Layers className="h-3 w-3 text-blue-500" />
                  <span>CSV File</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-[11px] font-bold text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                  <span>Maksimal 1.000 Baris Data</span>
                </span>
              </div>
            </div>

            {/* Explanatory guidelines */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
              <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Bagaimana AI Membantu Penawaran Vendor?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
                <li>AI akan membaca dan mendeteksi kolom nama barang, spesifikasi, merk, dan harga satuan penawaran.</li>
                <li>Sistem menghitung <strong>Tingkat Kecocokan Statistik (Confidence Level)</strong> terhadap database Master SKU.</li>
                <li>Baris dengan kecocokan tinggi dapat langsung dikonfirmasi otomatis, sedangkan baris dengan skor sedang/rendah dapat dikonfirmasi satu per satu oleh vendor.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: PEMETAAN STRUKTUR KOLOM OLEH AI                  */}
        {/* ======================================================== */}
        {!isProcessing && currentStep === 'mapping' && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 text-xs">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-[#1B3F9B] dark:text-blue-400 shrink-0" />
                <div>
                  <div className="font-bold text-[#0B2361] dark:text-blue-200">
                    Hasil Analisis AI atas Struktur Kolom Dokumen ({uploadedFile?.name})
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {mappingExplanation}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 font-bold border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shrink-0">
                {rawRows.length} Baris Terbaca
              </span>
            </div>

            {/* Column Mapping Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Product Name (Mandatory) */}
              <div className="p-3 rounded-xl border border-blue-300 bg-white dark:bg-slate-850 dark:border-blue-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  1. Nama Produk / Komoditas <span className="text-red-500">*</span>
                </label>
                <select
                  value={columnMapping.productNameCol}
                  onChange={(e) => setColumnMapping({ ...columnMapping, productNameCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Pilih Kolom --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {rawRows[0]?.[columnMapping.productNameCol] || '-'}
                </span>
              </div>

              {/* Specification */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  2. Spesifikasi / Deskripsi
                </label>
                <select
                  value={columnMapping.specCol || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, specCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Tidak Ada / Kosong --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {columnMapping.specCol ? rawRows[0]?.[columnMapping.specCol] || '-' : '-'}
                </span>
              </div>

              {/* Brand */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  3. Brand / Merk
                </label>
                <select
                  value={columnMapping.brandCol || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, brandCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Tidak Ada / Kosong --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {columnMapping.brandCol ? rawRows[0]?.[columnMapping.brandCol] || '-' : '-'}
                </span>
              </div>

              {/* Part Number / Catalog */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  4. Part No. / Model / REF
                </label>
                <select
                  value={columnMapping.partNumberCol || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, partNumberCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Tidak Ada / Kosong --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {columnMapping.partNumberCol ? rawRows[0]?.[columnMapping.partNumberCol] || '-' : '-'}
                </span>
              </div>

              {/* Price (Mandatory) */}
              <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800 space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 block">
                  5. Harga Satuan (Excl. PPN) <span className="text-red-500">*</span>
                </label>
                <select
                  value={columnMapping.priceCol}
                  onChange={(e) => setColumnMapping({ ...columnMapping, priceCol: e.target.value })}
                  className="w-full rounded-lg border border-emerald-300 bg-white py-1.5 px-2 text-xs font-bold text-emerald-800 focus:border-emerald-600 focus:outline-none dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300"
                >
                  <option value="">-- Pilih Kolom --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate font-mono">
                  Contoh: Rp {rawRows[0]?.[columnMapping.priceCol] || 0}
                </span>
              </div>

              {/* UOM */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  6. Satuan (UOM)
                </label>
                <select
                  value={columnMapping.uomCol || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, uomCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Otomatis (Pcs/Box) --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {columnMapping.uomCol ? rawRows[0]?.[columnMapping.uomCol] || '-' : '-'}
                </span>
              </div>

              {/* Discount */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  7. Diskon (%)
                </label>
                <select
                  value={columnMapping.discountCol || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, discountCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Tidak Ada / 0% --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {columnMapping.discountCol ? rawRows[0]?.[columnMapping.discountCol] || '0%' : '0%'}
                </span>
              </div>

              {/* Kemenkes License */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                  8. Izin Edar AKD/AKL
                </label>
                <select
                  value={columnMapping.kemenkesCol || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, kemenkesCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs font-semibold focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- Tidak Ada / Kosong --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block truncate">
                  Contoh: {columnMapping.kemenkesCol ? rawRows[0]?.[columnMapping.kemenkesCol] || '-' : '-'}
                </span>
              </div>
            </div>

            {/* Live Data Preview Table (Top 3 rows) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pratinjau Data Dokumen Hasil Pemetaan:
              </label>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Nama Produk (Mapped)</th>
                      <th className="p-2">Spesifikasi</th>
                      <th className="p-2">Brand</th>
                      <th className="p-2">Part No</th>
                      <th className="p-2 text-right">Harga Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rawRows.slice(0, 3).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 text-slate-400">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-800 dark:text-white">
                          {r[columnMapping.productNameCol] || '-'}
                        </td>
                        <td className="p-2 text-slate-500">
                          {columnMapping.specCol ? r[columnMapping.specCol] || '-' : '-'}
                        </td>
                        <td className="p-2 text-slate-500">
                          {columnMapping.brandCol ? r[columnMapping.brandCol] || '-' : '-'}
                        </td>
                        <td className="p-2 text-slate-500 font-mono">
                          {columnMapping.partNumberCol ? r[columnMapping.partNumberCol] || '-' : '-'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          Rp {Number(r[columnMapping.priceCol] || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCurrentStep('upload')}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Ganti File
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleProceedToMatching}
                disabled={!columnMapping.productNameCol || !columnMapping.priceCol}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Lanjutkan ke Analisis & Pairing SKU ({rawRows.length} Baris)
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: KONFIRMASI PASANGAN & CONFIDENCE LEVEL REVIEW    */}
        {/* ======================================================== */}
        {!isProcessing && currentStep === 'confirmation' && (
          <div className="space-y-4">
            {/* Statistical Confidence Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 dark:bg-slate-850 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-medium">Total Item Dokumen</span>
                <div className="text-xl font-siloam font-bold text-slate-900 dark:text-white">
                  {stats.total} SKU
                </div>
                <span className="text-[10px] text-slate-500">Maks. 1.000 per sesi</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 space-y-1">
                <span className="text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Confidence Tinggi (≥80%)</span>
                </span>
                <div className="text-xl font-siloam font-bold text-emerald-900 dark:text-emerald-200">
                  {stats.high} Item
                </div>
                <span className="text-[10px] text-emerald-600">Otomatis siap dipasangkan</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 space-y-1">
                <span className="text-amber-700 dark:text-amber-300 text-[11px] font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Confidence Sedang (50-79%)</span>
                </span>
                <div className="text-xl font-siloam font-bold text-amber-900 dark:text-amber-200">
                  {stats.medium} Item
                </div>
                <span className="text-[10px] text-amber-600">Perlu konfirmasi vendor</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 space-y-1">
                <span className="text-rose-700 dark:text-rose-300 text-[11px] font-medium flex items-center gap-1">
                  <X className="h-3.5 w-3.5 text-rose-600" />
                  <span>Confidence Rendah (&lt;50%)</span>
                </span>
                <div className="text-xl font-siloam font-bold text-rose-900 dark:text-rose-200">
                  {stats.low} Item
                </div>
                <span className="text-[10px] text-rose-600">Wajib verifikasi satu per satu</span>
              </div>
            </div>

            {/* Quick Actions & Bulk Confirm */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Status Konfirmasi:
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  {stats.confirmed} dari {stats.total} Terkonfirmasi ({Math.round((stats.confirmed / (stats.total || 1)) * 100)}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeepAiEnhancement}
                  disabled={isDeepAiRunning}
                  icon={<Sparkles className={`h-3.5 w-3.5 text-purple-600 ${isDeepAiRunning ? 'animate-spin' : ''}`} />}
                  className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
                >
                  {isDeepAiRunning ? 'Menganalisis Deep AI Gemini...' : 'Tingkatkan dengan Deep AI Gemini'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBulkConfirmHigh}
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  className="text-xs"
                >
                  Konfirmasi Otomatis Semua Skor Tinggi ({stats.high} Item)
                </Button>
              </div>
            </div>

            {/* Filtering & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 pb-1">
                <button
                  type="button"
                  onClick={() => setFilterTab('unconfirmed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filterTab === 'unconfirmed'
                      ? 'bg-[#1B3F9B] text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  Perlu Konfirmasi ({stats.unconfirmed})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('confirmed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filterTab === 'confirmed'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  Terkonfirmasi ({stats.confirmed})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filterTab === 'all'
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  Semua ({stats.total})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(e.target.value as any)}
                  className="rounded-lg border border-slate-300 bg-white py-1 px-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Semua Skor</option>
                  <option value="high">Hanya Tinggi (≥80%)</option>
                  <option value="medium">Hanya Sedang (50-79%)</option>
                  <option value="low">Hanya Rendah (&lt;50%)</option>
                </select>

                <div className="relative">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari nama item, spesifikasi, atau kode ERP..."
                    className="w-48 rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* List of Pairing Cards (One by One Confirmation Mode) */}
            <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
              {filteredItems.map((item) => {
                const sku = item.matchedSku;
                const percent = Math.round(item.confidenceScore * 100);

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      item.isConfirmed
                        ? 'bg-emerald-50/40 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : item.isIgnored
                        ? 'bg-slate-100 border-slate-300 opacity-60 dark:bg-slate-900 dark:border-slate-800'
                        : 'bg-white border-slate-200 hover:border-blue-400 shadow-xs dark:bg-slate-900 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Left: Vendor Raw Uploaded Item */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                            Baris #{item.rawIndex}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.rawItemName}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {item.rawSpec && <span>Spec: <em>{item.rawSpec}</em></span>}
                          {item.rawBrand && <span>Brand: <strong>{item.rawBrand}</strong></span>}
                          {item.rawPartNumber && <span>REF: <code className="text-purple-600">{item.rawPartNumber}</code></span>}
                          <span>Harga: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">Rp {item.rawPrice.toLocaleString('id-ID')}</strong> / {item.rawUom}</span>
                        </div>
                      </div>

                      {/* Center: Match Confidence Badge & Explanation */}
                      <div className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="text-center">
                          <div className={`text-xs font-bold ${
                            item.confidenceLevel === 'high'
                              ? 'text-emerald-600'
                              : item.confidenceLevel === 'medium'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}>
                            {percent}%
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                            {item.confidenceLevel}
                          </div>
                        </div>

                        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />

                        {/* Matched SKU Snippet */}
                        <div className="min-w-0 max-w-[200px] sm:max-w-[260px] text-left">
                          {sku ? (
                            <>
                              <div className="text-[11px] font-bold text-blue-900 dark:text-blue-300 truncate">
                                {sku.commodityName}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                ERP: <code className="font-mono text-blue-600">{sku.erpCode}</code> · {sku.generalSpec}
                              </div>
                            </>
                          ) : (
                            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              Belum Ditemukan Padanan di ERP
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Confirmation Actions */}
                      <div className="shrink-0 flex items-center gap-1.5 justify-end">
                        {item.isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                            <span>Terkonfirmasi</span>
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!item.matchedSku}
                            onClick={() => handleConfirmItem(item.id)}
                            icon={<Check className="h-3.5 w-3.5" />}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs disabled:opacity-50"
                          >
                            Konfirmasi Pasangan
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplaceTargetItemId(item.id);
                            setSkuSearchQuery(item.rawItemName);
                          }}
                          className="text-xs"
                          title="Ganti Pasangan Master SKU"
                        >
                          Ganti SKU
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleIgnoreItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                          title="Abaikan baris ini"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                      {item.matchExplanation}
                    </div>

                    {/* Quick Candidate Recommendation Chips */}
                    {item.topCandidates && item.topCandidates.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          Rekomendasi Lain ({item.topCandidates.length}):
                        </span>
                        {item.topCandidates.map((cand) => {
                          const isCurrent = item.matchedSkuId === cand.sku.id;
                          const candPercent = Math.round(cand.score * 100);
                          return (
                            <button
                              key={cand.sku.id}
                              type="button"
                              onClick={() => handleSelectAlternativeSku(item.id, cand.sku)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-blue-100 border-blue-400 text-blue-800 font-bold dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                              }`}
                              title={`${cand.sku.commodityName} (${cand.sku.erpCode}) - ${cand.reason}`}
                            >
                              <span className="truncate max-w-[140px] sm:max-w-[200px]">{cand.sku.commodityName}</span>
                              <span className={`text-[9px] px-1 rounded font-bold ${
                                cand.score >= 0.80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                cand.score >= 0.50 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {candPercent}%
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400">
                  Tidak ada item yang sesuai dengan filter.
                </div>
              )}
            </div>

            {/* Bottom Footer Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCurrentStep('mapping')}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Kembali ke Pemetaan Kolom
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSaveConfirmed}
                  disabled={stats.confirmed === 0}
                  icon={<Sparkles className="h-4 w-4" />}
                  className="bg-[#1B3F9B] hover:bg-[#153482]"
                >
                  Terapkan & Simpan ke Matriks Harga ({stats.confirmed} Item)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Ganti Pasangan Master SKU */}
        {replaceTargetItemId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-blue-600" />
                    <span>Pilih Master SKU Pengganti</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mencari di katalog Master SKU ERP
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplaceTargetItemId(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  placeholder="Cari nama komoditas, spesifikasi, kategori, brand, atau kode ERP..."
                  className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                <span>Hasil Pencarian:</span>
                <span>Klik untuk langsung mengganti</span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {searchResultsSkus.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectAlternativeSku(replaceTargetItemId, s)}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {s.commodityName}
                      </span>
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                        {s.erpCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {s.generalSpec} · {s.uom} · <span className="text-slate-400">{s.level1} / {s.level2}</span>
                    </div>
                  </button>
                ))}

                {searchResultsSkus.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Tidak ditemukan Master SKU dengan kata kunci "{skuSearchQuery}".
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
