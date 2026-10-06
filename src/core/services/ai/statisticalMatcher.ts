import { MasterSku } from '../../types';

export interface MatchCandidate {
  sku: MasterSku;
  score: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  reason: string;
}

export interface StatisticalMatchResult {
  matchedSku?: MasterSku;
  confidenceScore: number; // 0.00 to 1.00
  confidenceLevel: 'high' | 'medium' | 'low' | 'none';
  matchExplanation: string;
  isMatched: boolean;
  topCandidates: MatchCandidate[];
  breakdown: {
    nameSimilarity: number;
    specSimilarity: number;
    brandBonus: number;
    partBonus: number;
    categoryMatch: boolean;
  };
}

export interface VendorItemToMatch {
  rawItemName: string;
  rawSpec?: string;
  rawBrand?: string;
  rawPartNumber?: string;
}

/**
 * Common noise and stop words that must not trigger false positive matches
 */
const STOPWORDS = new Set([
  'standard', 'standard2', 'standard3', 'option', 'full', 'device', 'devices',
  'unit', 'pcs', 'box', 'width', 'height', 'weight', 'dimensions', 'material',
  'include', 'bag', 'for', 'with', 'without', 'and', 'the', 'di', 'dan',
  'dari', 'untuk', 'yang', 'tipe', 'type', 'model', 'ref', 'no', 'nomor',
  'set', 'isi', 'packaging', 'original', 'baru', 'new', 'lengkap', 'spesifikasi',
  'ukuran', 'warna', 'color', 'black', 'white', 'blue', 'red', 'siloam',
  'hospitals', 'rs', 'tutup', 'dengan', 'tanpa', 'cm', 'mm', 'kg', 'gr',
  'whole', 'straps', 'buckles', 'transport', 'pack', 'piece', 'item', 'produk',
  'barang', 'pt', 'cv', 'corp', 'tbk', 'indonesia', 'bukan', 'atau', 'non'
]);

/**
 * Medical & Procurement Domain Synonym Clusters
 * Every entry in a cluster is automatically mapped bidirectionally to all other members.
 */
const SYNONYM_CLUSTERS: string[][] = [
  // Syringes & Injection
  ['spuit', 'syringe', 'suntik', 'jarum', 'injeksi', 'luer', 'disposable', 'oneject', 'terumo', 'bd', 'bbraun'],
  
  // Infusion & IV Catheters
  ['infus', 'iv', 'catheter', 'kateter', 'abbocath', 'abocath', 'cannula', 'surflo', 'vasofix', 'intravenous', 'selang', 'infusion', 'venflon'],
  
  // Foley & Urinary Catheter
  ['foley', 'folley', 'urin', 'urine', 'nelaton', 'balloon', 'kantong', 'bag'],
  
  // Gauze, Wound Care, Bandages
  ['kasa', 'gauze', 'perban', 'bandage', 'tampon', 'verban', 'steril', 'sterile', 'hidrofil', 'dressing', 'swab'],
  
  // Plaster & Tapes
  ['plester', 'plaster', 'hypafix', 'micropore', 'leukoplast', 'dermafix', 'fixomull', 'tape', 'perekat'],
  
  // Medical Gloves
  ['sarung', 'tangan', 'handscoon', 'gloves', 'glove', 'latex', 'nitrile', 'examination', 'surgical', 'sensi'],
  
  // Masks & Respiratory Protection
  ['masker', 'mask', 'n95', 'kn95', 'surgical', 'earloop', 'tie', 'respirator', '3m', 'sensi'],
  
  // Defibrillators & Emergency Resuscitation
  ['defibrillator', 'defib', 'aed', 'kejut', 'jantung', 'resusitasi', 'cpr', 'cardiac', 'shock', 'biphasic', 'beneheart', 'zoll', 'mindray', 'philips', 'lifepak'],
  
  // Ventilators & Breathing Support
  ['ventilator', 'respirator', 'bantu', 'napas', 'ventilasi', 'mekanik', 'cpap', 'bipap', 'invasive', 'noninvasive', 'draeger', 'hamilton'],
  
  // Spinal Immobilization & Extrication
  ['ked', 'kendrick', 'extrication', 'device', 'spinal', 'immobilization', 'imobilisasi', 'tulang', 'belakang', 'cervical', 'tandu', 'stretcher', 'evakuasi', 'collar', 'neck'],
  
  // Patient Monitor & ECG
  ['ekg', 'ecg', 'elektrokardiograf', 'elektroda', 'electrode', 'monitor', 'patient', 'pasien', 'holter', 'lead', 'kabel'],
  
  // Blood Pressure / Tensimeter
  ['tensimeter', 'sphygmomanometer', 'tensi', 'darah', 'aneroid', 'digital', 'cuff', 'manset', 'omron', 'riester'],
  
  // Stethoscope
  ['stetoskop', 'stethoscope', 'littmann', 'riester', 'akustik'],
  
  // Suction
  ['suction', 'aspirator', 'hisap', 'lendir', 'yankauer'],
  
  // Surgical Sutures & Blades
  ['benang', 'bedah', 'suture', 'silk', 'vicryl', 'monocryl', 'prolene', 'chromic', 'catgut', 'ethicon'],
  ['bisturi', 'blade', 'pisau', 'scalpel', 'feather'],
  
  // Disinfectant & Antiseptic
  ['alkohol', 'alcohol', 'antiseptik', 'povidone', 'iodine', 'betadine', 'chlorhexidine', 'handrub', 'handsanitizer'],
  
  // Underpad & Hygiene
  ['underpad', 'perlak', 'alas', 'popok', 'diaper', 'seni'],
  
  // Laboratory Blood Collection
  ['tabung', 'edta', 'vacutainer', 'vacuum', 'tube', 'clot', 'activator', 'heparin'],
  
  // Food & Pantry (Non-Medical)
  ['puding', 'pudding', 'snack', 'kue', 'makanan', 'dapur', 'pantry', 'gelas', 'cup', 'kotak', 'sendok', 'garpu', 'piring', 'mangkok', 'katering', 'beras', 'minyak', 'gula', 'saus', 'tomat', 'kecap'],
  
  // Office Supplies & Stationery (Non-Medical)
  ['kertas', 'paper', 'hvs', 'a4', 'f4', 'pulpen', 'pen', 'spidol', 'marker', 'map', 'ordner', 'stapler', 'binder', 'tinta', 'toner'],
  
  // Cleaning & Housekeeping (Non-Medical)
  ['sabun', 'soap', 'deterjen', 'karbol', 'pembersih', 'lantai', 'pel', 'sapu', 'plastik', 'sampah', 'trashbag']
];

