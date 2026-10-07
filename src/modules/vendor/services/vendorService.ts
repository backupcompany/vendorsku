import * as XLSX from 'xlsx';
import { deleteVendorOffer, saveVendorOffer, saveVendorOffers } from '../../../core/api/catalog';
import { MasterSku, VendorPriceSubmission, VendorProfile } from '../types';

export class VendorService {
  /**
   * Generates Siloam 4-part SKU string:
   * [Commodity Name] ; [General Specification] ; [Brand] ; [Part / REF Number]
   */
  formatFullSkuName(
    commodityName: string,
    generalSpec: string,
    vendorBrand: string,
    vendorPartNumber: string
  ): string {
    const c = commodityName.trim();
    const s = generalSpec.trim();
    const b = vendorBrand.trim() || 'Generic';
    const p = vendorPartNumber.trim() || '-';
    return `${c} ; ${s} ; ${b} ; ${p}`;
  }

  calculateNettPrice(priceListExcludeVat: number, discountPercent: number = 0): number {
    if (priceListExcludeVat <= 0) return 0;
    const discount = Math.min(Math.max(discountPercent, 0), 100);
    return Math.round(priceListExcludeVat * (1 - discount / 100));
  }

  calculatePriceWithTax(nettPrice: number, taxPercent: number = 11): number {
    return Math.round(nettPrice * (1 + taxPercent / 100));
  }

  async saveSubmission(submission: VendorPriceSubmission): Promise<VendorPriceSubmission> {
    return saveVendorOffer(this.priced(submission));
  }

  private priced(submission: VendorPriceSubmission): VendorPriceSubmission {
    if (!submission.commodityName) {
      throw new Error('Nama Komoditas/Item wajib terisi dari Master Data Siloam.');
    }
    if (!submission.vendorBrand.trim()) {
      throw new Error('Nama Brand/Merk wajib diisi oleh vendor.');
    }

    // Calculate nett price from price list and discount
    const priceList = submission.priceListExcludeVat || submission.unitPrice || 0;
    const discount = submission.discountPercent || 0;
    const nettPrice = this.calculateNettPrice(priceList, discount);

    submission.priceListExcludeVat = priceList;
    submission.discountPercent = discount;
    submission.nettPriceExcludeVat = nettPrice;
    submission.unitPrice = nettPrice;

    submission.fullFormattedSkuName = this.formatFullSkuName(
      submission.commodityName,
      submission.generalSpec,
      submission.vendorBrand,
      submission.vendorPartNumber
    );

    submission.priceWithTax = this.calculatePriceWithTax(
      submission.unitPrice,
      submission.taxPercent || 11
    );

    return submission;
  }

  async bulkSaveSubmissions(submissions: VendorPriceSubmission[]): Promise<VendorPriceSubmission[]> {
    if (submissions.length === 0) return [];
    const [first] = submissions;
    return saveVendorOffers(
      { id: first.vendorId, companyName: first.vendorName, email: first.vendorEmail },
      submissions.map((item) => this.priced(item)),
    );
  }

  async deleteSubmission(id: string, vendorId: string): Promise<void> {
    await deleteVendorOffer(vendorId, id);
  }

