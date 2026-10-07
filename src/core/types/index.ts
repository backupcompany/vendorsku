/**
 * Core Type Definitions for Vendor SKU Price List & Mapping Portal
 */

export interface MasterSku {
  id: string;
  erpCode: string; // e.g. 150603050186 (Product ID)
  level1: string; // Purch Category Lv 1 (e.g. DIAGNOSTIC AND MEDICAL DEVICES, GENERAL SUPPLIES)
  level2: string; // Purch Category Lv 2 (e.g. SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS)
  level3: string; // Purch Category Lv 3 (e.g. SURGICAL HAND INSTRUMENTS)
  level4: string; // Purch Category Lv 4 (e.g. SURGICAL HAND INSTRUMENTS)
  
  // 4-Part SKU Name Structure:
  // [Part 1: Commodity Name] ; [Part 2: General Specification] ; [Part 3: Brand] ; [Part 4: Type/Part Number]
  commodityName: string; // Bagian 1: Name / Item Name
  generalSpec: string;   // Bagian 2: Specification 1 ; 2 ; 3
  defaultBrand?: string; // Bagian 3: Brand in ERP
  defaultPartNumber?: string; // Bagian 4: Part Number in ERP

  uom: string; // Unit of Measurement (e.g. pcs, unit, set)
  benchmarkPrice?: number; // Standard Price from ERP
  isOpenForVendor: boolean; // Admin toggle: Diizinkan diisi vendor
  isActive?: boolean; // ERP Active status (from 'Is Active' column in ERP upload: TRUE/FALSE)
  tenderId?: string;
  status: 'active' | 'archived' | 'pending_review';
  
  // ERP Metadata
  documentType?: string; // e.g. 'pr', 'cpr'
  itemId?: string; // e.g. '490110027', '710000019'
  faCategory?: string; // e.g. '720000010'
  isGenericProduct?: boolean;
  isContract?: boolean;
  spec1?: string;
  spec2?: string;
  spec3?: string;
  spItemId?: string;
  sourceRow?: Record<string, string | number | boolean | null>; // verbatim ERP xlsx row
  isUploaded?: boolean; // Set true when uploaded by user via Excel
  source?: 'erp_upload' | 'seed'; // Origin of the SKU record

  createdAt: string;
  updatedAt: string;
}

export interface VendorPriceSubmission {
  id: string;
  skuId: string;
  skuErpCode: string;
  
  // Vendor Info
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone?: string;
  vendorNpwp?: string;

  // The 4-Part SKU resulting name
  commodityName: string; // Bagian 1: Item Name (Inherited, Locked)
  generalSpec: string;   // Bagian 2: Company Requirement Spec (Inherited, Locked)
  vendorBrand: string;   // Bagian 3: Brand (Editable by vendor)
  vendorPartNumber: string; // Bagian 4: Type / Model / REF (Editable by vendor)
  fullFormattedSkuName: string; // [commodityName] ; [generalSpec] ; [vendorBrand] ; [vendorPartNumber]
  vendorSpecDetail?: string; // Spesifikasi Inti / Detail dari Vendor

  // Excel Sourcing Matrix Commercial Fields
  lkppPrice?: number; // Harga e-Katalog LKPP
  linkLkppPrice?: string; // Link URL e-Katalog LKPP
  priceListExcludeVat: number; // Price list EXCLUDE VAT (IDR)
  discountPercent: number; // Discount (%)
  nettPriceExcludeVat: number; // Nett Price EXCLUDE VAT = Price List * (1 - discount/100)

  // Backward compatibility / Tax
  unitPrice: number; // Maps to nettPriceExcludeVat
  taxPercent: number; // Default 11%
  priceWithTax: number; // Nett price + VAT
  uom: string;
  moq: number; // Minimum Order Quantity
  leadTimeDays: number; // Lead time (hari kerja)
  priceValidUntil: string; // YYYY-MM-DD
  
  // Coverage Rumah Sakit Terpasang / Target Unit Coverage
  installedHospitals?: string[]; // e.g. unit RS

  // Regulatory & Technical Compliance
  kemenkesLicense?: string; // Nomor AKD/AKL
  countryOfOrigin?: string; // e.g. Indonesia, Jerman, Jepang
  warrantyPeriod?: string;
  additionalNotes?: string;

  // AI Document Match Metadata & Statistical Confidence
  aiConfidenceScore?: number; // 0 to 1, e.g. 0.94 (94%)
  aiConfidenceLevel?: 'high' | 'medium' | 'low' | 'none';
  aiRawDocumentSource?: string; // e.g. 'PriceList_Medika_2026.pdf'
  aiRawItemName?: string; // Raw name from uploaded document
  aiRawSpec?: string;
  aiRawPrice?: number;
  pairingStatus?: 'auto_paired' | 'vendor_confirmed' | 'manual';
  adminReviewStatus?: 'verified' | 'flagged' | 'pending';

  status: 'draft' | 'submitted' | 'under_review' | 'shortlisted' | 'rejected';
  submittedAt: string;
  updatedAt: string;
}