/**
 * Precompiled bidirectional synonym lookup map
 */
const BIDIRECTIONAL_SYNONYMS: Map<string, Set<string>> = new Map();

for (const cluster of SYNONYM_CLUSTERS) {
  const clusterSet = new Set(cluster);
  for (const word of cluster) {
    let existing = BIDIRECTIONAL_SYNONYMS.get(word);
    if (!existing) {
      existing = new Set();
      BIDIRECTIONAL_SYNONYMS.set(word, existing);
    }
    for (const other of clusterSet) {
      if (other !== word) {
        existing.add(other);
      }
    }
  }
}

/**
 * Words indicating medical / clinical equipment & devices
 */
const MEDICAL_KEYWORDS = new Set([
  'defibrillator', 'defib', 'aed', 'ventilator', 'respirator', 'ked',
  'extrication', 'spinal', 'ambulance', 'ambulans', 'spuit', 'syringe',
  'infus', 'catheter', 'kateter', 'kasa', 'gauze', 'stetoskop', 'tensimeter',
  'anestesi', 'ekg', 'ecg', 'monitor', 'suction', 'jarum', 'needle', 'suture',
  'steril', 'sterile', 'imobilisasi', 'immobilization', 'cervical', 'endotracheal',
  'abbocath', 'surflo', 'vasofix', 'cannula', 'handscoon', 'hypafix', 'micropore',
  'foley', 'nelaton', 'vacutainer', 'edta', 'bisturi', 'scalpel', 'vicryl', 'prolene'
]);

/**
 * Words indicating food, kitchen, pantry, non-medical stationery, general consumables
 */
const NON_MEDICAL_KEYWORDS = new Set([
  'puding', 'pudding', 'snack', 'gelas', 'kotak', 'kue', 'makanan',
  'sendok', 'garpu', 'piring', 'mangkok', 'katering', 'dapur', 'pantry',
  'tisue', 'tisu', 'atk', 'pulpen', 'kertas', 'hvs', 'saus', 'kecap',
  'beras', 'minyak', 'gula', 'sabun', 'deterjen', 'karbol', 'trashbag'
]);

/**
 * Normalizes technical units so e.g. "3cc", "3 ml", "3ml" become unified "3ml",
 * and "20g", "20 gauge", "no 20", "no. 20" become unified "20g".
 */
