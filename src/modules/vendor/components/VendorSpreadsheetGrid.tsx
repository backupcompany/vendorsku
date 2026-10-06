import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MasterSku, VendorPriceSubmission, VendorProfile } from '../types';
import { vendorService } from '../services/vendorService';
import { skuService, cleanCommodityName } from '../../sku/services/skuService';
import { Button } from '../../../core/ui/Button';
import { AiDocumentPriceListUploaderModal } from './AiDocumentPriceListUploaderModal';
import { ExcelTemplateExportImport } from './ExcelTemplateExportImport';
import {
  Download,
  Save,
  Lock,
  Search,
  ExternalLink,
  Building2,
  Building,
  Sparkles,
  Plus,
  Trash2,
  FilterX,
  CheckSquare,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  RotateCcw,
  Filter,
  Tag,
  ArrowRight,
  SlidersHorizontal,
  HelpCircle,
  TableProperties,
  ClipboardList,
  Eye,
  Truck,
  ShieldCheck,
  X,
} from 'lucide-react';
import { matchesSearch, searchTokens } from '../../../core/search';

interface VendorSpreadsheetGridProps {
  masterSkus: MasterSku[];
  allMasterSkus?: MasterSku[];
  vendor: VendorProfile;
  initialSubmissions: VendorPriceSubmission[];
  onSaveBatch: (submissions: VendorPriceSubmission[]) => Promise<void>;
  onOpenAiMatcher?: () => void;
  onOpenScopeModal?: () => void;
  onOpenQuickGuide?: () => void;
  bypassScopeFilter?: boolean;
  onToggleBypassScope?: () => void;
  activeSubTab?: 'cover' | 'terms' | 'pricing' | 'submissions' | 'matrix';
  onChangeSubTab?: (tab: 'cover' | 'terms' | 'pricing' | 'submissions') => void;
  totalSubmissionsCount?: number;
  totalAllSkusCount?: number;
}

export interface EditableRow {
  rowId: string;
  sku: MasterSku;
  brand: string;
  type: string;
  specification: string;
  lkppPrice: number | '';
  linkLkppPrice: string;
  priceListExcludeVat: number | '';
  discountPercent: number | '';
  nettPriceExcludeVat: number;
  installedHospitals: string[];
  isDirty: boolean;
  existingId?: string;
  isCustomVariant?: boolean;
  candidateErpSkus?: MasterSku[];
  assignedErpSku?: MasterSku;
}

export interface BrandModelOption {
  brand: string;
  model: string;
  isNp: boolean;
  label: string;
}

/**
 * Check if the typed brand and type match an existing active master SKU in ERP
 */
export const findMatchingErpSku = (
  commodityName: string,
  generalSpec: string,
  brand: string,
  type: string,
  candidates: MasterSku[]
): MasterSku | undefined => {
  if (!brand.trim()) return undefined;
  const bLower = brand.trim().toLowerCase();
  const tLower = type.trim().toLowerCase();
  const cLower = commodityName.trim().toLowerCase();
  const sLower = generalSpec.trim().toLowerCase();

  const isBrandNoBrand = bLower === 'nobrand' || bLower === 'no brand' || bLower === 'nb';
  const isTypeNp = !tLower || tLower === 'np' || tLower === '-' || tLower === 'standar' || tLower === 'n/a';

  return candidates.find((sku) => {
    // Exclude inactive / archived SKUs
    if (sku.status === 'archived' || sku.status === 'pending_review') return false;

    const skuCommodity = (sku.commodityName || '').trim().toLowerCase();
    const skuSpec = (sku.generalSpec || '').trim().toLowerCase();
    const skuBrand = (sku.defaultBrand || '').trim().toLowerCase();
    const skuType = (sku.defaultPartNumber || '').trim().toLowerCase();

    // Commodity name must match
    if (skuCommodity !== cLower) return false;

    // Spec must match if spec is defined on both
    if (skuSpec && sLower && skuSpec !== sLower) return false;

    // Brand match (including NoBrand / NB)
    const isSkuNoBrand = !skuBrand || skuBrand === 'nb' || skuBrand === 'nobrand' || skuBrand === 'no brand';
    const brandMatch = (isBrandNoBrand && isSkuNoBrand) || (skuBrand && skuBrand === bLower);
    if (!brandMatch) return false;

    // Type match (including NP / empty)
    const isSkuNp = !skuType || skuType === 'np' || skuType === '-' || skuType === 'standar';
    if (isTypeNp && isSkuNp) return true;
    if (skuType && skuType === tLower) return true;

    return false;
  });
};

/**
 * Extract Brand and Model bundled options for a specific row, including NP option per brand
 */
export const getBrandModelOptionsForRow = (
  row: EditableRow,
  masterSkus: MasterSku[]
): BrandModelOption[] => {
  const source = row.candidateErpSkus && row.candidateErpSkus.length > 0
    ? row.candidateErpSkus
    : masterSkus.filter(
        (s) =>
          (s.status === 'active' || !s.status) &&
          (s.commodityName || '').toLowerCase().trim() === (row.sku.commodityName || '').toLowerCase().trim()
      );

  const brandMap = new Map<string, { brandName: string; models: string[] }>();
  source.forEach((s) => {
    if (s.status === 'archived' || s.status === 'pending_review') return;
    const b = (s.defaultBrand || '').trim();
    if (!b || b.toUpperCase() === 'NB' || b.toUpperCase() === 'NP') return;

    const key = b.toUpperCase();
    const existing = brandMap.get(key) || { brandName: b, models: [] };

    const model = (s.defaultPartNumber || '').trim();
    if (model && model.toUpperCase() !== 'NP' && !existing.models.includes(model)) {
      existing.models.push(model);
    }
    brandMap.set(key, existing);
  });

  const options: BrandModelOption[] = [];

  brandMap.forEach(({ brandName, models }) => {
    // 1. Any specific models registered for this brand
    models.forEach((m) => {
      options.push({
        brand: brandName,
        model: m,
        isNp: false,
        label: `${brandName} — ${m}`,
      });
    });

    // 2. Plus one NP option for this brand
    options.push({
      brand: brandName,
      model: 'NP',
      isNp: true,
      label: `${brandName} — NP (Tanpa Part Number)`,
    });
  });

  return options;
};

