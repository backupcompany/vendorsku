import { useEffect, useState } from 'react';
import { z } from 'zod';
import { MasterSku, VendorPriceSubmission } from '../types';
import { apiError, http } from './http';

const skuCoreSchema = z.object({
  id: z.string(),
  erpCode: z.string(),
  taxonomy: z.object({
    level1: z.string(),
    level2: z.string(),
    level3: z.string(),
    level4: z.string(),
  }),
  name: z.object({
    commodityName: z.string(),
    generalSpec: z.string(),
    defaultBrand: z.string().nullish(),
    defaultPartNumber: z.string().nullish(),
  }),
  uom: z.string(),
  benchmarkPrice: z.number().nullish(),
  isOpenForVendor: z.boolean(),
  status: z.enum(['active', 'archived', 'pending_review']),
});

const offerSchema = z.object({
  id: z.string(),
  skuId: z.string(),
  skuErpCode: z.string(),
  name: z.object({
    commodityName: z.string(),
    generalSpec: z.string(),
    brand: z.string(),
    partNumber: z.string(),
    fullFormattedSkuName: z.string(),
    specDetail: z.string().nullish(),
  }),
  commercial: z.object({
    lkppPrice: z.number().nullish(),
    linkLkppPrice: z.string().nullish(),
    priceListExcludeVat: z.number(),
    discountPercent: z.number(),
    nettPriceExcludeVat: z.number(),
    unitPrice: z.number(),
    taxPercent: z.number(),
    priceWithTax: z.number(),
    uom: z.string(),
    moq: z.number(),
    leadTimeDays: z.number(),
    priceValidUntil: z.string(),
  }),
  coverage: z.object({
    installedHospitals: z.array(z.string()).nullish(),
  }),
  compliance: z.object({
    kemenkesLicense: z.string().nullish(),
    countryOfOrigin: z.string().nullish(),
    warrantyPeriod: z.string().nullish(),
    additionalNotes: z.string().nullish(),
  }),
  match: z.object({
    confidenceScore: z.number().nullish(),
    confidenceLevel: z.enum(['high', 'medium', 'low', 'none']).nullish(),
    documentSource: z.string().nullish(),
    rawItemName: z.string().nullish(),
    rawSpec: z.string().nullish(),
    rawPrice: z.number().nullish(),
    pairingStatus: z.enum(['auto_paired', 'vendor_confirmed', 'manual']).nullish(),
    adminReviewStatus: z.enum(['verified', 'flagged', 'pending']).nullish(),
  }),
  status: z.enum(['draft', 'submitted', 'under_review', 'shortlisted', 'rejected']),
  submittedAt: z.string(),
  updatedAt: z.string(),
});

const catalogItemSchema = skuCoreSchema.extend({
  offer: offerSchema.nullish(),
});

const staffSkuSchema = skuCoreSchema.extend({
  offers: z.array(z.object({
    vendor: z.object({
      id: z.string(),
      companyName: z.string(),
      erpVendorCode: z.string().nullish(),
      pic: z.object({
        name: z.string().nullish(),
        email: z.string(),
        phone: z.string(),
      }),
    }),
    offer: offerSchema,
  })),
});

export type CatalogVendor = { id: string; companyName: string; email: string };

function skuFromCore(row: z.infer<typeof skuCoreSchema>): MasterSku {
  return {
    id: row.id,
    erpCode: row.erpCode,
    level1: row.taxonomy.level1,
    level2: row.taxonomy.level2,
    level3: row.taxonomy.level3,
    level4: row.taxonomy.level4,
    commodityName: row.name.commodityName,
    generalSpec: row.name.generalSpec,
    defaultBrand: row.name.defaultBrand ?? undefined,
    defaultPartNumber: row.name.defaultPartNumber ?? undefined,
    uom: row.uom,
    benchmarkPrice: row.benchmarkPrice ?? undefined,
    isOpenForVendor: row.isOpenForVendor,
    isActive: row.status !== 'archived',
    status: row.status,
    source: 'seed',
    createdAt: '',
    updatedAt: '',
  };
}