  /**
   * Generates and downloads Excel template matching the exact format from user's screenshot,
   * with optional pre-filtering by Category / Level 1.
   */
  exportExcelTemplate(
    masterSkus: MasterSku[],
    selectedCategory?: string,
    filename?: string
  ): void {
    // Filter by category if selected
    let targetSkus = masterSkus.filter((s) => s.isOpenForVendor);
    if (selectedCategory && selectedCategory !== 'ALL') {
      targetSkus = targetSkus.filter((s) => s.level1 === selectedCategory);
    }

    // Sort by commodityName (A-Z) and generalSpec (A-Z) so identical names appear together
    targetSkus.sort((a, b) => {
      const nameA = (a.commodityName || '').toLowerCase().trim();
      const nameB = (b.commodityName || '').toLowerCase().trim();
      const cmp = nameA.localeCompare(nameB, 'id', { sensitivity: 'base', numeric: true });
      if (cmp !== 0) return cmp;
      return (a.generalSpec || '').toLowerCase().trim().localeCompare((b.generalSpec || '').toLowerCase().trim(), 'id', { sensitivity: 'base', numeric: true });
    });

    const defaultFilename = selectedCategory && selectedCategory !== 'ALL'
      ? `Siloam_PriceList_Template_${selectedCategory.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
      : 'Siloam_Sourcing_Matrix_Template.xlsx';

    const rows = targetSkus.map((sku) => ({
      'Kategori': sku.level1,
      'Nama Item': sku.commodityName,
      'Spec Umum': sku.generalSpec,
      'Satuan': sku.uom || 'PCS',
      'Brand': '',
      'Type': '',
      'Specification': '',
      'Price list EXCLUDE VAT': '',
      'Discount (%)': 0,
      'Nett Price EXCLUDE VAT': '',
      'Coverage Rumah Sakit': 'All RS Siloam',
      'LKPP Price': '',
      'Link LKPP Price': '',
      'Kode ERP (Kunci)': sku.erpCode,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Column widths aligned to spreadsheet display
    worksheet['!cols'] = [
      { wch: 28 }, // Kategori
      { wch: 32 }, // Nama Item
      { wch: 35 }, // Spec Umum
      { wch: 12 }, // Satuan
      { wch: 16 }, // Brand
      { wch: 20 }, // Type
      { wch: 45 }, // Specification
      { wch: 22 }, // Price List
      { wch: 14 }, // Discount
      { wch: 22 }, // Nett Price
      { wch: 35 }, // Coverage RS
      { wch: 18 }, // LKPP Price
      { wch: 25 }, // Link LKPP
      { wch: 20 }, // Kode ERP
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sourcing_Matrix');
    XLSX.writeFile(workbook, filename || defaultFilename);
  }

  /**
   * Parse uploaded Excel or CSV file buffer and run parity checks
   */
  async parseExcelPriceList(
    fileData: ArrayBuffer,
    masterSkus: MasterSku[],
    vendor: VendorProfile
  ): Promise<{
    validItems: VendorPriceSubmission[];
    errors: { row: number; reason: string; rawRow: any }[];
  }> {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

    const validItems: VendorPriceSubmission[] = [];
    const errors: { row: number; reason: string; rawRow: any }[] = [];

    // Map ERP codes and item names for robust matching
    const skuMapByErp = new Map<string, MasterSku>();
    const skuMapByName = new Map<string, MasterSku>();
    for (const s of masterSkus) {
      skuMapByErp.set(s.erpCode.toUpperCase().trim(), s);
      skuMapByName.set(s.commodityName.toLowerCase().trim(), s);
    }

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      
      // Dynamic header mapping matching the screenshot and alternate names
      const findVal = (...keys: string[]) => {
        const foundKey = Object.keys(row).find((k) =>
          keys.some((target) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(target.toLowerCase().replace(/[^a-z0-9]/g, '')))
        );
        return foundKey ? row[foundKey] : undefined;
      };

      const erpCodeRaw = String(findVal('kodeerp', 'erpcode', 'erp') || '').toUpperCase().trim();
      const itemNameRaw = String(findVal('itemname', 'namakomoditas', 'commodity') || '').trim();
      const brandRaw = String(findVal('brand', 'merk') || '').trim();
      const typeRaw = String(findVal('type', 'model', 'partnumber', 'part') || '').trim();
      const specRaw = String(findVal('specification', 'spek', 'spesifikasi') || '').trim();
      const lkppPriceRaw = Number(findVal('lkppprice', 'hargalkpp')) || undefined;
      const linkLkppRaw = String(findVal('linklkpp', 'linklkppprice', 'url') || '').trim();
      const priceListRaw = Number(findVal('pricelistexcludevat', 'pricelist', 'hargalist')) || 0;
      const discountRaw = Number(findVal('discount', 'diskon')) || 0;
      const nettPriceRaw = Number(findVal('nettpriceexcludevat', 'nettprice', 'harganett')) || 0;
      const hospitalsRaw = String(findVal('coveragerumahsakit', 'coverage', 'coveragers', 'populasirumahsakit', 'populasi', 'rumahsakit', 'hospitals') || '').trim();

      // Find matching Master SKU by ERP Code first, or by Item Name
      let masterSku = erpCodeRaw ? skuMapByErp.get(erpCodeRaw) : undefined;
      if (!masterSku && itemNameRaw) {
        masterSku = skuMapByName.get(itemNameRaw.toLowerCase());
      }

      if (!masterSku) {
        errors.push({
          row: rowNum,
          reason: `Item "${itemNameRaw || erpCodeRaw}" tidak cocok dengan Master SKU Siloam`,
          rawRow: row,
        });
        return;
      }

      if (!masterSku.isOpenForVendor) {
        errors.push({
          row: rowNum,
          reason: `Item "${masterSku.commodityName}" saat ini ditutup untuk penawaran baru`,
          rawRow: row,
        });
        return;
      }

      if (!brandRaw) {
        errors.push({
          row: rowNum,
          reason: `Kolom Brand wajib diisi untuk ${masterSku.commodityName}`,
          rawRow: row,
        });
        return;
      }

      // Calculate final pricing
      let finalPriceList = priceListRaw;
      let finalNett = nettPriceRaw;

      if (finalPriceList <= 0 && finalNett > 0) {
        finalPriceList = finalNett;
      } else if (finalPriceList > 0 && finalNett <= 0) {
        finalNett = this.calculateNettPrice(finalPriceList, discountRaw);
      }

      if (finalPriceList <= 0) {
        errors.push({
          row: rowNum,
          reason: `Harga (Price list EXCLUDE VAT) harus berupa angka > 0`,
          rawRow: row,
        });
        return;
      }

      // Parse hospitals list (default: All RS Siloam)
      let hospitalList: string[] = ['All RS Siloam'];
      if (hospitalsRaw) {
        if (hospitalsRaw.toLowerCase().includes('all') || hospitalsRaw.toLowerCase().includes('semua')) {
          hospitalList = ['All RS Siloam'];
        } else {
          const parsed = hospitalsRaw.split(/[,;\n]/).map((h) => h.trim()).filter(Boolean);
          if (parsed.length > 0) {
            hospitalList = parsed;
          }
        }
      }

      const fullFormattedSkuName = this.formatFullSkuName(
        masterSku.commodityName,
        masterSku.generalSpec,
        brandRaw,
        typeRaw
      );

      const priceWithTax = this.calculatePriceWithTax(finalNett, 11);

      validItems.push({
        id: 'sub-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substring(2, 6),
        skuId: masterSku.id,
        skuErpCode: masterSku.erpCode,
        vendorId: vendor.id,
        vendorName: vendor.companyName,
        vendorEmail: vendor.email,
        vendorPhone: vendor.phone,
        vendorNpwp: vendor.npwp,
        commodityName: masterSku.commodityName,
        generalSpec: masterSku.generalSpec,
        vendorBrand: brandRaw,
        vendorPartNumber: typeRaw,
        fullFormattedSkuName,
        vendorSpecDetail: specRaw || undefined,
        lkppPrice: lkppPriceRaw,
        linkLkppPrice: linkLkppRaw || undefined,
        priceListExcludeVat: finalPriceList,
        discountPercent: discountRaw,
        nettPriceExcludeVat: finalNett,
        unitPrice: finalNett,
        taxPercent: 11,
        priceWithTax,
        uom: masterSku.uom,
        moq: 1,
        leadTimeDays: 7,
        priceValidUntil: '2026-12-31',
        installedHospitals: hospitalList.length > 0 ? hospitalList : undefined,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return { validItems, errors };
  }

  /** Template for proposing products that are not yet in the hospital catalog. */
  exportSkuProposalTemplate(defaultLevel1 = ''): void {
    const rows = [
      {
        'Nama Item': 'Surgical Gloves Latex Powder Free',
        'Spesifikasi': 'Natural rubber latex, powder-free, ambidextrous, AQL 1.5, size S-XL, EN 455 / ASTM D3577.',
        'Kategori Level 1': defaultLevel1 || 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Satuan': 'Box',
        'Brand': 'ContohBrand',
        'Part Number': 'GLV-001',
      },
      {
        'Nama Item': '',
        'Spesifikasi': '',
        'Kategori Level 1': defaultLevel1 || '',
        'Satuan': 'Pcs',
        'Brand': '',
        'Part Number': '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 36 }, { wch: 70 }, { wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usulan_Produk');
    XLSX.writeFile(wb, 'Template_Usulan_Produk_Vendor.xlsx');
  }

  parseSkuProposalExcel(fileData: ArrayBuffer): {
    validItems: {
      commodityName: string;
      generalSpec: string;
      level1: string;
      uom: string;
      brand?: string;
      partNumber?: string;
    }[];
    errors: { row: number; reason: string }[];
  } {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);
    const validItems: {
      commodityName: string;
      generalSpec: string;
      level1: string;
      uom: string;
      brand?: string;
      partNumber?: string;
    }[] = [];
    const errors: { row: number; reason: string }[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const findVal = (...keys: string[]) => {
        const foundKey = Object.keys(row).find((k) =>
          keys.some((target) =>
            k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(target.toLowerCase().replace(/[^a-z0-9]/g, '')),
          ),
        );
        return foundKey ? row[foundKey] : undefined;
      };
      const commodityName = String(findVal('namaitem', 'commodity', 'namakomoditas', 'item') || '').trim();
      const generalSpec = String(findVal('spesifikasi', 'specification', 'spek', 'generalspec') || '').trim();
      const level1 = String(findVal('kategorilevel1', 'level1', 'kategori', 'category') || '').trim();
      const uom = String(findVal('satuan', 'uom') || 'Pcs').trim() || 'Pcs';
      const brand = String(findVal('brand', 'merk') || '').trim();
      const partNumber = String(findVal('partnumber', 'part', 'model', 'type') || '').trim();

      if (!commodityName && !generalSpec && !level1) return; // blank template row
      if (!commodityName || !generalSpec || !level1) {
        errors.push({ row: rowNum, reason: 'Nama item, spesifikasi, dan kategori Level 1 wajib diisi.' });
        return;
      }
      if (generalSpec.length > 20000) {
        errors.push({ row: rowNum, reason: 'Spesifikasi terlalu panjang (maks 20.000 karakter).' });
        return;
      }
      validItems.push({
        commodityName,
        generalSpec,
        level1,
        uom,
        brand: brand || undefined,
        partNumber: partNumber || undefined,
      });
    });

    return { validItems, errors };
  }
}

export const vendorService = new VendorService();
