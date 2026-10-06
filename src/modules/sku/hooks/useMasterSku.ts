import { useState, useEffect, useCallback, useMemo } from 'react';
import { MasterSku } from '../types';
import { skuService } from '../services/skuService';
import { matchesSearch, searchTokens } from '../../../core/search';

export interface TaxonomyFilters {
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
  isOpenOnly?: boolean;
  activeStatus?: 'all' | 'active' | 'inactive';
}

export function useMasterSku(initialIsOpenOnly: boolean = false) {
  const [allSkus, setAllSkus] = useState<MasterSku[]>([]);
  const [filteredSkus, setFilteredSkus] = useState<MasterSku[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [taxonomyFilters, setTaxonomyFilters] = useState<TaxonomyFilters>({
    isOpenOnly: initialIsOpenOnly,
    activeStatus: 'all',
  });

  const loadSkus = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await skuService.getAllSkus();
      setAllSkus(data);
    } catch (err) {
      console.error('Failed to load SKUs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkus();
  }, [loadSkus]);

  // Apply search & taxonomy filters
  useEffect(() => {
    let result = allSkus;

    // Filter 1: Vendor Open view MUST NEVER display deactive / archived ERP SKUs
    if (taxonomyFilters.isOpenOnly) {
      result = result.filter((s) => s.isOpenForVendor && s.status !== 'archived' && s.isActive !== false);
    }

    // Filter 2: ERP Active status (all / active / inactive)
    if (taxonomyFilters.activeStatus === 'active') {
      result = result.filter((s) => s.status !== 'archived' && s.isActive !== false);
    } else if (taxonomyFilters.activeStatus === 'inactive') {
      result = result.filter((s) => s.status === 'archived' || s.isActive === false);
    }

    if (taxonomyFilters.level1) {
      result = result.filter((s) => s.level1 === taxonomyFilters.level1);
    }
    if (taxonomyFilters.level2) {
      result = result.filter((s) => s.level2 === taxonomyFilters.level2);
    }
    if (taxonomyFilters.level3) {
      result = result.filter((s) => s.level3 === taxonomyFilters.level3);
    }
    if (taxonomyFilters.level4) {
      result = result.filter((s) => s.level4 === taxonomyFilters.level4);
    }

    const tokens = searchTokens(searchQuery);
    if (tokens.length) {
      result = result.filter((s) =>
        matchesSearch(tokens, s.erpCode, s.commodityName, s.generalSpec, s.level1, s.level2, s.level3, s.level4, s.uom)
      );
    }

    setFilteredSkus(result);
  }, [allSkus, searchQuery, taxonomyFilters]);

  // Extract dynamic cascaded taxonomy options
  const taxonomyOptions = useMemo(() => {
    return skuService.extractTaxonomyOptions(allSkus, taxonomyFilters);
  }, [allSkus, taxonomyFilters]);

  const updateFilter = useCallback((key: keyof TaxonomyFilters, value: any) => {
    setTaxonomyFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Cascading reset
      if (key === 'level1') {
        next.level2 = undefined;
        next.level3 = undefined;
        next.level4 = undefined;
      } else if (key === 'level2') {
        next.level3 = undefined;
        next.level4 = undefined;
      } else if (key === 'level3') {
        next.level4 = undefined;
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setTaxonomyFilters({ isOpenOnly: initialIsOpenOnly });
  }, [initialIsOpenOnly]);

  const toggleOpen = useCallback(async (id: string, isOpen: boolean) => {
    try {
      const updated = await skuService.toggleOpenForVendor(id, isOpen);
      setAllSkus((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (err) {
      console.error('Failed to toggle SKU open state:', err);
      throw err;
    }
  }, []);

  const bulkToggleOpen = useCallback(async (ids: string[], isOpen: boolean) => {
    try {
      await skuService.bulkToggleOpenForVendor(ids, isOpen);
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      setAllSkus((prev) =>
        prev.map((s) => (idSet.has(s.id) ? { ...s, isOpenForVendor: isOpen, updatedAt: now } : s))
      );
    } catch (err) {
      console.error('Failed to bulk toggle SKU open state:', err);
      throw err;
    }
  }, []);

  const deleteSku = useCallback(async (id: string) => {
    try {
      await skuService.deleteSku(id);
      setAllSkus((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete SKU:', err);
      throw err;
    }
  }, []);

  const bulkDeleteSkus = useCallback(async (ids: string[]) => {
    try {
      await skuService.bulkDeleteSkus(ids);
      const idSet = new Set(ids);
      setAllSkus((prev) => prev.filter((s) => !idSet.has(s.id)));
    } catch (err) {
      console.error('Failed to bulk delete SKUs:', err);
      throw err;
    }
  }, []);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    try {
      const updated = await skuService.toggleActive(id, isActive);
      setAllSkus((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (err) {
      console.error('Failed to toggle SKU active state:', err);
      throw err;
    }
  }, []);

  const bulkToggleActive = useCallback(async (ids: string[], isActive: boolean) => {
    try {
      await skuService.bulkToggleActive(ids, isActive);
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      setAllSkus((prev) =>
        prev.map((s) =>
          idSet.has(s.id)
            ? { ...s, isActive, status: isActive ? 'active' : 'archived', updatedAt: now }
            : s
        )
      );
    } catch (err) {
      console.error('Failed to bulk toggle SKU active state:', err);
      throw err;
    }
  }, []);

  return {
    skus: filteredSkus,
    allSkus,
    isLoading,
    searchQuery,
    setSearchQuery,
    taxonomyFilters,
    taxonomyOptions,
    updateFilter,
    clearFilters,
    toggleOpen,
    bulkToggleOpen,
    toggleActive,
    bulkToggleActive,
    deleteSku,
    bulkDeleteSkus,
    refresh: loadSkus,
  };
}