function offerToSubmission(
  offer: z.infer<typeof offerSchema>,
  vendor: CatalogVendor,
): VendorPriceSubmission {
  return {
    id: offer.id,
    skuId: offer.skuId,
    skuErpCode: offer.skuErpCode,
    vendorId: vendor.id,
    vendorName: vendor.companyName,
    vendorEmail: vendor.email,
    commodityName: offer.name.commodityName,
    generalSpec: offer.name.generalSpec,
    vendorBrand: offer.name.brand,
    vendorPartNumber: offer.name.partNumber,
    fullFormattedSkuName: offer.name.fullFormattedSkuName,
    vendorSpecDetail: offer.name.specDetail ?? undefined,
    lkppPrice: offer.commercial.lkppPrice ?? undefined,
    linkLkppPrice: offer.commercial.linkLkppPrice ?? undefined,
    priceListExcludeVat: offer.commercial.priceListExcludeVat,
    discountPercent: Number(offer.commercial.discountPercent),
    nettPriceExcludeVat: offer.commercial.nettPriceExcludeVat,
    unitPrice: offer.commercial.unitPrice,
    taxPercent: Number(offer.commercial.taxPercent),
    priceWithTax: offer.commercial.priceWithTax,
    uom: offer.commercial.uom,
    moq: offer.commercial.moq,
    leadTimeDays: offer.commercial.leadTimeDays,
    priceValidUntil: offer.commercial.priceValidUntil,
    installedHospitals: offer.coverage.installedHospitals ?? undefined,
    kemenkesLicense: offer.compliance.kemenkesLicense ?? undefined,
    countryOfOrigin: offer.compliance.countryOfOrigin ?? undefined,
    warrantyPeriod: offer.compliance.warrantyPeriod ?? undefined,
    additionalNotes: offer.compliance.additionalNotes ?? undefined,
    aiConfidenceScore: offer.match.confidenceScore ?? undefined,
    aiConfidenceLevel: offer.match.confidenceLevel ?? undefined,
    aiRawDocumentSource: offer.match.documentSource ?? undefined,
    aiRawItemName: offer.match.rawItemName ?? undefined,
    aiRawSpec: offer.match.rawSpec ?? undefined,
    aiRawPrice: offer.match.rawPrice ?? undefined,
    pairingStatus: offer.match.pairingStatus ?? undefined,
    adminReviewStatus: offer.match.adminReviewStatus ?? undefined,
    status: offer.status,
    submittedAt: offer.submittedAt,
    updatedAt: offer.updatedAt,
  };
}

const offerBody = (submission: VendorPriceSubmission) => ({
  skuId: submission.skuId,
  vendorBrand: submission.vendorBrand,
  vendorPartNumber: submission.vendorPartNumber,
  vendorSpecDetail: submission.vendorSpecDetail,
  priceListExcludeVat: submission.priceListExcludeVat,
  discountPercent: submission.discountPercent,
  taxPercent: submission.taxPercent,
  lkppPrice: submission.lkppPrice,
  linkLkppPrice: submission.linkLkppPrice,
  uom: submission.uom,
  moq: submission.moq,
  leadTimeDays: submission.leadTimeDays,
  priceValidUntil: submission.priceValidUntil,
  installedHospitals: submission.installedHospitals,
  kemenkesLicense: submission.kemenkesLicense,
  countryOfOrigin: submission.countryOfOrigin,
  warrantyPeriod: submission.warrantyPeriod,
  additionalNotes: submission.additionalNotes,
});

export async function saveVendorOffer(
  submission: VendorPriceSubmission,
): Promise<VendorPriceSubmission> {
  try {
    const { data } = await http.post(
      `/api/vendors/${encodeURIComponent(submission.vendorId)}/offers`,
      offerBody(submission),
    );
    return offerToSubmission(offerSchema.parse(data), {
      id: submission.vendorId,
      companyName: submission.vendorName,
      email: submission.vendorEmail,
    });
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk penawaran server tidak sesuai.');
    throw apiError(err, 'Penawaran gagal disimpan.');
  }
}

const OFFER_BATCH = 500;

/** One request per 500 offers; each batch is all-or-nothing on the server. */
export async function saveVendorOffers(
  vendor: CatalogVendor,
  submissions: VendorPriceSubmission[],
): Promise<VendorPriceSubmission[]> {
  try {
    const saved: VendorPriceSubmission[] = [];
    for (let i = 0; i < submissions.length; i += OFFER_BATCH) {
      const { data } = await http.post(`/api/vendors/${encodeURIComponent(vendor.id)}/offers/bulk`, {
        offers: submissions.slice(i, i + OFFER_BATCH).map(offerBody),
      });
      saved.push(...z.array(offerSchema).parse(data).map((offer) => offerToSubmission(offer, vendor)));
    }
    return saved;
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk penawaran server tidak sesuai.');
    throw apiError(err, 'Penawaran gagal disimpan.');
  }
}

export async function deleteVendorOffer(vendorId: string, offerId: string): Promise<void> {
  try {
    await http.delete(`/api/vendors/${encodeURIComponent(vendorId)}/offers/${encodeURIComponent(offerId)}`);
  } catch (err) {
    throw apiError(err, 'Penawaran gagal dihapus.');
  }
}

export async function fetchMasterSkus(): Promise<MasterSku[]> {
  try {
    const { data } = await http.get('/api/skus');
    return z.array(skuCoreSchema).parse(data).map(skuFromCore);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk SKU server tidak sesuai.');
    throw apiError(err, 'Daftar SKU gagal dimuat.');
  }
}

