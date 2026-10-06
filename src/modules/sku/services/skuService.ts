import { deleteMasterSku, deleteMasterSkus, fetchMasterSkus, patchMasterSku, patchMasterSkus } from '../../../core/api/catalog';
import { MasterSku } from '../types';
import { cleanCommodityName } from '../cleanName';

export { cleanCommodityName } from '../cleanName';

function sanitizeSku(sku: MasterSku): MasterSku {
  if (!sku) return sku;
  return {
    ...sku,
    commodityName: cleanCommodityName(sku.commodityName),
    generalSpec: cleanCommodityName(sku.generalSpec),
  };
}

export class SkuService {
  async getAllSkus(): Promise<MasterSku[]> {
    return (await fetchMasterSkus()).map(sanitizeSku);
  }

  async toggleOpenForVendor(id: string, isOpen: boolean): Promise<MasterSku> {
    return sanitizeSku(await patchMasterSku(id, { isOpenForVendor: isOpen }));
  }

  async bulkToggleOpenForVendor(ids: string[], isOpen: boolean): Promise<number> {
    return patchMasterSkus(ids, { isOpenForVendor: isOpen });
  }

  async toggleActive(id: string, isActive: boolean): Promise<MasterSku> {
    return sanitizeSku(await patchMasterSku(id, { isActive }));
  }

  async bulkToggleActive(ids: string[], isActive: boolean): Promise<number> {
    return patchMasterSkus(ids, { isActive });
  }

  async deleteSku(id: string): Promise<void> {
    await deleteMasterSku(id);
  }

  async bulkDeleteSkus(ids: string[]): Promise<number> {
    return deleteMasterSkus(ids);
  }

  /**
   * Helper to format Siloam 4-Part SKU Name
   */
  formatSkuFullName(
    commodityName: string,
    generalSpec: string,
    brand?: string,
    partNumber?: string
  ): string {
    const p1 = commodityName.trim() || 'Nama Komoditas';
    const p2 = generalSpec.trim() || 'Spesifikasi Umum';
    const p3 = brand?.trim() || '[Brand Vendor]';
    const p4 = partNumber?.trim() || '[Part/REF No]';

    return `${p1} ; ${p2} ; ${p3} ; ${p4}`;
  }

  /**
   * Extract unique hierarchical taxonomy levels from a collection of SKUs
   */
  extractTaxonomyOptions(skus: MasterSku[], currentFilters?: {
    level1?: string;
    level2?: string;
    level3?: string;
  }) {
    // Level 1 options
    const level1Options = Array.from(new Set(skus.map((s) => s.level1))).filter(Boolean);

    // Level 2 filtered by selected level 1
    const filteredForL2 = currentFilters?.level1
      ? skus.filter((s) => s.level1 === currentFilters.level1)
      : skus;
    const level2Options = Array.from(new Set(filteredForL2.map((s) => s.level2))).filter(Boolean);

    // Level 3 filtered by selected level 1 and 2
    const filteredForL3 = currentFilters?.level2
      ? filteredForL2.filter((s) => s.level2 === currentFilters.level2)
      : filteredForL2;
    const level3Options = Array.from(new Set(filteredForL3.map((s) => s.level3))).filter(Boolean);

    // Level 4 filtered by selected level 1, 2, and 3
    const filteredForL4 = currentFilters?.level3
      ? filteredForL3.filter((s) => s.level3 === currentFilters.level3)
      : filteredForL3;
    const level4Options = Array.from(new Set(filteredForL4.map((s) => s.level4))).filter(Boolean);

    return {
      level1Options,
      level2Options,
      level3Options,
      level4Options,
    };
  }
}

export const skuService = new SkuService();