export function normalizeClinicalUnits(str: string): string {
  let s = (str || '').toLowerCase();
  
  // 3cc -> 3ml
  s = s.replace(/\b(\d+(\.\d+)?)\s*(cc|ml)\b/g, '$1ml');
  
  // 20g / 20 gauge / no. 20 / no 20 -> 20g
  s = s.replace(/\b(\d+)\s*(g|gauge)\b/g, '$1g');
  s = s.replace(/\b(no|nomor)\.?\s*(\d+)\b/g, '$2g');
  
  // 16fr / 16 french -> 16fr
  s = s.replace(/\b(\d+)\s*(fr|french|ch)\b/g, '$1fr');
  
  // Liters to ml
  s = s.replace(/\b1\s*(l|liter|ltr)\b/g, '1000ml');
  s = s.replace(/\b(\d+(\.\d+)?)\s*(cm|mm)\b/g, '$1$3');
  
  return s;
}

/**
 * Normalizes string by trimming, lowercasing, resolving units, and removing punctuation
 */
function normalizeString(str: string): string {
  const unified = normalizeClinicalUnits(str);
  return unified
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into unique set of significant words (excluding STOPWORDS)
 */
function getSignificantTokens(str: string): Set<string> {
  const norm = normalizeString(str);
  const words = norm.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Expands a set of tokens with their bidirectional synonyms
 */
function expandTokensWithSynonyms(tokens: Set<string>): Set<string> {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const syns = BIDIRECTIONAL_SYNONYMS.get(token);
    if (syns) {
      syns.forEach((s) => expanded.add(s));
    }
  }
  return expanded;
}

/**
 * Computes Jaccard Similarity between two sets of tokens: |A ∩ B| / |A ∪ B|
 */
function computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++;
    }
  }
  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Computes Levenshtein Distance similarity ratio (0 to 1)
 */
function computeLevenshteinRatio(a: string, b: string): number {
  const s1 = normalizeString(a);
  const s2 = normalizeString(b);
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  const distance = d[m][n];
  const maxLen = Math.max(m, n);
  return 1 - distance / maxLen;
}

/**
 * Extracts key technical specifications like sizes, dimensions, volumes (e.g., 3ml, 20g, 100ml)
 */
function extractTechnicalTokens(str: string): string[] {
  const normalized = normalizeClinicalUnits(str);
  const matches = normalized.match(/\b\d+(\.\d+)?(ml|g|fr|cm|mm|joule|volt|watt|bpm)\b/g);
  return matches || [];
}

/**
 * Preprocessed Master SKU Index for fast, high-performance scanning across thousands of SKUs
 */
export interface PreprocessedMasterSku {
  original: MasterSku;
  nameTokens: Set<string>;
  expandedTokens: Set<string>;
  allTokens: Set<string>;
  techTokens: string[];
  isMedical: boolean;
  isNonMedical: boolean;
  normCode: string;
  normCommodity: string;
  normSpec: string;
  normBrand: string;
  normPart: string;
  normTaxonomy: string;
}

/**
 * Pre-indexes a collection of Master SKUs to avoid redundant tokenization in bulk processing
 */
export function preprocessMasterSkus(skus: MasterSku[]): PreprocessedMasterSku[] {
  return skus.map((sku) => {
    const commodity = sku.commodityName || '';
    const spec = sku.generalSpec || '';
    const taxonomy = [sku.level1, sku.level2, sku.level3, sku.level4].filter(Boolean).join(' ');
    const combinedAll = `${commodity} ${spec} ${taxonomy} ${sku.defaultBrand || ''} ${sku.defaultPartNumber || ''}`;

    const nameTokens = getSignificantTokens(commodity);
    const expandedTokens = expandTokensWithSynonyms(nameTokens);
    const allTokens = getSignificantTokens(combinedAll);
    const techTokens = extractTechnicalTokens(combinedAll);

    const isMedical = Boolean(
      Array.from(expandedTokens).some((t) => MEDICAL_KEYWORDS.has(t)) ||
      (sku.level1 && sku.level1.toUpperCase().includes('MEDICAL'))
    );
    
    const isNonMedical = Boolean(
      Array.from(nameTokens).some((t) => NON_MEDICAL_KEYWORDS.has(t)) ||
      (sku.level1 && (sku.level1.toUpperCase().includes('GENERAL') || sku.level1.toUpperCase().includes('KITCHEN') || sku.level1.toUpperCase().includes('FOOD')))
    );

    return {
      original: sku,
      nameTokens,
      expandedTokens,
      allTokens,
      techTokens,
      isMedical,
      isNonMedical,
      normCode: normalizeString(sku.erpCode || ''),
      normCommodity: normalizeString(commodity),
      normSpec: normalizeString(spec),
      normBrand: normalizeString(sku.defaultBrand || ''),
      normPart: normalizeString(sku.defaultPartNumber || ''),
      normTaxonomy: normalizeString(taxonomy),
    };
  });
}

