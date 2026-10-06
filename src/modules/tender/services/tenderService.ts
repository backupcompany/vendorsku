import { MasterSku, VendorPriceSubmission, TenderEvent } from '../types';
import { fetchStaffSkus } from '../../../core/api/catalog';
import { fetchTenders } from '../../../core/api/reference';

export interface SkuTenderComparison {
  sku: MasterSku;
  submissions: VendorPriceSubmission[];
  lowestPrice?: number;
  lowestPriceVendorName?: string;
  highestPrice?: number;
  averagePrice?: number;
  savingVsHpsPercent?: number;
  submissionCount: number;
}

export class TenderService {
  async getTenders(): Promise<TenderEvent[]> {
    return fetchTenders();
  }

  async getConsolidatedSkuComparisons(): Promise<SkuTenderComparison[]> {
    const { skus, submissions } = await fetchStaffSkus();

    // Group submissions by skuId or skuErpCode
    const submissionsBySkuId = new Map<string, VendorPriceSubmission[]>();
    for (const sub of submissions) {
      const existing = submissionsBySkuId.get(sub.skuId) || [];
      existing.push(sub);
      submissionsBySkuId.set(sub.skuId, existing);
    }

    return skus.map((sku) => {
      const skuSubs = submissionsBySkuId.get(sku.id) || [];
      // Sort submissions by unitPrice ascending
      const sortedSubs = [...skuSubs].sort((a, b) => a.unitPrice - b.unitPrice);

      let lowestPrice: number | undefined;
      let lowestPriceVendorName: string | undefined;
      let highestPrice: number | undefined;
      let averagePrice: number | undefined;
      let savingVsHpsPercent: number | undefined;

      if (sortedSubs.length > 0) {
        lowestPrice = sortedSubs[0].unitPrice;
        lowestPriceVendorName = sortedSubs[0].vendorName;
        highestPrice = sortedSubs[sortedSubs.length - 1].unitPrice;
        const total = sortedSubs.reduce((acc, curr) => acc + curr.unitPrice, 0);
        averagePrice = Math.round(total / sortedSubs.length);

        if (sku.benchmarkPrice && lowestPrice < sku.benchmarkPrice) {
          savingVsHpsPercent = Math.round(
            ((sku.benchmarkPrice - lowestPrice) / sku.benchmarkPrice) * 100
          );
        }
      }

      return {
        sku,
        submissions: sortedSubs,
        lowestPrice,
        lowestPriceVendorName,
        highestPrice,
        averagePrice,
        savingVsHpsPercent,
        submissionCount: sortedSubs.length,
      };
    });
  }
}

export const tenderService = new TenderService();