export const VendorSpreadsheetGrid: React.FC<VendorSpreadsheetGridProps> = ({
  masterSkus,
  allMasterSkus,
  vendor,
  initialSubmissions,
  onSaveBatch,
  onOpenAiMatcher,
  onOpenScopeModal,
  onOpenQuickGuide,
  bypassScopeFilter = false,
  onToggleBypassScope,
  activeSubTab = 'matrix',
  onChangeSubTab,
  totalSubmissionsCount = 0,
  totalAllSkusCount = 0,
}) => {
  // Multi-select Filters: Kelompok Barang (L3) & Jenis / Tipe Barang (L4)
  // (Menggunakan bahasa umum yang mudah dipahami vendor)
  const [selectedKelompok, setSelectedKelompok] = useState<string[]>([]);
  const [selectedTipe, setSelectedTipe] = useState<string[]>([]);
  const [isKelompokOpen, setIsKelompokOpen] = useState(false);
  const [isTipeOpen, setIsTipeOpen] = useState(false);
  const [searchKelompokText, setSearchKelompokText] = useState('');
  const [searchTipeText, setSearchTipeText] = useState('');
  const kelompokDropdownRef = useRef<HTMLDivElement>(null);
  const tipeDropdownRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  // Status filter: 'ALL' | 'FILLED' | 'UNFILLED'
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FILLED' | 'UNFILLED'>('ALL');
  
  // High-performance Pagination State (prevents DOM bloat and browser halt on large datasets)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isAiDocUploadOpen, setIsAiDocUploadOpen] = useState(false);

  // Active brand autocomplete row
  const [activeBrandDropdownRow, setActiveBrandDropdownRow] = useState<number | null>(null);

  // Active type autocomplete row
  const [activeTypeDropdownRow, setActiveTypeDropdownRow] = useState<number | null>(null);

  // Grid rows state
  const [rows, setRows] = useState<EditableRow[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const formulaBarRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);

  // Prevent scroll when mouse is in top header / search area
  useEffect(() => {
    const preventScroll = (e: WheelEvent) => {
      e.preventDefault();
    };

    const headerEl = formulaBarRef.current;
    const theadEl = theadRef.current;

    if (headerEl) {
      headerEl.addEventListener('wheel', preventScroll, { passive: false });
    }
    if (theadEl) {
      theadEl.addEventListener('wheel', preventScroll, { passive: false });
    }

    return () => {
      if (headerEl) {
        headerEl.removeEventListener('wheel', preventScroll);
      }
      if (theadEl) {
        theadEl.removeEventListener('wheel', preventScroll);
      }
    };
  }, []);

  // Close brand, type, and filter dropdowns when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.brand-autocomplete-container')) {
        setActiveBrandDropdownRow(null);
      }
      if (!target.closest('.type-autocomplete-container')) {
        setActiveTypeDropdownRow(null);
      }
      if (kelompokDropdownRef.current && !kelompokDropdownRef.current.contains(target)) {
        setIsKelompokOpen(false);
      }
      if (tipeDropdownRef.current && !tipeDropdownRef.current.contains(target)) {
        setIsTipeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  useEffect(() => {
    // 1. Filter out inactive SKUs and only keep active SKUs open for vendor (ERP deactive SKUs strictly excluded)
    const activeOpenSkus = masterSkus.filter(
      (s) => s.isOpenForVendor && s.status !== 'archived' && s.status !== 'pending_review' && s.isActive !== false
    );

    // 2. Group by unique (commodityName + generalSpec + uom) to eliminate duplicates
    const skuGroups = new Map<string, MasterSku[]>();
    activeOpenSkus.forEach((sku) => {
      const cName = cleanCommodityName(sku.commodityName).toLowerCase().trim();
      const spec = cleanCommodityName(sku.generalSpec).toLowerCase().trim();
      const uom = (sku.uom || '').toLowerCase().trim();
      const groupKey = `${cName}||${spec}||${uom}`;

      const list = skuGroups.get(groupKey) || [];
      list.push(sku);
      skuGroups.set(groupKey, list);
    });

    // 3. Sort groups alphabetically by commodityName (A-Z), then generalSpec (A-Z), then uom
    const sortedGroupKeys = Array.from(skuGroups.keys()).sort((keyA, keyB) => {
      const [cNameA, specA, uomA] = keyA.split('||');
      const [cNameB, specB, uomB] = keyB.split('||');
      const cmpName = cNameA.localeCompare(cNameB, 'id', { sensitivity: 'base', numeric: true });
      if (cmpName !== 0) return cmpName;
      const cmpSpec = specA.localeCompare(specB, 'id', { sensitivity: 'base', numeric: true });
      if (cmpSpec !== 0) return cmpSpec;
      return uomA.localeCompare(uomB, 'id', { sensitivity: 'base', numeric: true });
    });

    const initialRows: EditableRow[] = [];

    // Pre-index existing submissions by skuId: O(M)
    const subsBySkuId = new Map<string, VendorPriceSubmission[]>();
    for (const sub of initialSubmissions) {
      const list = subsBySkuId.get(sub.skuId);
      if (list) {
        list.push(sub);
      } else {
        subsBySkuId.set(sub.skuId, [sub]);
      }
    }

    // 4. Populate rows: Only 1 line per item name + spec group if unfilled!
    sortedGroupKeys.forEach((groupKey) => {
      const groupSkus = skuGroups.get(groupKey) || [];
      if (groupSkus.length === 0) return;

      // Check if any SKU in this group already has submissions from this vendor
      const allExistingSubs: { sub: VendorPriceSubmission; matchedSku: MasterSku }[] = [];
      groupSkus.forEach((sku) => {
        const subs = subsBySkuId.get(sku.id);
        if (subs && subs.length > 0) {
          subs.forEach((sub) => {
            allExistingSubs.push({ sub, matchedSku: sku });
          });
        }
      });

      if (allExistingSubs.length > 0) {
        allExistingSubs.forEach(({ sub, matchedSku }, subIdx) => {
          const priceList = sub.priceListExcludeVat || sub.unitPrice || '';
          const discount = sub.discountPercent ?? (sub.priceListExcludeVat ? 0 : '');
          const nett = typeof priceList === 'number'
            ? vendorService.calculateNettPrice(priceList, Number(discount) || 0)
            : 0;

          // Check if existing sub already matches an ERP SKU
          const matchedErp = findMatchingErpSku(
            matchedSku.commodityName,
            sub.vendorSpecDetail || matchedSku.generalSpec,
            sub.vendorBrand || '',
            sub.vendorPartNumber || '',
            groupSkus
          ) || (sub.vendorBrand && sub.vendorPartNumber ? matchedSku : undefined);

          const resolvedSku = matchedErp || matchedSku;
          initialRows.push({
            rowId: `row-${matchedSku.id}-${sub.id || subIdx}`,
            sku: {
              ...resolvedSku,
              commodityName: cleanCommodityName(resolvedSku.commodityName),
              generalSpec: cleanCommodityName(resolvedSku.generalSpec),
            },
            brand: sub.vendorBrand || '',
            type: sub.vendorPartNumber || '',
            specification: sub.vendorSpecDetail || '',
            lkppPrice: sub.lkppPrice ?? '',
            linkLkppPrice: sub.linkLkppPrice || '',
            priceListExcludeVat: priceList,
            discountPercent: discount !== undefined && discount !== null && discount !== 0 ? discount : '',
            nettPriceExcludeVat: nett,
            installedHospitals: sub.installedHospitals && sub.installedHospitals.length > 0 ? sub.installedHospitals : ['All RS Siloam'],
            isDirty: false,
            existingId: sub.id,
            isCustomVariant: subIdx > 0,
            candidateErpSkus: groupSkus,
            assignedErpSku: matchedErp,
          });
        });
      } else {
        // ONLY 1 CLEAN LINE for this Item + Spec combination!
        const baseSku = groupSkus[0];
        initialRows.push({
          rowId: `row-${baseSku.id}-0`,
          sku: {
            ...baseSku,
            commodityName: cleanCommodityName(baseSku.commodityName),
            generalSpec: cleanCommodityName(baseSku.generalSpec),
          },
          brand: '',
          type: '',
          specification: '',
          lkppPrice: '',
          linkLkppPrice: '',
          priceListExcludeVat: '',
          discountPercent: '',
          nettPriceExcludeVat: 0,
          installedHospitals: ['All RS Siloam'],
          isDirty: false,
          existingId: undefined,
          isCustomVariant: false,
          candidateErpSkus: groupSkus,
          assignedErpSku: undefined,
        });
      }
    });

    setRows(initialRows);
  }, [masterSkus, initialSubmissions]);

  // Extract Kelompok Barang options (formerly Level 3) with SKU counts
  const kelompokOptions = useMemo(() => {
    const openSkus = masterSkus.filter((s) => s.isOpenForVendor);
    const map = new Map<string, number>();
    openSkus.forEach((s) => {
      const k = s.level3?.trim();
      if (k) {
        map.set(k, (map.get(k) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masterSkus]);

  // Extract Jenis / Tipe Barang options (formerly Level 4) with SKU counts (cascaded by selected Kelompok)
  const tipeOptions = useMemo(() => {
    const openSkus = masterSkus.filter((s) => s.isOpenForVendor);
    const map = new Map<string, number>();
    openSkus.forEach((s) => {
      if (selectedKelompok.length > 0) {
        if (!s.level3 || !selectedKelompok.includes(s.level3.trim())) return;
      }
      const t = s.level4?.trim();
      if (t) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masterSkus, selectedKelompok]);

  const filteredKelompokOptions = useMemo(() => {
    if (!searchKelompokText.trim()) return kelompokOptions;
    const q = searchKelompokText.toLowerCase().trim();
    return kelompokOptions.filter((o) => o.name.toLowerCase().includes(q));
  }, [kelompokOptions, searchKelompokText]);

  const filteredTipeOptions = useMemo(() => {
    if (!searchTipeText.trim()) return tipeOptions;
    const q = searchTipeText.toLowerCase().trim();
    return tipeOptions.filter((o) => o.name.toLowerCase().includes(q));
  }, [tipeOptions, searchTipeText]);

  const handleToggleKelompok = (name: string) => {
    setSelectedKelompok((prev) => {
      const exists = prev.includes(name);
      return exists ? prev.filter((x) => x !== name) : [...prev, name];
    });
    setCurrentPage(1);
  };

  const handleSelectAllKelompok = () => {
    setSelectedKelompok(kelompokOptions.map((o) => o.name));
    setCurrentPage(1);
  };

  const handleClearKelompok = () => {
    setSelectedKelompok([]);
    setCurrentPage(1);
  };

  const handleToggleTipe = (name: string) => {
    setSelectedTipe((prev) => {
      const exists = prev.includes(name);
      return exists ? prev.filter((x) => x !== name) : [...prev, name];
    });
    setCurrentPage(1);
  };

  const handleSelectAllTipe = () => {
    setSelectedTipe(tipeOptions.map((o) => o.name));
    setCurrentPage(1);
  };

  const handleClearTipe = () => {
    setSelectedTipe([]);
    setCurrentPage(1);
  };

  // Reset all taxonomy filters and search
  const handleResetFilters = () => {
    setSelectedKelompok([]);
    setSelectedTipe([]);
    setStatusFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
    showToast('Semua filter kategori barang dan pencarian berhasil di-reset.');
  };

  const hasActiveTaxonomy = selectedKelompok.length > 0 || selectedTipe.length > 0;

  // Total filled count (items with brand & price entered)
  const totalFilled = useMemo(() => {
    return rows.filter((r) => r.brand.trim() && Number(r.priceListExcludeVat) > 0).length;
  }, [rows]);

  // Total unfilled count
  const unfilledCount = useMemo(() => {
    return rows.length - totalFilled;
  }, [rows.length, totalFilled]);

  const unsavedCount = rows.filter((r) => r.isDirty).length;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Handle cell edit
  const handleCellChange = (
    index: number,
    field: keyof EditableRow,
    value: any
  ) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value, isDirty: true };

      if (field === 'priceListExcludeVat') {
        const pList = value === '' ? '' : (Number(value) || 0);
        const disc = Number(row.discountPercent) || 0;
        row.nettPriceExcludeVat = pList !== '' ? vendorService.calculateNettPrice(Number(pList), disc) : 0;

        // Bila belum memilih brand namun mengisi harga, otomatis isi brand: 'NB' dan type: 'NP'
        if (pList !== '' && Number(pList) > 0 && !row.brand.trim()) {
          row.brand = 'NB';
          row.type = 'NP';
        }
      }

      if (field === 'discountPercent') {
        const pList = Number(row.priceListExcludeVat) || 0;
        const disc = value === '' ? '' : (Number(value) || 0);
        row.nettPriceExcludeVat = row.priceListExcludeVat !== '' ? vendorService.calculateNettPrice(pList, Number(disc)) : 0;
      }

      // Check ERP matching if brand or type or price changes
      const currentBrand = row.brand.trim();
      const currentType = row.type.trim();
      const effectiveSpec = row.isCustomVariant && row.specification.trim()
        ? row.specification.trim()
        : row.sku.generalSpec;

      const candidates = row.candidateErpSkus && row.candidateErpSkus.length > 0
        ? row.candidateErpSkus
        : masterSkus;

      const matchedSku = findMatchingErpSku(
        row.sku.commodityName,
        effectiveSpec,
        currentBrand,
        currentType,
        candidates
      );

      if (matchedSku) {
        row.assignedErpSku = matchedSku;
        row.sku = matchedSku;
      } else {
        row.assignedErpSku = undefined;
      }

      next[index] = row;
      return next;
    });
  };

  // AJUKAN SPEK BARU: Tambah baris baru untuk SKU yang sama dengan input spek pengganti
  const handleAddVariantRow = (targetIndex: number) => {
    const source = rows[targetIndex];
    const newVariantRow: EditableRow = {
      rowId: `var-${source.sku.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sku: source.sku,
      brand: source.brand || '',
      type: '',
      specification: '', // Vendor will type replacement spec directly in this line
      lkppPrice: '',
      linkLkppPrice: '',
      priceListExcludeVat: '',
      discountPercent: '',
      nettPriceExcludeVat: 0,
      installedHospitals: source.installedHospitals && source.installedHospitals.length > 0
        ? [...source.installedHospitals]
        : ['All RS Siloam'],
      isDirty: true,
      isCustomVariant: true,
      candidateErpSkus: source.candidateErpSkus,
      assignedErpSku: undefined,
    };

    setRows((prev) => {
      const next = [...prev];
      next.splice(targetIndex + 1, 0, newVariantRow);
      return next;
    });

    showToast(`Line spek baru ditambahkan untuk "${source.sku.commodityName}". Silakan ketik spek pengganti & harga.`);
  };

  // Hapus baris variant baru
  const handleRemoveVariantRow = (targetIndex: number) => {
    const item = rows[targetIndex];
    if (item.existingId) {
      if (!confirm(`Hapus line penawaran alternatif untuk "${item.sku.commodityName}"?`)) {
        return;
      }
    }
    setRows((prev) => prev.filter((_, idx) => idx !== targetIndex));
    showToast('Line spek alternatif telah dihapus.');
  };

  // Excel Clipboard Paste Handler (Ctrl+V / Cmd+V dari Excel)
  const handleGlobalPaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData || !clipboardData.includes('\t')) return; // Only process tab-delimited text

    const lines = clipboardData.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    // Paste into currently visible rows on current page
    const targetRows = paginatedRows.map((d) => d.originalIndex);
    if (targetRows.length === 0) return;

    e.preventDefault();

    setRows((prev) => {
      const next = [...prev];
      lines.forEach((line, lineIdx) => {
        const targetIdx = targetRows[lineIdx];
        if (targetIdx === undefined || targetIdx >= next.length) return;

        const cells = line.split('\t').map((c) => c.trim());
        // Cells format from Excel: Brand, Type, LKPP Price, Link, Price, Discount
        const brand = cells[0] || next[targetIdx].brand;
        const type = cells[1] || next[targetIdx].type;
        const priceRaw = cells[2] ? Number(cells[2].replace(/[^0-9.]/g, '')) : next[targetIdx].priceListExcludeVat;
        const discountRaw = cells[3] ? Number(cells[3].replace(/[^0-9.]/g, '')) : next[targetIdx].discountPercent;

        const pList = Number(priceRaw) || 0;
        const disc = Number(discountRaw) || 0;

        next[targetIdx] = {
          ...next[targetIdx],
          brand,
          type,
          priceListExcludeVat: pList,
          discountPercent: disc,
          nettPriceExcludeVat: vendorService.calculateNettPrice(pList, disc),
          isDirty: true,
        };
      });
      return next;
    });

    showToast(`Berhasil mem-paste ${lines.length} baris dari Excel langsung ke grid!`);
  };

  // Filtered rows based on Multi-Select Kelompok Barang & Jenis/Tipe Barang, Search Query, and Status Filter
  const displayedRows = useMemo(() => {
    const tokens = searchTokens(searchQuery);
    return rows
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) => {
        // 1. Multi-select Kelompok Barang (L3)
        if (selectedKelompok.length > 0) {
          if (!row.sku.level3 || !selectedKelompok.includes(row.sku.level3.trim())) {
            return false;
          }
        }

        // 2. Multi-select Jenis / Tipe Barang (L4)
        if (selectedTipe.length > 0) {
          if (!row.sku.level4 || !selectedTipe.includes(row.sku.level4.trim())) {
            return false;
          }
        }

        // 3. Status filter (All / Filled / Unfilled)
        const isFilled = Boolean(row.brand.trim() && Number(row.priceListExcludeVat) > 0);
        if (statusFilter === 'FILLED' && !isFilled) {
          return false;
        }
        if (statusFilter === 'UNFILLED' && isFilled) {
          return false;
        }

        // 4. Search query filter
        if (!matchesSearch(tokens, row.sku.level1, row.sku.level2, row.sku.level3, row.sku.level4, row.sku.erpCode, row.sku.commodityName, row.sku.generalSpec, row.brand, row.type, row.specification)) {
          return false;
        }

        return true;
      });
  }, [rows, selectedKelompok, selectedTipe, statusFilter, searchQuery]);

  // Reset current page when filters or pageSize change
  useEffect(() => {
    setCurrentPage(1);
    setJumpPageInput('');
  }, [selectedKelompok, selectedTipe, statusFilter, searchQuery, pageSize]);

  // Pagination calculation
  const totalFilteredRows = displayedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredRows / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredRows);

  // Sliced rows for current page (only renders 25-50 rows at a time, ultra-fast 60 FPS)
  const paginatedRows = useMemo(() => {
    return displayedRows.slice(startIndex, endIndex);
  }, [displayedRows, startIndex, endIndex]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: paginatedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 6,
    useFlushSync: false,
    getItemKey: (i) => paginatedRows[i].row.rowId,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const padTop = virtualRows[0]?.start ?? 0;
  const padBottom = rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activePage, pageSize, displayedRows]);

  // Handle Save All
  const handleSaveAll = async () => {
    // 1. Validasi: Bila sudah memilih/mengisi brand, paksa user untuk mengisi harga
    const rowsWithBrandNoPrice = rows.filter(
      (r) => r.brand.trim() && (r.priceListExcludeVat === '' || Number(r.priceListExcludeVat) <= 0)
    );
    if (rowsWithBrandNoPrice.length > 0) {
      alert(
        `Wajib mengisi harga! Ada ${rowsWithBrandNoPrice.length} item dengan merk/brand "${rowsWithBrandNoPrice[0].brand}" yang harga satuannya belum diisi. Silakan isi harga sebelum menyimpan.`
      );
      return;
    }

    // 2. Baris yang siap disimpan:
    // Bila belum memilih brand namun mengisi harga, otomatis simpan dengan brand 'NB' dan part number 'NP'
    const validRowsToSave = rows
      .map((r) => {
        if (Number(r.priceListExcludeVat) > 0 && !r.brand.trim()) {
          return { ...r, brand: 'NB', type: 'NP' };
        }
        return r;
      })
      .filter((r) => r.brand.trim() && Number(r.priceListExcludeVat) > 0);

    if (validRowsToSave.length === 0) {
      alert('Belum ada penawaran harga yang diisi untuk disimpan.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: VendorPriceSubmission[] = validRowsToSave.map((r) => {
        const priceList = Number(r.priceListExcludeVat) || 0;
        const discount = Number(r.discountPercent) || 0;
        const nett = vendorService.calculateNettPrice(priceList, discount);
        const tax = vendorService.calculatePriceWithTax(nett, 11);

        // If it's a custom variant, the typed specification replaces the RS generalSpec
        const effectiveSpec = r.isCustomVariant && r.specification.trim()
          ? r.specification.trim()
          : r.sku.generalSpec;

        const effectiveSkuId = r.assignedErpSku ? r.assignedErpSku.id : r.sku.id;
        const effectiveErpCode = r.assignedErpSku
          ? r.assignedErpSku.erpCode
          : (r.brand.trim().toUpperCase() === 'NB' || r.brand.trim().toLowerCase() === 'nobrand' ? r.sku.erpCode : 'BARU');

        return {
          id: r.existingId || 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          skuId: effectiveSkuId,
          skuErpCode: effectiveErpCode,
          vendorId: vendor.id,
          vendorName: vendor.companyName,
          vendorEmail: vendor.email,
          vendorPhone: vendor.phone,
          vendorNpwp: vendor.npwp,
          commodityName: cleanCommodityName(r.sku.commodityName),
          generalSpec: cleanCommodityName(effectiveSpec),
          vendorBrand: r.brand.trim() || 'NB',
          vendorPartNumber: r.type.trim() || 'NP',
          fullFormattedSkuName: vendorService.formatFullSkuName(
            cleanCommodityName(r.sku.commodityName),
            cleanCommodityName(effectiveSpec),
            r.brand.trim() || 'NB',
            r.type.trim() || 'NP'
          ),
          vendorSpecDetail: r.isCustomVariant && r.specification.trim() ? r.specification.trim() : undefined,
          lkppPrice: r.lkppPrice !== '' ? Number(r.lkppPrice) : undefined,
          linkLkppPrice: r.linkLkppPrice.trim() || undefined,
          priceListExcludeVat: priceList,
          discountPercent: discount,
          nettPriceExcludeVat: nett,
          unitPrice: nett,
          taxPercent: 11,
          priceWithTax: tax,
          uom: r.sku.uom,
          moq: 1,
          leadTimeDays: 7,
          priceValidUntil: vendor.commercialTerms?.priceValidUntil || '2026-12-31',
          installedHospitals:
            vendor.commercialTerms?.coverageType === 'selected_units' && vendor.commercialTerms?.coveredHospitalUnits?.length
              ? vendor.commercialTerms.coveredHospitalUnits
              : ['All RS Siloam'],
          status: 'submitted',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await onSaveBatch(payload);

      setRows((prev) =>
        prev.map((r) => {
          const wasSaved = validRowsToSave.find((vs) => vs.rowId === r.rowId);
          if (wasSaved) {
            return {
              ...r,
              brand: wasSaved.brand,
              type: wasSaved.type,
              isDirty: false,
            };
          }
          return r;
        })
      );

      showToast('Semua penawaran harga & spesifikasi berhasil disimpan!');
    } catch (err: any) {
      alert('Gagal menyimpan penawaran: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Excel-like Keyboard Shortcut: Ctrl+S / Cmd+S to quickly save changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveAll]);

  const handleDownloadFilteredExcel = () => {
    const firstCat = selectedKelompok[0] || vendor.businessScope?.level1 || 'ALL';
    vendorService.exportExcelTemplate(masterSkus, firstCat);
  };

  const handleBulkSaveFromAiUpload = async (submissions: VendorPriceSubmission[]) => {
    await onSaveBatch(submissions);
    showToast(`Berhasil menyimpan ${submissions.length} penawaran harga dari upload dokumen AI.`);
    setRows((prev) =>
      prev.map((r) => {
        const sub = submissions.find((s) => s.skuId === r.sku.id);
        if (sub) {
          return {
            ...r,
            existingId: sub.id,
            priceListExcludeVat: sub.priceListExcludeVat,
            discountPercent: sub.discountPercent,
            nettPriceExcludeVat: sub.nettPriceExcludeVat,
            brand: sub.vendorBrand,
            type: sub.vendorPartNumber,
            specification: sub.vendorSpecDetail || r.specification,
            isDirty: false,
          };
        }
        return r;
      })
    );
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpPageInput('');
    }
  };

  return (
    <div className="w-full space-y-2.5" onPaste={handleGlobalPaste}>
      {/* ========================================================================= */}
      {/* UNIFIED EXCEL-STYLE RIBBON TOOLBAR CARD (STICKY & ELEGANT SLATE-TINTED)   */}
      {/* ========================================================================= */}
      <div className="sticky top-16 z-30 w-full rounded-2xl border border-slate-300/90 bg-[#E2E8F0] shadow-md transition-colors dark:border-slate-800 dark:bg-[#091838] overflow-hidden backdrop-blur-md">
        {/* Top Tab Strip (Slightly Darker Tint, Not Plain White) */}
        <div className="flex items-center justify-between border-b border-slate-300/90 px-3 pt-2 bg-[#CBD5E1] dark:border-slate-800 dark:bg-[#061129]">
          <div className="flex items-center gap-1 -mb-px">
            {/* Tab 1: Cover & Profil Rekanan */}
            <button
              type="button"
              onClick={() => onChangeSubTab?.('cover')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-siloam transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'cover'
                  ? 'border-[#1B3F9B] text-[#0B2361] font-bold bg-[#E2E8F0] dark:bg-[#091838] dark:text-blue-300 dark:border-blue-400 rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white font-medium'
              }`}
            >
              <Building className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400" />
              <span>Profil Perusahaan & PIC</span>
            </button>

            {/* Tab 2: Lini Bisnis & Ketentuan Distribusi */}
            <button
              type="button"
              onClick={() => onChangeSubTab?.('terms')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-siloam transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'terms'
                  ? 'border-[#1B3F9B] text-[#0B2361] font-bold bg-[#E2E8F0] dark:bg-[#091838] dark:text-blue-300 dark:border-blue-400 rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white font-medium'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Lini Bisnis & Ketentuan Distribusi</span>
            </button>

            {/* Tab 3: Daftar SKU & Penawaran Harga */}
            <button
              type="button"
              onClick={() => onChangeSubTab?.('pricing')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-siloam transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'pricing' || activeSubTab === 'matrix'
                  ? 'border-[#1B3F9B] text-[#0B2361] font-bold bg-[#E2E8F0] dark:bg-[#091838] dark:text-blue-300 dark:border-blue-400 rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white font-medium'
              }`}
            >
              <TableProperties className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400" />
              <span>Daftar SKU & Penawaran Harga</span>
            </button>

            {/* Tab 4: Penawaran Tersimpan */}
            <button
              type="button"
              onClick={() => onChangeSubTab?.('submissions')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-siloam transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'submissions'
                  ? 'border-[#1B3F9B] text-[#0B2361] font-bold bg-[#E2E8F0] dark:bg-[#091838] dark:text-blue-300 dark:border-blue-400 rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white font-medium'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              <span>Penawaran Tersimpan ({totalSubmissionsCount || 0})</span>
            </button>
          </div>

          {/* Right Side: Help ? Icon Button & SKU Counter */}
          <div className="flex items-center gap-2 pb-1.5">
            <span className="hidden lg:inline text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {displayedRows.length} dari {masterSkus.length} SKU
            </span>

            <button
              type="button"
              onClick={onOpenQuickGuide}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-300 bg-white/90 hover:bg-white text-blue-800 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Buka Panduan 3 Langkah Pengisian Harga"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
                ?
              </span>
              <span className="hidden sm:inline">Panduan 3 Langkah</span>
            </button>
          </div>
        </div>

        {/* Ribbon Controls: Group 1 (Scope & L3/L4), Group 2 (Terms Header), Group 3 (Export & Display) */}
        <div className="p-2 sm:p-2.5 bg-[#E2E8F0] dark:bg-[#091838] overflow-x-auto">
          <div className="flex items-stretch gap-3 min-w-[940px]">
            
            {/* 1. GRUP GABUNGAN: RUANG LINGKUP & FILTER KATEGORI (LEVEL 3 & LEVEL 4) */}
            <div className="flex flex-col justify-between pr-3 border-r border-slate-300 dark:border-slate-800 flex-1 min-w-[500px]">
              <div className="space-y-1.5">
                {/* Baris Atas: Ruang Lingkup dari Cover */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                      Scope:
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-bold text-[10px] truncate max-w-[220px]"
                      title={vendor.businessScope?.level1 || 'Semua Komoditas'}
                    >
                      {vendor.businessScope?.level1 || 'Semua Komoditas'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                      ({vendor.businessScope?.level2List?.length || 0} Opsi Produk)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Baris per Halaman dipindahkan ke Ruang Lingkup */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 shadow-2xs">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Baris/Hal:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="rounded bg-transparent text-[10px] text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer"
                        title="Jumlah baris per halaman"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                        <option value={500}>500</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => onChangeSubTab?.('cover')}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 transition-colors shadow-2xs cursor-pointer"
                      title="Ubah Lini Bisnis & Opsi Produk di Tab Cover"
                    >
                      <SlidersHorizontal className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <span>Ubah di Cover</span>
                    </button>

                    {onToggleBypassScope && (
                      <button
                        type="button"
                        onClick={onToggleBypassScope}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors shadow-2xs cursor-pointer ${
                          bypassScopeFilter
                            ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title={bypassScopeFilter ? 'Sedang melihat semua SKU RS' : 'Hanya melihat SKU dalam ruang lingkup Anda'}
                      >
                        <Eye className="h-3 w-3" />
                        <span>{bypassScopeFilter ? 'Semua SKU' : 'Scope'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Baris Bawah: Filter Multi-Select Kelompok Barang & Jenis/Tipe Barang */}
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  {/* Multi-Select 1: Kelompok Barang */}
                  <div className="col-span-5 relative" ref={kelompokDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsKelompokOpen(!isKelompokOpen);
                        setIsTipeOpen(false);
                      }}
                      className="w-full flex items-center justify-between rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-750"
                      title="Pilih satu atau beberapa Kelompok Barang"
                    >
                      <span className="truncate">
                        {selectedKelompok.length === 0
                          ? 'Kelompok Barang: Semua'
                          : `${selectedKelompok.length} Kelompok Dipilih`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {selectedKelompok.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                            {selectedKelompok.length}
                          </span>
                        )}
                        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isKelompokOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Popover Dropdown Kelompok Barang */}
                    {isKelompokOpen && (
                      <div className="absolute left-0 top-full mt-1 w-72 rounded-xl border border-slate-300 bg-white p-2.5 shadow-xl z-50 dark:border-slate-700 dark:bg-slate-900 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-1.5">
                          <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                            Pilih Kelompok Barang
                          </span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={handleSelectAllKelompok}
                              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                            >
                              Semua
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={handleClearKelompok}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                            >
                              Kosongkan
                            </button>
                          </div>
                        </div>

                        {/* Search in Dropdown */}
                        <div className="relative mb-1.5">
                          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2 h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            value={searchKelompokText}
                            onChange={(e) => setSearchKelompokText(e.target.value)}
                            placeholder="Cari kelompok barang..."
                            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Checkbox List */}
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {filteredKelompokOptions.length === 0 ? (
                            <div className="py-3 text-center text-[11px] text-slate-400">
                              Tidak ada kelompok yang cocok
                            </div>
                          ) : (
                            filteredKelompokOptions.map((opt) => {
                              const isChecked = selectedKelompok.includes(opt.name);
                              return (
                                <label
                                  key={opt.name}
                                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer text-[11px]"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleKelompok(opt.name)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                    />
                                    <span className={`truncate ${isChecked ? 'font-bold text-blue-900 dark:text-blue-200' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {opt.name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                    {opt.count}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multi-Select 2: Jenis / Tipe Barang */}
                  <div className="col-span-5 relative" ref={tipeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTipeOpen(!isTipeOpen);
                        setIsKelompokOpen(false);
                      }}
                      className="w-full flex items-center justify-between rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-755"
                      title="Pilih satu atau beberapa Jenis / Tipe Barang"
                    >
                      <span className="truncate">
                        {selectedTipe.length === 0
                          ? 'Jenis / Tipe: Semua'
                          : `${selectedTipe.length} Tipe Dipilih`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {selectedTipe.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                            {selectedTipe.length}
                          </span>
                        )}
                        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isTipeOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Popover Dropdown Jenis / Tipe Barang */}
                    {isTipeOpen && (
                      <div className="absolute left-0 top-full mt-1 w-72 rounded-xl border border-slate-300 bg-white p-2.5 shadow-xl z-50 dark:border-slate-700 dark:bg-slate-900 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-1.5">
                          <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                            Pilih Jenis / Tipe Barang
                          </span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={handleSelectAllTipe}
                              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                            >
                              Semua
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={handleClearTipe}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                            >
                              Kosongkan
                            </button>
                          </div>
                        </div>

                        {/* Search in Dropdown */}
                        <div className="relative mb-1.5">
                          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2 h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            value={searchTipeText}
                            onChange={(e) => setSearchTipeText(e.target.value)}
                            placeholder="Cari jenis / tipe barang..."
                            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Checkbox List */}
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {filteredTipeOptions.length === 0 ? (
                            <div className="py-3 text-center text-[11px] text-slate-400">
                              Tidak ada tipe barang yang cocok
                            </div>
                          ) : (
                            filteredTipeOptions.map((opt) => {
                              const isChecked = selectedTipe.includes(opt.name);
                              return (
                                <label
                                  key={opt.name}
                                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer text-[11px]"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleTipe(opt.name)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                    />
                                    <span className={`truncate ${isChecked ? 'font-bold text-blue-900 dark:text-blue-200' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {opt.name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                    {opt.count}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reset Button */}
                  <div className="col-span-2 flex items-center justify-end">
                    {hasActiveTaxonomy ? (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 transition-colors cursor-pointer w-full"
                        title="Reset filter Kelompok & Jenis Barang"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 text-center w-full">Filter</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center pt-1 mt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                  Ruang Lingkup & Filter Kelompok Barang
                </span>
              </div>
            </div>

            {/* 2. GRUP: KETENTUAN HEADER PENAWARAN (DARI TAB KETENTUAN) */}
            <div className="flex flex-col justify-between pr-3 border-r border-slate-300 dark:border-slate-800 min-w-[240px] max-w-[280px] shrink-0">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Ketentuan Header:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChangeSubTab?.('terms')}
                    className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Ubah →
                  </button>
                </div>

                <div className="text-[10px] text-slate-600 dark:text-slate-300 space-y-0.5 bg-white dark:bg-slate-800/80 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="truncate">
                    Masa Berlaku: <strong>s/d {vendor.commercialTerms?.priceValidUntil || '2026-12-31'}</strong>
                  </div>
                  <div className="truncate">
                    Distribusi: <strong>{vendor.commercialTerms?.coverageType === 'all_units' ? 'Seluruh RS Siloam Nasional' : (vendor.commercialTerms?.coveredHospitalUnits?.length ? `${vendor.commercialTerms.coveredHospitalUnits.length} RS Terpilih` : 'Nasional')}</strong>
                  </div>
                </div>
              </div>

              <div className="text-center pt-1 mt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                  Ketentuan Header
                </span>
              </div>
            </div>

            {/* 3. GRUP: EXPORT & PENGATURAN TAMPILAN */}
            <div className="flex flex-col justify-between min-w-[210px] shrink-0">
              <div className="space-y-1.5">
                {/* Upload Price List AI (PDF / Excel / CSV) */}
                <button
                  type="button"
                  onClick={() => setIsAiDocUploadOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-200 px-2.5 py-1.5 text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                  title="Upload Price List PDF, Excel, atau CSV dengan AI & pairing statistik"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Upload Price List AI (PDF/Excel)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFilteredExcel}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                  title="Download template Excel untuk pengisian offline"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export Template Excel</span>
                </button>

                <ExcelTemplateExportImport
                  masterSkus={allMasterSkus ?? masterSkus}
                  vendor={vendor}
                  onBulkSuccess={handleBulkSaveFromAiUpload}
                  activeCategory={vendor.businessScope?.level1 || 'ALL'}
                />
              </div>

              <div className="text-center pt-1 mt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                  Export & Tampilan
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-blue-500 hover:text-blue-700 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* 2. TRUE EXCEL WORKBOOK GRID WITH FORMULA BAR (SEARCH & SIMPAN DOCKED DIRECTLY ATOP TABLE HEADER) */}
      <div className="w-full rounded-xl border border-slate-300 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        
        {/* EXCEL FORMULA BAR (BAR RUMUS: SEARCH SKU & TOMBOL SIMPAN TEPAT DI ATAS HEADER TABLE) */}
        <div ref={formulaBarRef} className="border-b border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-[#07132c] px-3 py-2 flex flex-wrap md:flex-nowrap items-center gap-2 select-none shadow-2xs">
          
          {/* A. Search Box Identifier */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xs text-xs font-bold"
              title="Kotak Pencarian SKU Siloam"
            >
              <Search className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400" />
              <span>Search</span>
            </div>
          </div>

          {/* B. Formula Input Box (Search SKU Siloam) */}
          <div className="flex-1 min-w-[240px] relative">
            <div className="flex items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-inner px-2.5 py-1 focus-within:border-[#1B3F9B] focus-within:ring-2 focus-within:ring-[#1B3F9B]/20 transition-all">
              <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SKU: nama komoditas, kode ERP, kategori, brand, tipe, atau spesifikasi..."
                className="min-w-0 w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white font-medium"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 ml-1.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
                  title="Bersihkan pencarian"
                >
                  Clear (✕)
                </button>
              ) : (
                <span className="shrink-0 text-[10px] font-medium text-slate-400 ml-2 hidden sm:inline">
                  {displayedRows.length} SKU cocok
                </span>
              )}
            </div>
          </div>

          {/* C. Status Filter Buttons (Semua / Terisi / Belum) */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-slate-200/80 p-0.5 dark:border-slate-700 dark:bg-slate-800 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded text-center transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Semua ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('FILLED')}
              className={`px-2.5 py-1 rounded text-center transition-all cursor-pointer ${
                statusFilter === 'FILLED'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-emerald-700 dark:text-slate-400'
              }`}
            >
              Terisi ({totalFilled})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNFILLED')}
              className={`px-2.5 py-1 rounded text-center transition-all cursor-pointer ${
                statusFilter === 'UNFILLED'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-amber-700 dark:text-slate-400'
              }`}
            >
              Belum ({unfilledCount})
            </button>
          </div>

          {/* D. TOMBOL SIMPAN (DEKAT DENGAN FORMULA & HEADER TABLE) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-siloam font-bold transition-all shadow-md cursor-pointer ${
                unsavedCount > 0
                  ? 'bg-[#1B3F9B] hover:bg-[#15337E] text-white shadow-[#1B3F9B]/30 ring-2 ring-[#1B3F9B]/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              } disabled:opacity-60`}
              title="Simpan semua penawaran harga (Shortcut: Ctrl+S)"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{unsavedCount > 0 ? `Simpan Penawaran (${unsavedCount})` : 'Simpan Penawaran'}</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* TABLE SCROLL CONTAINER (STICKY HEADER DIRECTLY UNDER FORMULA BAR) */}
        <div ref={scrollRef} className="w-full overflow-x-auto max-h-[calc(100vh-320px)] min-h-[420px] overflow-y-auto relative">
          <table ref={tableRef} className="w-full text-left text-xs border-collapse select-text bg-white dark:bg-slate-900">
            {/* Header Row like Excel Data Grid (Permanently Sticky on Scroll) */}
          <thead ref={theadRef} className="sticky top-0 z-20 bg-slate-900 text-slate-100 font-semibold text-[11px] select-none border-b-2 border-slate-700 shadow-md">
            <tr>
              <th className="sticky top-0 z-20 px-2 py-2.5 w-12 text-center border-r border-slate-700 bg-slate-900 text-slate-300">
                #
              </th>
              <th className="sticky top-0 z-20 px-3 py-2.5 min-w-[150px] max-w-[180px] border-r border-slate-700 bg-slate-900 whitespace-nowrap">
                <div className="flex items-center gap-1 text-slate-300">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Kategori RS</span>
                </div>
              </th>
              <th className="sticky top-0 z-20 px-3 py-2.5 min-w-[200px] max-w-[260px] border-r border-slate-700 bg-slate-900">
                <div className="flex items-center gap-1 text-slate-300">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Nama Item RS</span>
                </div>
              </th>
              <th className="sticky top-0 z-20 px-3 py-2.5 min-w-[260px] max-w-[340px] border-r border-slate-700 bg-slate-900">
                <div className="flex items-center gap-1 text-slate-300">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Spec Umum</span>
                </div>
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 w-20 min-w-[75px] text-center border-r-2 border-slate-500 bg-slate-900 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1 text-slate-300">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Satuan</span>
                </div>
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 min-w-[180px] border-r border-slate-700 bg-slate-850 text-blue-200 whitespace-nowrap">
                Brand *
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 min-w-[180px] border-r border-slate-700 bg-slate-850 text-blue-200 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <span>Model/PartNumber</span>
                  <span className="text-[10px] font-normal text-slate-400 bg-slate-800 px-1 py-0.5 rounded">Opsional</span>
                </div>
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 min-w-[170px] border-r border-slate-700 text-right bg-slate-850 text-blue-200 whitespace-nowrap">
                Price list EXCL. VAT *
              </th>
              <th className="sticky top-0 z-20 px-2 py-2.5 w-24 border-r border-slate-700 text-center bg-slate-850 text-blue-200 whitespace-nowrap">
                Disc (%)
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 min-w-[170px] border-r border-slate-700 text-right bg-emerald-950 text-emerald-200 whitespace-nowrap">
                Nett Price EXCL. VAT
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 min-w-[140px] border-r border-slate-700 text-right bg-slate-850 text-blue-200 whitespace-nowrap">
                <div className="flex flex-col items-end">
                  <span>LKPP Price (IDR)</span>
                  <span className="text-[10px] font-normal text-slate-400">Opsional</span>
                </div>
              </th>
              <th className="sticky top-0 z-20 px-2.5 py-2.5 min-w-[140px] bg-slate-850 text-blue-200 whitespace-nowrap">
                <div className="flex flex-col">
                  <span>Link LKPP</span>
                  <span className="text-[10px] font-normal text-slate-400">Opsional</span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-xs text-slate-400">
                  Tidak ada item yang ditemukan pada filter yang aktif.
                </td>
              </tr>
            ) : (
              <>
              {padTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={12} style={{ height: padTop, padding: 0 }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const { row, originalIndex } = paginatedRows[virtualRow.index];
                const pageIdx = virtualRow.index;
                const displayIdx = startIndex + pageIdx;
                const isComplete = Boolean(row.brand.trim() && Number(row.priceListExcludeVat) > 0);

                return (
                  <tr
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={`transition-colors border-b border-slate-300 dark:border-slate-700 ${
                      row.isCustomVariant
                        ? 'bg-purple-50/40 dark:bg-purple-950/20'
                        : row.isDirty
                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                        : isComplete
                        ? 'bg-blue-50/15 dark:bg-blue-950/10'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-850/50'
                    }`}
                  >
                    {/* 1. Index # */}
                    <td className="px-2 py-2 text-center text-[11px] text-slate-500 border-r border-slate-300 dark:border-slate-700 select-none bg-slate-50/60 dark:bg-slate-900/60 align-middle">
                      {displayIdx + 1}
                    </td>

                    {/* 2. Kategori RS (Locked) */}
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850/40 align-middle">
                      <div className="font-medium truncate" title={row.sku.level1}>
                        {row.sku.level1}
                      </div>
                    </td>

                    {/* 3. Nama Item RS (Locked) */}
                    <td className="px-3 py-2 border-r border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-850/50 align-middle">
                      <div className="font-bold text-slate-900 dark:text-white leading-tight">
                        {cleanCommodityName(row.sku.commodityName)}
                      </div>
                      {row.isCustomVariant && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          Spek Baru Diajukan
                        </span>
                      )}
                    </td>

                    {/* 4. Spec Umum (Spesifikasi Acuan RS / Alternatif Vendor) */}
                    <td className="px-3 py-2 border-r border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-850/60 align-middle">
                      {!row.isCustomVariant ? (
                        <>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-relaxed line-clamp-3" title={cleanCommodityName(row.sku.generalSpec)}>
                            {cleanCommodityName(row.sku.generalSpec) || '-'}
                          </div>

                          <div className="mt-1.5 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAddVariantRow(originalIndex)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                              title="Ajukan penawaran varian spesifikasi atau brand baru untuk kebutuhan item ini"
                            >
                              <Plus className="h-3 w-3" /> Ajukan Spek Baru
                            </button>
                          </div>
                        </>
                      ) : (
                        /* If custom variant line: vendor fills their replacement specification right here */
                        <div className="space-y-1">
                          <textarea
                            rows={2}
                            value={row.specification}
                            onChange={(e) => handleCellChange(originalIndex, 'specification', e.target.value)}
                            placeholder="Ketik spesifikasi alternatif vendor yang diajukan..."
                            className="w-full text-xs p-1.5 rounded border border-purple-300 bg-white text-slate-900 dark:border-purple-800 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-600 resize-y"
                          />

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                              Spek ini menggantikan spek RS
                            </span>

                            <button
                              type="button"
                              onClick={() => handleRemoveVariantRow(originalIndex)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-800 dark:text-red-400 hover:underline"
                            >
                              <Trash2 className="h-3 w-3" /> Hapus Line
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 5. Satuan (UOM - Locked) */}
                    <td className="px-2 py-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 border-r-2 border-slate-400 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-850/50 align-middle whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold text-[11px]">
                        {row.sku.uom || 'PCS'}
                      </span>
                    </td>

                    {/* 6. Brand (TRUE EXCEL CELL: Auto-closes on blur, bundled Brand + Model options + NP, auto-fills Model/PartNumber) */}
                    {(() => {
                      const brandModelOptions = getBrandModelOptionsForRow(row, masterSkus);
                      const filteredOptions = brandModelOptions.filter((opt) =>
                        !row.brand.trim() ||
                        opt.brand.toLowerCase().includes(row.brand.toLowerCase().trim()) ||
                        opt.model.toLowerCase().includes(row.brand.toLowerCase().trim())
                      );
                      const isNoBrand = row.brand.toLowerCase().trim() === 'nobrand' || row.brand.toLowerCase().trim() === 'no brand' || row.brand.toLowerCase().trim() === 'nb';

                      const isDropdownOpen = activeBrandDropdownRow === originalIndex;

                      return (
                        <td
                          onClick={() => setActiveBrandDropdownRow(originalIndex)}
                          className="p-0 border-r border-slate-300 dark:border-slate-700 relative align-middle focus-within:z-30 brand-autocomplete-container cursor-pointer"
                        >
                          <div className="flex flex-col justify-center min-h-[44px] px-2 py-1">
                            <input
                              type="text"
                              value={row.brand}
                              onFocus={() => setActiveBrandDropdownRow(originalIndex)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveBrandDropdownRow(originalIndex);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Enter') {
                                  setActiveBrandDropdownRow(null);
                                }
                              }}
                              onChange={(e) => handleCellChange(originalIndex, 'brand', e.target.value)}
                              placeholder="Pilih / ketik Brand..."
                              className="w-full bg-transparent border-0 outline-none rounded-none text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-850"
                            />

                            {/* Clean Status badge (NO internal ERP mentions) */}
                            {isNoBrand ? (
                              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate" title="Produk generic / tanpa merk">
                                <Tag className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">Generic (NB / NP)</span>
                              </div>
                            ) : row.brand.trim() ? (
                              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                                <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{row.brand}</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Autocomplete dropdown for Brand bundled with Model */}
                          {isDropdownOpen && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-0 top-full z-50 w-80 max-w-sm rounded-lg border border-slate-300 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800 text-xs"
                            >
                              {/* 1. Dedicated NoBrand (NB) + NP Option */}
                              <div className="mb-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCellChange(originalIndex, 'brand', 'NB');
                                    handleCellChange(originalIndex, 'type', 'NP');
                                    setActiveBrandDropdownRow(null);
                                  }}
                                  className="w-full text-left p-2 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-600 flex items-center justify-between group cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                                    <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600">NoBrand (NB)</span>
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium">
                                    Part: NP (Tanpa Merk)
                                  </span>
                                </button>
                              </div>

                              {/* 2. Brand + Model candidate options */}
                              {filteredOptions.length > 0 && (
                                <div className="mb-2">
                                  <div className="px-1 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                    <Tag className="h-3 w-3 text-blue-500" />
                                    <span>Pilihan Brand & Model:</span>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredOptions.map((opt, optIdx) => (
                                      <button
                                        key={`${opt.brand}-${opt.model}-${optIdx}`}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCellChange(originalIndex, 'brand', opt.brand);
                                          handleCellChange(originalIndex, 'type', opt.model);
                                          setActiveBrandDropdownRow(null);
                                        }}
                                        className="w-full text-left p-1.5 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-slate-600 group cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-blue-600">
                                            <span className="text-blue-600 dark:text-blue-400">{opt.brand}</span>
                                            <span className="text-slate-400">—</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{opt.model}</span>
                                          </span>
                                          {opt.isNp && (
                                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                              NP
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {filteredOptions.length === 0 && (
                                <div className="p-2 text-center text-[11px] text-slate-500 mb-1">
                                  Ketik nama merk baru jika produk Anda memiliki merk lain, atau pilih NoBrand (NB) di atas.
                                </div>
                              )}

                              <div className="text-[10px] text-slate-400 px-1 py-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <span>Model/PartNumber otomatis terisi</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBrandDropdownRow(null);
                                  }}
                                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer font-medium"
                                >
                                  Tutup
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })()}

                    {/* 7. Model/PartNumber (Directly editable cell, auto-filled from Brand choice, NO ERP mention) */}
                    <td className="p-0 border-r border-slate-300 dark:border-slate-700 relative align-middle focus-within:z-10">
                      <div className="flex flex-col justify-center min-h-[44px] px-2 py-1">
                        <input
                          type="text"
                          value={row.type}
                          onChange={(e) => handleCellChange(originalIndex, 'type', e.target.value)}
                          placeholder="Model / PartNumber..."
                          className="w-full bg-transparent border-0 outline-none rounded-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-850"
                        />

                        {/* Status text below Model/PartNumber */}
                        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {row.type.trim() && row.type.toUpperCase() !== 'NP' ? (
                            <span>Part: {row.type}</span>
                          ) : row.type.toUpperCase() === 'NP' ? (
                            <span>Standar (NP)</span>
                          ) : row.brand.trim() ? (
                            <span>NP (Opsional)</span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* 8. Price list EXCL. VAT (TRUE EXCEL CELL: Blank by default, alert if brand chosen but price empty, NO blue border) */}
                    {(() => {
                      const isPriceMissing = row.brand.trim() && (row.priceListExcludeVat === '' || Number(row.priceListExcludeVat) <= 0);

                      return (
                        <td className={`p-0 border-r border-slate-300 dark:border-slate-700 align-middle focus-within:z-10 ${
                          isPriceMissing ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}>
                          <input
                            type="number"
                            min="0"
                            value={row.priceListExcludeVat === '' ? '' : row.priceListExcludeVat}
                            onChange={(e) =>
                              handleCellChange(
                                originalIndex,
                                'priceListExcludeVat',
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            placeholder={isPriceMissing ? "Wajib diisi..." : ""}
                            className="w-full h-full min-h-[38px] px-2.5 py-1.5 bg-transparent border-0 outline-none ring-0 rounded-none text-xs text-right tabular-nums font-bold text-slate-900 dark:text-white placeholder:text-amber-500/70 focus:outline-none focus:ring-0 focus:border-0 focus:bg-white dark:focus:bg-slate-850"
                          />
                          {isPriceMissing && (
                            <div className="text-[9px] text-amber-600 font-semibold px-2 pb-0.5 text-right select-none">
                              Wajib isi harga
                            </div>
                          )}
                        </td>
                      );
                    })()}

                    {/* 9. Discount (%) (TRUE EXCEL CELL: Blank by default, NO blue border) */}
                    <td className="p-0 border-r border-slate-300 dark:border-slate-700 align-middle focus-within:z-10">
                      <div className="flex items-center justify-center h-full min-h-[38px] px-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={row.discountPercent === '' ? '' : row.discountPercent}
                          onChange={(e) =>
                            handleCellChange(
                              originalIndex,
                              'discountPercent',
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          placeholder=""
                          className="w-full h-full text-center bg-transparent border-0 outline-none ring-0 rounded-none text-xs tabular-nums text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:border-0 focus:bg-white dark:focus:bg-slate-850"
                        />
                        <span className="text-[10px] text-slate-400 select-none">%</span>
                      </div>
                    </td>

                    {/* 10. Nett Price EXCL. VAT (Read-only cell, No Monospace font) */}
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-slate-900 dark:text-white border-r border-slate-300 dark:border-slate-700 bg-emerald-50/40 dark:bg-emerald-950/20 align-middle whitespace-nowrap">
                      {row.nettPriceExcludeVat > 0 ? (
                        <div>
                          <div>Rp {row.nettPriceExcludeVat.toLocaleString('id-ID')}</div>
                          <div className="text-[9px] font-normal text-slate-400">
                            + PPN: Rp {vendorService.calculatePriceWithTax(row.nettPriceExcludeVat, 11).toLocaleString('id-ID')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* 11. LKPP Price (MOVED TO RIGHT END: TRUE EXCEL CELL, NO blue border) */}
                    <td className="p-0 border-r border-slate-300 dark:border-slate-700 align-middle focus-within:z-10">
                      <input
                        type="number"
                        min="0"
                        value={row.lkppPrice === '' ? '' : row.lkppPrice}
                        onChange={(e) =>
                          handleCellChange(
                            originalIndex,
                            'lkppPrice',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder=""
                        className="w-full h-full min-h-[38px] px-2.5 py-1.5 bg-transparent border-0 outline-none ring-0 rounded-none text-xs text-right tabular-nums text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:border-0 focus:bg-white dark:focus:bg-slate-850"
                      />
                    </td>

                    {/* 13. Link LKPP Price (MOVED TO RIGHT END: TRUE EXCEL CELL, last column, NO blue border) */}
                    <td className="p-0 align-middle focus-within:z-10">
                      <div className="flex items-center h-full min-h-[38px] pr-1.5">
                        <input
                          type="text"
                          value={row.linkLkppPrice}
                          onChange={(e) =>
                            handleCellChange(originalIndex, 'linkLkppPrice', e.target.value)
                          }
                          placeholder="https://..."
                          className="w-full h-full px-2.5 py-1.5 bg-transparent border-0 outline-none ring-0 rounded-none text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:border-0 focus:bg-white dark:focus:bg-slate-850"
                        />
                        {/^https?:\/\//i.test(row.linkLkppPrice ?? '') && (
                          <a
                            href={row.linkLkppPrice}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600 p-0.5 shrink-0"
                            title="Buka Link LKPP"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={12} style={{ height: padBottom, padding: 0 }} />
                </tr>
              )}
              </>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* 3. BOTTOM CORPORATE PAGINATION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs shadow-2xs">
        {/* Left: Summary & Per-Page selector */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            Menampilkan <strong className="text-slate-900 dark:text-white font-semibold">{totalFilteredRows > 0 ? startIndex + 1 : 0}</strong> - <strong className="text-slate-900 dark:text-white font-semibold">{endIndex}</strong> dari <strong className="text-slate-900 dark:text-white font-semibold">{totalFilteredRows}</strong> baris ({rows.length} total SKU)
          </span>

          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
            <span className="text-slate-500">Per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Right: Page Navigation & Jump */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={activePage === 1}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Sebelumnya</span>
            </button>

            <span className="px-3 py-1 font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
              Halaman {activePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage >= totalPages}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={activePage >= totalPages}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick Jump Input */}
          {totalPages > 2 && (
            <form onSubmit={handleJumpToPage} className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 text-[11px]">Ke:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={String(activePage)}
                className="w-12 rounded border border-slate-300 px-1.5 py-0.5 text-center text-xs dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Go
              </button>
            </form>
          )}
        </div>
      </div>

      {/* AI Document Price List Uploader Modal (PDF, Excel, CSV) */}
      <AiDocumentPriceListUploaderModal
        isOpen={isAiDocUploadOpen}
        onClose={() => setIsAiDocUploadOpen(false)}
        masterSkus={masterSkus}
        allMasterSkus={allMasterSkus || masterSkus}
        vendor={vendor}
        onBulkSaveSubmissions={handleBulkSaveFromAiUpload}
      />
    </div>
  );
};
