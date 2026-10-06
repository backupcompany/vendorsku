import { useState, useEffect, useCallback, useMemo } from 'react';
import { SkuTenderComparison, tenderService } from '../services/tenderService';
import { TenderEvent } from '../types';
import { matchesSearch, searchTokens } from '../../../core/search';

export function useTenderView() {
  const [comparisons, setComparisons] = useState<SkuTenderComparison[]>([]);
  const [tenders, setTenders] = useState<TenderEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLevel1, setFilterLevel1] = useState<string>('');
  const [filterOnlyWithBids, setFilterOnlyWithBids] = useState<boolean>(false);
  const [filterConfidence, setFilterConfidence] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tList, cList] = await Promise.all([
        tenderService.getTenders(),
        tenderService.getConsolidatedSkuComparisons(),
      ]);
      setTenders(tList);
      setComparisons(cList);
    } catch (err) {
      console.error('Error loading tender comparisons:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredComparisons = useMemo(() => {
    const tokens = searchTokens(searchQuery);
    return comparisons.filter((c) => {
      if (filterOnlyWithBids && c.submissionCount === 0) return false;
      if (filterLevel1 && c.sku.level1 !== filterLevel1) return false;

      // Filter by AI Match Confidence Level
      if (filterConfidence) {
        if (filterConfidence === 'high') {
          const hasHigh = c.submissions.some((s) => s.aiConfidenceLevel === 'high');
          if (!hasHigh) return false;
        } else if (filterConfidence === 'medium') {
          const hasMed = c.submissions.some((s) => s.aiConfidenceLevel === 'medium');
          if (!hasMed) return false;
        } else if (filterConfidence === 'low') {
          const hasLow = c.submissions.some((s) => s.aiConfidenceLevel === 'low');
          if (!hasLow) return false;
        } else if (filterConfidence === 'manual') {
          const hasManual = c.submissions.some((s) => !s.aiConfidenceScore);
          if (!hasManual) return false;
        }
      }

      return matchesSearch(tokens, c.sku.erpCode, c.sku.commodityName, c.sku.generalSpec, c.sku.level1, c.sku.level2, c.sku.level3);
    });
  }, [comparisons, searchQuery, filterLevel1, filterOnlyWithBids, filterConfidence]);

  const level1Options = useMemo(() => {
    return Array.from(new Set(comparisons.map((c) => c.sku.level1))).filter(Boolean);
  }, [comparisons]);

  const totalBidsCount = useMemo(() => {
    return comparisons.reduce((sum, c) => sum + c.submissionCount, 0);
  }, [comparisons]);

  return {
    tenders,
    comparisons: filteredComparisons,
    allComparisons: comparisons,
    isLoading,
    searchQuery,
    setSearchQuery,
    filterLevel1,
    setFilterLevel1,
    filterOnlyWithBids,
    setFilterOnlyWithBids,
    filterConfidence,
    setFilterConfidence,
    level1Options,
    totalBidsCount,
    refresh: loadData,
  };
}
