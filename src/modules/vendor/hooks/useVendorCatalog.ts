import { useCallback, useEffect, useState } from 'react';
import { CatalogVendor, fetchVendorCatalog } from '../../../core/api/catalog';
import { MasterSku, VendorPriceSubmission } from '../../../core/types';

/** scopeKey changes whenever the vendor saves a new business scope, so the catalog reloads. */
export function useVendorCatalog(vendor: CatalogVendor | undefined, scopeKey: string, all: boolean) {
  const [skus, setSkus] = useState<MasterSku[] | null>(null);
  const [submissions, setSubmissions] = useState<VendorPriceSubmission[] | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await fetchVendorCatalog(vendor, all);
    setSkus(data.skus);
    setSubmissions(data.submissions);
  }, [vendor?.id, vendor?.companyName, vendor?.email, scopeKey, all]);

  useEffect(() => {
    load().catch((err) => {
      console.error(err);
      setSkus(null);
      setSubmissions(null);
    });
  }, [load]);

  const upsert = useCallback((item: VendorPriceSubmission) => {
    setSubmissions((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((row) => row.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [item, ...prev];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSubmissions((prev) => (prev ? prev.filter((row) => row.id !== id) : prev));
  }, []);

  return { skus, submissions, upsert, remove };
}