export interface DocumentColumnMapping {
  productNameCol: string;
  specCol?: string;
  brandCol?: string;
  partNumberCol?: string;
  uomCol?: string;
  priceCol: string;
  discountCol?: string;
  kemenkesCol?: string;
}

export interface DocumentMatchItem {
  id: string;
  rawIndex: number;
  rawItemName: string;
  rawSpec?: string;
  rawBrand?: string;
  rawPartNumber?: string;
  rawUom?: string;
  rawPrice: number;
  rawDiscount?: number;
  rawKemenkes?: string;

  // Paired Master SKU
  matchedSkuId?: string;
  matchedSku?: MasterSku;
  confidenceScore: number; // 0.0 to 1.0
  confidenceLevel: 'high' | 'medium' | 'low' | 'none';
  matchExplanation: string;
  topCandidates?: Array<{
    sku: MasterSku;
    score: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  isConfirmed: boolean;
  isIgnored?: boolean;
}

export type SupplierStatus = 'prospect' | 'identified' | 'verified';

export interface BusinessScope {
  level1: string; // One category at level 1
  level2List: string[]; // Multiple categories at level 2
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'super_admin' | 'procurement_officer' | 'evaluator' | 'auditor';
  roleTitle: string;
  department: string;
  hospitalUnit?: string;
  password?: string;
}

export interface CommercialTerms {
  // Masa Berlaku Penawaran Harga (Header Level)
  validFrom?: string; // Tanggal Mulai Berlaku
  priceValidUntil: string; // Batas Akhir Berlaku (e.g. '2026-12-31')
  commitmentPeriodMonths?: number; // Durasi Komitmen (e.g. 12 bulan)

  // Cakupan & Distribusi Rumah Sakit
  coverageType: 'all_units' | 'selected_units'; // Seluruh RS aktif atau unit tertentu
  coveredHospitalUnits: string[]; // Daftar Unit RS yang di-cover

  // Ketentuan Umum Komersial & Pengiriman
  currency: string; // IDR
  taxCondition: 'exclude_vat_11' | 'include_vat_11'; // Exclude / Include PPN 11%
  standardLeadTimeDays: number; // Standar Lead Time Pengiriman (Hari)
  standardMoq: number; // Standar Minimum Order Quantity
  deliveryTerm: string; // Syarat Penyerahan Barang (e.g. Franco RS)
  paymentTerm: string; // Syarat Pembayaran (e.g. TOP 30 Hari)
  warrantyGeneral: string; // Garansi & Layanan Purna Jual
  additionalNotes?: string; // Catatan Tambahan Penawaran
  updatedAt?: string;
}

export interface VendorProfile {
  id: string;
  erpVendorCode?: string; // e.g. 'VND-ERP-10023' (kode vendor resmi di SAP/SIM-RS ERP)
  companyName: string;
  email: string;
  phone: string;
  npwp: string;
  address?: string;
  authorizedPerson: string; // PIC Name
  verified: boolean;
  status: SupplierStatus; // 'prospect' | 'identified' | 'verified'
  isExistingSupplier?: boolean;
  source?: 'erp_upload' | 'self_registered' | 'manual_admin';
  registrationDate?: string;
  linkedMasterVendorId?: string;
  businessScope?: BusinessScope;
  commercialTerms?: CommercialTerms;
  category?: string;
  notes?: string;
  password?: string;
  passwordCreatedAt?: string;
}

export interface TenderEvent {
  id: string;
  tenderNumber: string;
  title: string;
  description: string;
  submissionDeadline: string;
  status: 'draft' | 'open' | 'evaluation' | 'completed';
  targetUnits: string[]; // e.g. unit RS
  totalSkus: number;
  createdAt: string;
}

export interface AiLogEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  model: string;
  action: 'sku_parse' | 'tender_analysis' | 'rag_search' | 'chat_assist';
  promptPreview: string;
  tokensUsed: number;
  estimatedCostUsd: number;
}

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  metadata: {
    skuId?: string;
    level1?: string;
    level2?: string;
    commodityName?: string;
    source: 'master_sku' | 'tender_doc' | 'vendor_catalog';
  };
  embedding?: number[];
  createdAt: string;
}

export interface TaxonomyHierarchy {
  level1: string;
  subLevels: {
    level2: string;
    subLevels: {
      level3: string;
      level4List: string[];
    }[];
  }[];
}

export type IndonesiaIsland =
  | 'Jawa'
  | 'Sumatera'
  | 'Bali & Nusa Tenggara'
  | 'Kalimantan'
  | 'Sulawesi'
  | 'Maluku & Papua';

export interface HospitalUnit {
  id: string; // e.g. "shlv" or "hosp-1"
  code: string; // e.g. "SHLV", "MRCCC", "SHKJ"
  name: string; // e.g. nama unit RS
  city: string; // e.g. "Tangerang", "Jakarta Barat", "Surabaya"
  province: string; // e.g. "Banten", "DKI Jakarta", "Jawa Timur"
  island: IndonesiaIsland | string; // e.g. "Jawa", "Sumatera", etc.
  type?: string; // e.g. "Rumah Sakit Umum Tipe B", "Comprehensive Cancer Center", "Klinik Utama"
  bedCapacity?: number;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