export async function patchMasterSku(
  id: string,
  patch: { isOpenForVendor?: boolean; isActive?: boolean },
): Promise<MasterSku> {
  try {
    const { data } = await http.patch(`/api/staff/skus/${encodeURIComponent(id)}`, patch);
    return skuFromCore(skuCoreSchema.parse(data));
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk SKU server tidak sesuai.');
    throw apiError(err, 'SKU gagal diubah.');
  }
}

/** Upserts by Product ID and returns how many rows the server stored. */
export async function saveMasterSkus(skus: MasterSku[]): Promise<number> {
  try {
    const res = await http.post('/api/staff/skus', { skus });
    return z.object({ saved: z.number() }).parse(res.data).saved;
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'Master SKU gagal disimpan.');
  }
}

export async function deleteMasterSku(id: string): Promise<void> {
  try {
    await http.delete(`/api/staff/skus/${encodeURIComponent(id)}`);
  } catch (err) {
    throw apiError(err, 'SKU gagal dihapus.');
  }
}

const BULK_CHUNK = 5000;

export async function patchMasterSkus(
  ids: string[],
  patch: { isOpenForVendor?: boolean; isActive?: boolean },
): Promise<number> {
  try {
    let updated = 0;
    for (let i = 0; i < ids.length; i += BULK_CHUNK) {
      const { data } = await http.patch('/api/staff/skus', { ids: ids.slice(i, i + BULK_CHUNK), ...patch });
      updated += z.object({ updated: z.number() }).parse(data).updated;
    }
    return updated;
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'SKU gagal diubah.');
  }
}

export async function deleteMasterSkus(ids: string[]): Promise<number> {
  try {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += BULK_CHUNK) {
      const { data } = await http.post('/api/staff/skus/delete', { ids: ids.slice(i, i + BULK_CHUNK) });
      deleted += z.object({ deleted: z.number() }).parse(data).deleted;
    }
    return deleted;
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'SKU gagal dihapus.');
  }
}

const taxonomySchema = z.array(z.object({
  level1: z.string(),
  count: z.number(),
  level2: z.array(z.object({ name: z.string(), count: z.number() })),
  examples: z.array(z.string()),
}));
export type SkuTaxonomy = z.infer<typeof taxonomySchema>;

export async function fetchSkuTaxonomy(): Promise<SkuTaxonomy> {
  try {
    const { data } = await http.get('/api/skus/taxonomy');
    return taxonomySchema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk kategori server tidak sesuai.');
    throw apiError(err, 'Kategori SKU gagal dimuat.');
  }
}

let taxonomyPending: Promise<SkuTaxonomy> | null = null;

