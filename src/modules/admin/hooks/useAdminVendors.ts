import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { VendorProfile, SupplierStatus } from '../../../core/types';
import { deleteVendorDoc, fetchStaffVendors, patchVendor, registerVendor } from '../../../core/api/session';
import { useSkuTaxonomy } from '../../../core/api/catalog';
import { matchesSearch, searchTokens } from '../../../core/search';

export function useAdminVendors() {
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [vendorSubmissionCounts, setVendorSubmissionCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'erp' | 'new'>('new');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [level1Filter, setLevel1Filter] = useState<string>('all');

  const loadVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const fromApi = await fetchStaffVendors();
      setVendorSubmissionCounts(fromApi.offerCounts);
      setVendors(fromApi.vendors);
    } catch (err) {
      console.error('Error loading vendors in useAdminVendors:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Split into ERP Vendors vs New (non-ERP) Vendors
  const erpVendorsList = useMemo(() => {
    return vendors.filter((v) => v.isExistingSupplier === true || Boolean(v.erpVendorCode));
  }, [vendors]);

  const newVendorsList = useMemo(() => {
    return vendors.filter((v) => !v.isExistingSupplier && !v.erpVendorCode);
  }, [vendors]);

  const taxonomy = useSkuTaxonomy();
  const vendorLevel1s = useCallback(
    (v: VendorProfile) => {
      const set = new Set([v.businessScope?.level1, v.category]);
      for (const l2 of v.businessScope?.level2List ?? []) {
        set.add(taxonomy.find((t) => t.level2.some((x) => x.name === l2))?.level1);
      }
      set.delete(undefined);
      set.delete('');
      return set as Set<string>;
    },
    [taxonomy],
  );

  // Filter helper for both lists
  const filterList = (list: VendorProfile[]) => {
    const tokens = searchTokens(searchQuery);
    return list.filter((v) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (v.status !== statusFilter) return false;
      }

      // Level 1 category filter
      if (level1Filter !== 'all') {
        if (!vendorLevel1s(v).has(level1Filter)) return false;
      }

      // Search query
      return matchesSearch(tokens, v.companyName, v.erpVendorCode, v.npwp, v.email, v.authorizedPerson, v.phone, v.businessScope?.level1);
    });
  };

  const filteredErpVendors = useMemo(() => filterList(erpVendorsList), [erpVendorsList, searchQuery, statusFilter, level1Filter, vendorLevel1s]);
  const filteredNewVendors = useMemo(() => filterList(newVendorsList), [newVendorsList, searchQuery, statusFilter, level1Filter, vendorLevel1s]);

  // Statistics
  const stats = useMemo(() => {
    const total = vendors.length;
    const erp = erpVendorsList.length;
    const newVendors = newVendorsList.length;
    const pendingVerification = newVendorsList.filter((v) => v.status === 'prospect' || !v.verified).length;
    const verifiedNew = newVendorsList.filter((v) => v.status === 'verified').length;

    return {
      total,
      erp,
      newVendors,
      pendingVerification,
      verifiedNew,
    };
  }, [vendors, erpVendorsList, newVendorsList]);

  // Category Level 1 Options
  const level1Options = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => vendorLevel1s(v).forEach((l1) => set.add(l1)));
    return Array.from(set).sort();
  }, [vendors, vendorLevel1s]);

  // 1. Promote New Vendor to ERP Master
  const promoteNewVendorToErp = async (
    vendorId: string,
    erpVendorCode: string,
    notes?: string
  ): Promise<VendorProfile> => {
    const target = vendors.find((v) => v.id === vendorId);
    if (!target) throw new Error('Vendor tidak ditemukan');

    const saved = await patchVendor(vendorId, {
      erpVendorCode: erpVendorCode.trim(),
      isExistingSupplier: true,
      status: 'verified',
      verified: true,
      source: 'erp_upload',
      notes: notes || target.notes,
    });
    setVendors((prev) => prev.map((v) => (v.id === vendorId ? saved : v)));
    return saved;
  };

  // 2. Update Vendor Verification Status
  const updateVendorStatus = async (
    vendorId: string,
    status: SupplierStatus,
    verified: boolean,
    notes?: string
  ): Promise<VendorProfile> => {
    const target = vendors.find((v) => v.id === vendorId);
    if (!target) throw new Error('Vendor tidak ditemukan');

    const saved = await patchVendor(vendorId, {
      status,
      verified,
      notes: notes !== undefined ? notes : target.notes,
    });
    setVendors((prev) => prev.map((v) => (v.id === vendorId ? saved : v)));
    return saved;
  };

  // 3. Save / Update Single Vendor
  const saveVendor = async (vendor: VendorProfile): Promise<VendorProfile> => {
    const exists = vendors.some((v) => v.id === vendor.id);
    let id = vendor.id;
    if (!exists) {
      const created = await registerVendor({
        companyName: vendor.companyName,
        email: vendor.email,
        phone: vendor.phone,
        authorizedPerson: vendor.authorizedPerson,
        npwp: vendor.npwp,
        password: vendor.password || undefined,
      });
      id = created.id;
    }
    const saved = await patchVendor(id, {
      companyName: vendor.companyName,
      address: vendor.address,
      authorizedPerson: vendor.authorizedPerson,
      email: vendor.email,
      phone: vendor.phone,
      npwp: vendor.npwp,
      businessScope: vendor.businessScope,
      erpVendorCode: vendor.erpVendorCode,
      isExistingSupplier: vendor.isExistingSupplier,
      status: vendor.status,
      verified: vendor.verified,
      source: vendor.source,
      notes: vendor.notes,
    });
    setVendors((prev) => {
      const idx = prev.findIndex((v) => v.id === vendor.id || v.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    return saved;
  };

  // 4. Delete Vendor
  const deleteVendor = async (vendorId: string): Promise<void> => {
    await deleteVendorDoc(vendorId);
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
  };

  // 5. Bulk Import ERP Vendors from Excel / CSV
  const bulkImportErpVendors = async (
    newErpVendors: Partial<VendorProfile>[]
  ): Promise<number> => {
    let count = 0;
    for (const raw of newErpVendors) {
      const companyName = raw.companyName?.trim() || '';
      const email = raw.email?.trim() || '';
      const phone = raw.phone?.trim() || '';
      if (!companyName || !email.includes('@') || !phone) {
        throw new Error('Setiap baris wajib punya nama perusahaan, email PIC, dan WhatsApp PIC.');
      }
      await saveVendor({
        id: raw.id || `vnd-erp-${Date.now()}-${count}`,
        erpVendorCode: raw.erpVendorCode?.trim() || `VND-ERP-${Math.floor(10000 + Math.random() * 90000)}`,
        companyName,
        email,
        phone,
        npwp: raw.npwp || '',
        address: raw.address || '',
        authorizedPerson: raw.authorizedPerson || '',
        verified: true,
        status: 'verified',
        isExistingSupplier: true,
        source: 'erp_upload',
        registrationDate: raw.registrationDate || new Date().toISOString(),
        category: raw.category || '',
        notes: raw.notes || '',
        password: raw.password && raw.password.length >= 6 ? raw.password : undefined,
        businessScope: raw.businessScope,
      });
      count += 1;
    }
    await loadVendors();
    return count;
  };

  // 6. Export to Excel
  const exportVendorsToExcel = (type: 'all' | 'erp' | 'new') => {
    let sourceList: VendorProfile[] = [];
    let sheetName = 'Master_Vendor';
    let fileName = 'Master_Vendor.xlsx';

    if (type === 'erp') {
      sourceList = erpVendorsList;
      sheetName = 'Vendor_ERP';
      fileName = 'Daftar_Vendor_ERP.xlsx';
    } else if (type === 'new') {
      sourceList = newVendorsList;
      sheetName = 'Vendor_Baru_Non_ERP';
      fileName = 'Daftar_Vendor_Baru_Non_ERP.xlsx';
    } else {
      sourceList = vendors;
      fileName = 'Seluruh_Vendor_Rekanan.xlsx';
    }

    const rows = sourceList.map((v, i) => ({
      'No': i + 1,
      'Tipe Rekanan': v.isExistingSupplier ? 'Rekanan ERP Terdaftar' : 'Vendor Baru (Non-ERP)',
      'Kode Vendor ERP': v.erpVendorCode || '-',
      'Nama Perusahaan': v.companyName,
      'NPWP': v.npwp,
      'Email Resmi': v.email,
      'No. Telepon / HP': v.phone,
      'Nama PIC': v.authorizedPerson,
      'Alamat': v.address || '-',
      'Lini Bisnis Utama': v.businessScope?.level1 || v.category || '-',
      'Opsi Produk (L2)': v.businessScope?.level2List?.join(', ') || '-',
      'Status Verifikasi': v.status.toUpperCase(),
      'Status Terverifikasi': v.verified ? 'Ya (Aktif)' : 'Belum Terverifikasi',
      'Tanggal Registrasi': v.registrationDate ? new Date(v.registrationDate).toLocaleDateString('id-ID') : '-',
      'Jumlah Penawaran Tender': vendorSubmissionCounts[v.id] || 0,
      'Catatan': v.notes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  };

  return {
    vendors,
    erpVendors: filteredErpVendors,
    newVendors: filteredNewVendors,
    allErpVendors: erpVendorsList,
    allNewVendors: newVendorsList,
    isLoading,
    stats,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    level1Filter,
    setLevel1Filter,
    level1Options,
    vendorSubmissionCounts,
    promoteNewVendorToErp,
    updateVendorStatus,
    saveVendor,
    deleteVendor,
    bulkImportErpVendors,
    exportVendorsToExcel,
    refresh: loadVendors,
  };
}
