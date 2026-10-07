import { tokenLogger } from './tokenLogger';
import { currentRealm } from '../../session/store';

function aiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Session-Realm': currentRealm() };
}
import { MasterSku, VendorPriceSubmission, DocumentColumnMapping } from '../../types';

export interface SkuParseResult {
  commodityName: string;
  generalSpec: string;
  vendorBrand: string;
  vendorPartNumber: string;
  uom: string;
  estimatedPrice: number;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  confidenceScore: number;
  matchingNotes: string;
  matchingMasterSkuId?: string;
}

export class AIService {
  /**
   * Parse vendor raw catalog text into 4-part SKU format and 4-level taxonomy
   */
  async matchAndParseSku(rawText: string, masterSkus: MasterSku[] = []): Promise<SkuParseResult> {
    const summaryContext = masterSkus
      .slice(0, 15)
      .map(
        (s) =>
          `[${s.level1} > ${s.level2}] ${s.commodityName} ; ${s.generalSpec} (ERP: ${s.erpCode})`
      )
      .join('\n');

    try {
      const response = await fetch('/api/ai/parse-sku', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          rawText,
          catalogSummary: summaryContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const parsed: SkuParseResult = data.parsed;

      // Try to find closest matching Master SKU
      if (masterSkus.length > 0) {
        const found = masterSkus.find(
          (m) =>
            m.commodityName.toLowerCase().includes(parsed.commodityName.toLowerCase()) ||
            parsed.commodityName.toLowerCase().includes(m.commodityName.toLowerCase())
        );
        if (found) {
          parsed.matchingMasterSkuId = found.id;
          parsed.level1 = found.level1;
          parsed.level2 = found.level2;
          parsed.level3 = found.level3;
          parsed.level4 = found.level4;
        }
      }

      // Log usage
      await tokenLogger.logUsage({
        action: 'sku_parse',
        promptPreview: rawText,
        tokensUsed: data.tokensUsed || 180,
        model: data.model || 'gemini-3.8-flash',
      });

      return parsed;
    } catch (err) {
      console.warn('Backend AI fetch failed, using local semantic parser:', err);
      return this.localParseFallback(rawText, masterSkus);
    }
  }

  /**
   * Smart Tender Analysis comparing vendor price quotes
   */
  async analyzeTenderSubmissions(sku: MasterSku, submissions: VendorPriceSubmission[]): Promise<{
    summary: string;
    recommendedVendorName?: string;
    keyStrengths: string[];
    riskWarnings: string[];
    savingPotentialPercent?: number;
  }> {
    try {
      const response = await fetch('/api/ai/tender-analysis', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          skuName: `${sku.commodityName} ; ${sku.generalSpec}`,
          submissions: submissions.map((s) => ({
            vendorName: s.vendorName,
            brand: s.vendorBrand,
            partNumber: s.vendorPartNumber,
            unitPrice: s.unitPrice,
            moq: s.moq,
            leadTimeDays: s.leadTimeDays,
            kemenkesLicense: s.kemenkesLicense,
            origin: s.countryOfOrigin,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await tokenLogger.logUsage({
          action: 'tender_analysis',
          promptPreview: `Analysis for ${sku.commodityName}`,
          tokensUsed: 320,
          model: 'gemini-3.8-flash',
        });
        return data;
      }
    } catch (e) {
      console.warn('Tender analysis AI fallback:', e);
    }

    // Heuristic fallback
    if (submissions.length === 0) {
      return {
        summary: 'Belum ada vendor yang memasukkan penawaran harga untuk SKU ini.',
        keyStrengths: [],
        riskWarnings: ['SKU masih dalam status menunggu penawaran vendor'],
      };
    }

    const sortedByPrice = [...submissions].sort((a, b) => a.unitPrice - b.unitPrice);
    const lowest = sortedByPrice[0];
    const highest = sortedByPrice[sortedByPrice.length - 1];
    const savingPercent =
      sku.benchmarkPrice && lowest.unitPrice < sku.benchmarkPrice
        ? Math.round(((sku.benchmarkPrice - lowest.unitPrice) / sku.benchmarkPrice) * 100)
        : 0;

    return {
      summary: `Ditemukan ${submissions.length} penawaran vendor. Penawaran terendah diajukan oleh ${lowest.vendorName} dengan brand "${lowest.vendorBrand}" seharga Rp ${lowest.unitPrice.toLocaleString('id-ID')}.`,
      recommendedVendorName: lowest.vendorName,
      keyStrengths: [
        `Harga paling efisien (selisih Rp ${(highest.unitPrice - lowest.unitPrice).toLocaleString('id-ID')} dari harga tertinggi)`,
        `Lead time pengiriman ${lowest.leadTimeDays} hari kerja dengan MOQ ${lowest.moq} ${lowest.uom}`,
        lowest.kemenkesLicense ? `Memiliki izin edar resmi: ${lowest.kemenkesLicense}` : 'Izin edar perlu diverifikasi fisik',
      ],
      riskWarnings:
        lowest.moq > 50
          ? [`Perhatikan MOQ cukup besar (${lowest.moq} unit) untuk unit RS regional kecil.`]
          : [],
      savingPotentialPercent: savingPercent,
    };
  }

  /**
   * Local rule-based fallback parser
   */
  private localParseFallback(text: string, masterSkus: MasterSku[]): SkuParseResult {
    const raw = text.trim();
    const parts = raw.split(';').map((s) => s.trim());

    // Best effort master matching
    let matchedSku = masterSkus.find((s) =>
      raw.toLowerCase().includes(s.commodityName.toLowerCase())
    );

    if (parts.length >= 4) {
      return {
        commodityName: parts[0] || 'Produk Medis',
        generalSpec: parts[1] || 'Spesifikasi Klinis',
        vendorBrand: parts[2] || 'Merk Vendor',
        vendorPartNumber: parts[3] || 'REF-001',
        uom: matchedSku?.uom || 'Box',
        estimatedPrice: matchedSku?.benchmarkPrice || 0,
        level1: matchedSku?.level1 || 'Alat Kesehatan & BMHP',
        level2: matchedSku?.level2 || 'Medis Habis Pakai',
        level3: matchedSku?.level3 || parts[0],
        level4: matchedSku?.level4 || 'Standar RS',
        confidenceScore: 0.9,
        matchingNotes: 'Dipetakan via delimitasi titik koma standar katalog',
        matchingMasterSkuId: matchedSku?.id,
      };
    }

    return {
      commodityName: matchedSku ? matchedSku.commodityName : raw.split(' ').slice(0, 3).join(' '),
      generalSpec: matchedSku ? matchedSku.generalSpec : raw,
      vendorBrand: 'Brand Terdaftar',
      vendorPartNumber: 'REF-' + Math.floor(Math.random() * 90000 + 10000),
      uom: matchedSku?.uom || 'Box',
      estimatedPrice: matchedSku?.benchmarkPrice || 0,
      level1: matchedSku?.level1 || 'Alat Kesehatan & BMHP',
      level2: matchedSku?.level2 || 'Spuit & Jarum Suntik',
      level3: matchedSku?.level3 || 'Habis Pakai',
      level4: matchedSku?.level4 || 'Steril',
      confidenceScore: matchedSku ? 0.85 : 0.6,
      matchingNotes: matchedSku
        ? `Cocok otomatis dengan Master Data: ${matchedSku.erpCode}`
        : 'Parsing perkiraan offline',
      matchingMasterSkuId: matchedSku?.id,
    };
  }

  /**
   * AI-powered Column Structure Understanding & Mapping
   */
  async mapColumnsWithAi(
    columns: string[],
    sampleRows: any[] = [],
    fileName?: string
  ): Promise<{ mapping: DocumentColumnMapping; explanation: string }> {
    try {
      const response = await fetch('/api/ai/map-columns', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ columns, sampleRows, fileName }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        mapping: data.mapping,
        explanation: data.explanation || 'Kolom berhasil dipetakan oleh AI.',
      };
    } catch (err) {
      console.warn('Backend mapColumns failed, using local heuristic:', err);
      return {
        mapping: this.heuristicMapColumns(columns),
        explanation: 'Pemetaan kolom menggunakan aturan heuristik offline.',
      };
    }
  }

  /**
   * AI PDF Price List Document Parsing
   */
  async parsePdfWithAi(
    base64Data: string,
    fileName?: string
  ): Promise<{ detectedColumns: string[]; rows: any[] }> {
    const response = await fetch('/api/ai/parse-pdf-document', {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({ base64Data, fileName }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * AI Semantic SKU Matching & Verification
   */
  async matchSkusWithAi(
    items: Array<{
      id: string;
      rawItemName: string;
      rawSpec?: string;
      rawBrand?: string;
      rawPartNumber?: string;
    }>,
    candidateSkus: MasterSku[]
  ): Promise<{
    matches: Array<{
      itemId: string;
      matchedSkuId?: string | null;
      confidenceScore: number;
      confidenceLevel: 'high' | 'medium' | 'low' | 'none';
      matchExplanation: string;
    }>;
    fallback: boolean;
  }> {
    try {
      const response = await fetch('/api/ai/match-skus', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ items, candidateSkus }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        matches: data.matches || [],
        fallback: false,
      };
    } catch (err) {
      console.warn('Backend matchSkusWithAi failed, falling back to statistical matcher:', err);
      return {
        matches: [],
        fallback: true,
      };
    }
  }

  private heuristicMapColumns(columns: string[]): DocumentColumnMapping {
    const cleanCols = columns.map((c) => ({ original: c, norm: c.toLowerCase().trim() }));
    const findCol = (keywords: string[]) => {
      const match = cleanCols.find((c) => keywords.some((k) => c.norm.includes(k)));
      return match ? match.original : '';
    };

    return {
      productNameCol:
        findCol([
          'nama barang',
          'nama produk',
          'product name',
          'item name',
          'nama komoditas',
          'deskripsi produk',
          'item description',
          'description',
          'produk',
          'barang',
        ]) || columns[0] || '',
      specCol: findCol(['spesifikasi', 'specification', 'spec', 'ukuran', 'size', 'keterangan', 'detail']),
      brandCol: findCol(['brand', 'merk', 'merek', 'manufacturer', 'pabrikan', 'prinsipal']),
      partNumberCol: findCol([
        'part number',
        'part no',
        'ref',
        'katalog',
        'catalog',
        'kode barang',
        'item code',
        'sku code',
        'tipe',
        'type',
        'model',
      ]),
      uomCol: findCol(['uom', 'satuan', 'unit', 'kemasan', 'packaging']),
      priceCol:
        findCol([
          'harga satuan',
          'harga',
          'price',
          'unit price',
          'hps',
          'tarif',
          'price list',
          'nett price',
          'biaya',
        ]) || columns[columns.length - 1] || '',
      discountCol: findCol(['diskon', 'discount', 'disc']),
      kemenkesCol: findCol(['izin edar', 'kemenkes', 'akd', 'akl', 'nie', 'no izin']),
    };
  }

  /**
   * Back Office only: simplify vendor raw product data into hospital catalog form.
   */
  async standardizeCatalog(input: {
    commodityName: string;
    generalSpec: string;
    level1?: string;
    brochureText?: string;
  }): Promise<{
    commodityName: string;
    generalSpec: string;
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    attributes: Record<string, unknown>;
    model: string;
    fallback?: boolean;
  }> {
    const response = await fetch('/api/ai/standardize-catalog', {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Server returned HTTP ${response.status}`);
    }
    const data = await response.json();
    await tokenLogger.logUsage({
      action: 'sku_parse',
      promptPreview: `${input.commodityName} | ${input.generalSpec}`.slice(0, 200),
      tokensUsed: data.tokensUsed || 0,
      model: data.model || 'gemini',
    });
    return {
      commodityName: String(data.commodityName || input.commodityName),
      generalSpec: String(data.generalSpec || input.generalSpec),
      level1: String(data.level1 || input.level1 || ''),
      level2: String(data.level2 || ''),
      level3: String(data.level3 || ''),
      level4: String(data.level4 || ''),
      attributes: data.attributes && typeof data.attributes === 'object' ? data.attributes : {},
      model: String(data.model || ''),
      fallback: Boolean(data.fallback),
    };
  }
}

export const aiService = new AIService();