/** Whole open catalog taxonomy (not the vendor's scoped catalog), so a vendor can widen its scope. */
export function useSkuTaxonomy(): SkuTaxonomy {
  const [taxonomy, setTaxonomy] = useState<SkuTaxonomy>([]);
  useEffect(() => {
    let live = true;
    taxonomyPending ??= fetchSkuTaxonomy().catch((err) => {
      taxonomyPending = null;
      throw err;
    });
    taxonomyPending.then((t) => live && setTaxonomy(t)).catch((err) => console.error(err));
    return () => {
      live = false;
    };
  }, []);
  return taxonomy;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function level2NamesOf(taxonomy: SkuTaxonomy, level1: string): string[] {
  return (taxonomy.find((t) => same(t.level1, level1))?.level2 ?? []).map((l2) => l2.name).sort();
}

/** Mirrors vendor_catalog: a Level 2 list wins over Level 1 and may span several Level 1s. */
export function scopeSkuCount(taxonomy: SkuTaxonomy, level1: string, level2List: string[]): number {
  if (level2List.length === 0) return taxonomy.find((t) => same(t.level1, level1))?.count ?? 0;
  const picked = new Set(level2List.map((l2) => l2.trim().toLowerCase()));
  return taxonomy
    .flatMap((t) => t.level2)
    .filter((l2) => picked.has(l2.name.trim().toLowerCase()))
    .reduce((sum, l2) => sum + l2.count, 0);
}

export function suggestLevel1(hits: SkuHit[]): { level1: string; matchCount: number; sampleProducts: string[] }[] {
  const byLevel1 = new Map<string, string[]>();
  for (const hit of hits) byLevel1.set(hit.level1, [...(byLevel1.get(hit.level1) ?? []), hit.commodityName]);
  return [...byLevel1]
    .map(([level1, names]) => ({ level1, matchCount: names.length, sampleProducts: names.slice(0, 3) }))
    .sort((a, b) => b.matchCount - a.matchCount);
}

const skuHitSchema = z.array(z.object({
  commodityName: z.string(),
  generalSpec: z.string(),
  level1: z.string(),
  level2: z.string(),
  level3: z.string(),
}));
export type SkuHit = z.infer<typeof skuHitSchema>[number];

export async function searchSkuNames(q: string): Promise<SkuHit[]> {
  try {
    const { data } = await http.get('/api/skus/search', { params: { q } });
    return skuHitSchema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk hasil pencarian tidak sesuai.');
    throw apiError(err, 'Pencarian SKU gagal.');
  }
}

export async function clearMasterSkus(scope: 'seed' | 'all'): Promise<number> {
  try {
    const { data } = await http.delete('/api/staff/skus', { params: { scope } });
    return z.object({ deleted: z.number() }).parse(data).deleted;
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
    throw apiError(err, 'Master SKU gagal dibersihkan.');
  }
}

export async function fetchVendorCatalog(vendor: CatalogVendor, all = false): Promise<{
  skus: MasterSku[];
  submissions: VendorPriceSubmission[];
}> {
  try {
    const { data } = await http.get(`/api/vendors/${encodeURIComponent(vendor.id)}/catalog`, {
      params: all ? { all: 1 } : undefined,
    });
    const rows = z.array(catalogItemSchema).parse(data);
    return {
      skus: rows.map(skuFromCore),
      submissions: rows.flatMap((row) => (row.offer ? [offerToSubmission(row.offer, vendor)] : [])),
    };
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk katalog server tidak sesuai.');
    throw apiError(err, 'Katalog gagal dimuat.');
  }
}

export async function fetchStaffSkus(): Promise<{
  skus: MasterSku[];
  submissions: VendorPriceSubmission[];
}> {
  try {
    const { data } = await http.get('/api/staff/skus');
    const rows = z.array(staffSkuSchema).parse(data);
    const skus = rows.map(skuFromCore);
    const submissions = rows.flatMap((row) =>
      row.offers.map((entry) =>
        offerToSubmission(entry.offer, {
          id: entry.vendor.id,
          companyName: entry.vendor.companyName,
          email: entry.vendor.pic.email,
        }),
      ),
    );
    return { skus, submissions };
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk SKU server tidak sesuai.');
    throw apiError(err, 'Daftar SKU gagal dimuat.');
  }
}

const skuProposalSchema = z.object({
  id: z.string(),
  erpCode: z.string(),
  commodityName: z.string(),
  generalSpec: z.string(),
  level1: z.string(),
  level2: z.string(),
  level3: z.string(),
  level4: z.string(),
  uom: z.string(),
  brand: z.string().nullish(),
  partNumber: z.string().nullish(),
  status: z.enum(['active', 'archived', 'pending_review']),
  source: z.string().nullish(),
  rawSpec: z.string().nullish(),
  vendorId: z.string().nullish(),
  vendorName: z.string().nullish(),
  submittedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

export type SkuProposal = z.infer<typeof skuProposalSchema>;

export async function proposeSku(
  vendorId: string,
  body: {
    commodityName: string;
    generalSpec: string;
    level1: string;
    uom?: string;
    brand?: string;
    partNumber?: string;
  },
): Promise<SkuProposal> {
  try {
    const { data } = await http.post(`/api/vendors/${encodeURIComponent(vendorId)}/sku-proposals`, body);
    return skuProposalSchema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk usulan server tidak sesuai.');
    throw apiError(err, 'Usulan SKU gagal disimpan.');
  }
}

export async function fetchVendorSkuProposals(vendorId: string): Promise<SkuProposal[]> {
  try {
    const { data } = await http.get(`/api/vendors/${encodeURIComponent(vendorId)}/sku-proposals`);
    return z.array(skuProposalSchema).parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk usulan server tidak sesuai.');
    throw apiError(err, 'Daftar usulan SKU gagal dimuat.');
  }
}

export async function fetchStaffSkuProposals(status = 'pending_review'): Promise<SkuProposal[]> {
  try {
    const { data } = await http.get('/api/staff/sku-proposals', { params: { status } });
    return z.array(skuProposalSchema).parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk usulan server tidak sesuai.');
    throw apiError(err, 'Daftar usulan SKU gagal dimuat.');
  }
}

export async function reviewSkuProposal(
  id: string,
  body: {
    decision: 'approve' | 'reject';
    commodityName?: string;
    generalSpec?: string;
    level1?: string;
    level2?: string;
    level3?: string;
    level4?: string;
    uom?: string;
  },
): Promise<SkuProposal> {
  try {
    const { data } = await http.post(`/api/staff/sku-proposals/${encodeURIComponent(id)}/review`, body);
    return skuProposalSchema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk usulan server tidak sesuai.');
    throw apiError(err, 'Review usulan SKU gagal.');
  }
}