/**
 * Overhauled Statistical Matcher Engine
 * Matches a vendor product entry against candidate Siloam Master SKUs.
 * Incorporates bidirectional clinical synonyms, multi-field scoring (name, spec, taxonomy, part number, brand),
 * unit normalization, medical domain hard separation, and candidate ranking.
 */
export function calculateStatisticalMatch(
  vendorItem: VendorItemToMatch,
  candidateSkus: MasterSku[] | PreprocessedMasterSku[]
): StatisticalMatchResult | null {
  if (!candidateSkus || candidateSkus.length === 0) return null;

  // Adapt input to preprocessed representation if not already preprocessed
  const preprocessed: PreprocessedMasterSku[] =
    'normCommodity' in candidateSkus[0]
      ? (candidateSkus as PreprocessedMasterSku[])
      : preprocessMasterSkus(candidateSkus as MasterSku[]);

  const vendorRawName = vendorItem.rawItemName || '';
  const vendorCombinedText = [
    vendorItem.rawItemName,
    vendorItem.rawSpec,
    vendorItem.rawBrand,
    vendorItem.rawPartNumber,
  ]
    .filter(Boolean)
    .join(' ');

  const vendorNameTokens = getSignificantTokens(vendorRawName);
  const vendorExpandedTokens = expandTokensWithSynonyms(vendorNameTokens);
  const vendorAllTokens = getSignificantTokens(vendorCombinedText);
  const vendorTechTokens = extractTechnicalTokens(vendorCombinedText);
  const vendorNormName = normalizeString(vendorRawName);
  const vendorNormPart = normalizeString(vendorItem.rawPartNumber || '');
  const vendorNormBrand = normalizeString(vendorItem.rawBrand || '');

  // Detect domain
  const isVendorMedical = Array.from(vendorExpandedTokens).some((t) => MEDICAL_KEYWORDS.has(t));
  const isVendorNonMedical = Array.from(vendorNameTokens).some((t) => NON_MEDICAL_KEYWORDS.has(t));

  const scoredCandidates: Array<{
    sku: MasterSku;
    score: number;
    breakdown: {
      nameSimilarity: number;
      specSimilarity: number;
      brandBonus: number;
      partBonus: number;
      categoryMatch: boolean;
    };
    explanation: string;
  }> = [];

  for (const item of preprocessed) {
    const sku = item.original;

    // Hard Domain Separation: Medical items must never match Non-Medical pantry/food items
    if (isVendorMedical && item.isNonMedical) {
      continue;
    }
    if (isVendorNonMedical && item.isMedical) {
      continue;
    }

    // 1. Direct Part Number / REF / ERP Code Match (Highest Precision Signal)
    let exactCodeBonus = 0;
    if (vendorNormPart && vendorNormPart.length >= 3 && !STOPWORDS.has(vendorNormPart)) {
      if (item.normPart && (vendorNormPart === item.normPart || vendorNormPart.includes(item.normPart) || item.normPart.includes(vendorNormPart))) {
        exactCodeBonus = 0.45;
      }
      if (item.normCode && vendorNormPart === item.normCode) {
        exactCodeBonus = 0.60;
      }
    }

    // 2. Direct or Synonym Commodity Token Overlap
    let commonTokenCount = 0;
    for (const t of vendorExpandedTokens) {
      if (item.expandedTokens.has(t)) {
        commonTokenCount++;
      }
    }

    // Check Levenshtein ratio on normalized names
    const levRatio = computeLevenshteinRatio(vendorNormName, item.normCommodity);

    // If zero token overlap and low Levenshtein, skip unless exact code matched
    if (commonTokenCount === 0 && levRatio < 0.60 && exactCodeBonus === 0) {
      continue;
    }

    // 3. Commodity Name Similarity (Weight: 50%)
    const nameJaccard = computeJaccardSimilarity(vendorExpandedTokens, item.expandedTokens);
    const nameSimilarity = Math.min(1.0, nameJaccard * 0.70 + levRatio * 0.30);

    // 4. Specification & Technical Unit Match (Weight: 25%)
    const specJaccard = computeJaccardSimilarity(vendorAllTokens, item.allTokens);
    let techMatchBonus = 0;
    let techConflictPenalty = 0;

    if (vendorTechTokens.length > 0 && item.techTokens.length > 0) {
      const commonTech = vendorTechTokens.filter((t) => item.techTokens.includes(t));
      if (commonTech.length > 0) {
        techMatchBonus = 0.35;
      } else {
        // e.g. vendor item says 20g but Master SKU says 24g -> slight penalty
        techConflictPenalty = 0.15;
      }
    }
    const specSimilarity = Math.max(0, Math.min(1.0, specJaccard * 0.65 + techMatchBonus - techConflictPenalty));

    // 5. Brand Match Bonus (Weight: 10%)
    let brandBonus = 0;
    if (vendorNormBrand && item.normBrand && !STOPWORDS.has(vendorNormBrand)) {
      if (vendorNormBrand === item.normBrand || item.normCommodity.includes(vendorNormBrand) || item.normSpec.includes(vendorNormBrand)) {
        brandBonus = 1.0;
      }
    }

    // 6. Part / Model Bonus (Weight: 15%)
    const partBonus = Math.min(1.0, exactCodeBonus > 0 ? 1.0 : (vendorNormPart && item.normPart ? 0.3 : 0));

    // Weighted Overall Score (0.0 to 1.0)
    let totalScore =
      nameSimilarity * 0.50 +
      specSimilarity * 0.25 +
      brandBonus * 0.10 +
      partBonus * 0.15 +
      exactCodeBonus;

    // Substring boost: If vendor name cleanly contains commodity name or vice versa
    if (vendorNormName.includes(item.normCommodity) || item.normCommodity.includes(vendorNormName)) {
      totalScore = Math.max(totalScore, 0.88);
    }

    // Clamp score
    totalScore = Math.min(1.0, Math.max(0, totalScore));

    if (totalScore >= 0.25) {
      const percent = Math.round(totalScore * 100);
      let explanation = '';
      if (exactCodeBonus > 0) {
        explanation = `Kecocokan ${percent}% (Sangat Tinggi): Ditemukan kecocokan langsung nomor part/REF/kode ERP (${sku.erpCode}) pada katalog Siloam.`;
      } else if (totalScore >= 0.80) {
        explanation = `Kecocokan ${percent}% (Tinggi): Komoditas "${sku.commodityName}" cocok secara presisi dengan Master SKU Siloam (${sku.erpCode}).`;
      } else if (totalScore >= 0.50) {
        explanation = `Kecocokan ${percent}% (Sedang): Memiliki kemiripan fungsi klinis/komoditas "${sku.commodityName}". Mohon verifikasi spesifikasi detail.`;
      } else {
        explanation = `Kecocokan ${percent}% (Rendah): Indeks kemiripan terbatas. Periksa spesifikasi atau ganti manual.`;
      }

      scoredCandidates.push({
        sku,
        score: Number(totalScore.toFixed(3)),
        breakdown: {
          nameSimilarity: Number(nameSimilarity.toFixed(2)),
          specSimilarity: Number(specSimilarity.toFixed(2)),
          brandBonus: Number(brandBonus.toFixed(2)),
          partBonus: Number(partBonus.toFixed(2)),
          categoryMatch: true,
        },
        explanation,
      });
    }
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Top candidates for user recommendation (up to 5 items)
  const topCandidates: MatchCandidate[] = scoredCandidates.slice(0, 5).map((c) => ({
    sku: c.sku,
    score: c.score,
    confidenceLevel: c.score >= 0.80 ? 'high' : c.score >= 0.50 ? 'medium' : 'low',
    reason: c.explanation,
  }));

  if (scoredCandidates.length === 0 || scoredCandidates[0].score < 0.25) {
    return {
      matchedSku: undefined,
      confidenceScore: 0,
      confidenceLevel: 'none',
      isMatched: false,
      topCandidates: [],
      matchExplanation: 'Tidak ditemukan Master SKU Siloam yang cocok untuk produk ini di database saat ini.',
      breakdown: {
        nameSimilarity: 0,
        specSimilarity: 0,
        brandBonus: 0,
        partBonus: 0,
        categoryMatch: false,
      },
    };
  }

  const best = scoredCandidates[0];
  const confidenceLevel = best.score >= 0.80 ? 'high' : best.score >= 0.50 ? 'medium' : 'low';

  return {
    matchedSku: best.sku,
    confidenceScore: best.score,
    confidenceLevel,
    isMatched: true,
    topCandidates,
    matchExplanation: best.explanation,
    breakdown: best.breakdown,
  };
}

/**
 * Batch processes an array of vendor items against candidate Master SKUs.
 * Reuses preprocessed Master SKU index for optimal speed and memory performance.
 */
export function calculateBatchStatisticalMatches(
  vendorItems: VendorItemToMatch[],
  masterSkus: MasterSku[]
): Array<StatisticalMatchResult | null> {
  const preprocessed = preprocessMasterSkus(masterSkus);
  return vendorItems.map((item) => calculateStatisticalMatch(item, preprocessed));
}
