import React, { useState, useMemo } from 'react';
import { vendorService } from '../modules/vendor/services/vendorService';
import { useVendorProfile } from '../modules/vendor/hooks/useVendorProfile';
import { useVendorCatalog } from '../modules/vendor/hooks/useVendorCatalog';
import { MasterSku, VendorPriceSubmission, BusinessScope, VendorProfile } from '../core/types';
import { Header } from '../core/ui/Header';
import { VendorPriceModal } from '../modules/vendor/components/VendorPriceModal';
import { VendorSubmissionList } from '../modules/vendor/components/VendorSubmissionList';
import { AiSkuMatcherModal } from '../modules/vendor/components/AiSkuMatcherModal';
import { VendorSpreadsheetGrid } from '../modules/vendor/components/VendorSpreadsheetGrid';
import { VendorCoverProfileTab } from '../modules/vendor/components/VendorCoverProfileTab';
import { VendorCommercialTermsTab } from '../modules/vendor/components/VendorCommercialTermsTab';
import { VendorScopeOnboardingModal } from '../modules/vendor/components/VendorScopeOnboardingModal';
import { VendorQuickGuideModal } from '../modules/vendor/components/VendorQuickGuideModal';
import { VendorChangePasswordModal } from '../modules/vendor/components/VendorChangePasswordModal';
import { TableProperties, ClipboardList, Building, ShieldCheck } from 'lucide-react';
import { useUrlTab } from '../core/router/useAppRouter';

const PORTAL_TABS = ['cover', 'terms', 'pricing', 'submissions'] as const;

interface VendorPortalPageProps {
  onLogoutOrChangeCompany?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const VendorPortalPage: React.FC<VendorPortalPageProps> = ({
  onLogoutOrChangeCompany,
  isDark = false,
  onToggleTheme = () => {},
}) => {
  const {
    currentVendor,
    updateBusinessScope,
    updateVendorProfile,
  } = useVendorProfile();

  // "Semua SKU" asks the server for every open SKU instead of the declared scope.
  const [bypassScopeFilter, setBypassScopeFilter] = useState(false);
  const catalog = useVendorCatalog(
    currentVendor?.id
      ? { id: currentVendor.id, companyName: currentVendor.companyName, email: currentVendor.email }
      : undefined,
    JSON.stringify(currentVendor?.businessScope ?? null),
    bypassScopeFilter,
  );
  const allSkus = catalog.skus ?? [];
  const submissions = catalog.submissions ?? [];

  const saveSubmission = async (item: VendorPriceSubmission) => {
    const saved = await vendorService.saveSubmission(item);
    catalog.upsert(saved);
    return saved;
  };
  const bulkSave = async (items: VendorPriceSubmission[]) => {
    const saved = await vendorService.bulkSaveSubmissions(items);
    saved.forEach((item) => catalog.upsert(item));
  };
  const deleteSubmission = async (id: string) => {
    await vendorService.deleteSubmission(id, currentVendor.id);
    catalog.remove(id);
  };

  // Sub-tabs: 'cover' (Profil Perusahaan & PIC) | 'terms' (Lini Bisnis & Ketentuan Distribusi) | 'pricing' (Daftar SKU & Penawaran Harga) | 'submissions' (Daftar Penawaran Tersimpan)
  const [activeSubTab, setActiveSubTab] = useUrlTab('tab', PORTAL_TABS);
  const [selectedSkuForPrice, setSelectedSkuForPrice] = useState<MasterSku | null>(null);
  const [selectedExistingSubmission, setSelectedExistingSubmission] = useState<VendorPriceSubmission | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isAiMatcherOpen, setIsAiMatcherOpen] = useState(false);

  // Business Scope Modal state
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  // 3-Step Quick Guide Modal (Popup triggered by '?' icon)
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(false);

  // Change Password Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Handle saving Business Scope
  const handleSaveScope = async (scope: BusinessScope) => {
    await updateBusinessScope(currentVendor.id, scope);
    setBypassScopeFilter(false);
  };

  // Handle updating Commercial Terms
  const handleUpdateTerms = async (terms: any) => {
    await updateVendorProfile(currentVendor.id, { commercialTerms: terms });
  };

  // ONLY ACTIVE SKUs (Deactive / archived ERP SKUs are strictly hidden from vendor view)
  const activeAllSkus = useMemo(() => {
    return allSkus.filter((sku) => {
      const isDeactive = sku.status === 'archived' || sku.isActive === false;
      return !isDeactive && sku.isOpenForVendor;
    });
  }, [allSkus]);


  const handleOpenPriceModal = (sku: MasterSku, existing?: VendorPriceSubmission | null) => {
    setSelectedSkuForPrice(sku);
    setSelectedExistingSubmission(existing || null);
    setIsPriceModalOpen(true);
  };

  const handleAiSelectMatched = (matchedSku: MasterSku, prefilled: any) => {
    setSelectedSkuForPrice(matchedSku);
    setSelectedExistingSubmission({
      id: '',
      skuId: matchedSku.id,
      skuErpCode: matchedSku.erpCode,
      vendorId: currentVendor.id,
      vendorName: currentVendor.companyName,
      vendorEmail: currentVendor.email,
      commodityName: matchedSku.commodityName,
      generalSpec: matchedSku.generalSpec,
      vendorBrand: prefilled.vendorBrand || '',
      vendorPartNumber: prefilled.vendorPartNumber || '',
      fullFormattedSkuName: '',
      priceListExcludeVat: prefilled.estimatedPrice || 0,
      discountPercent: 0,
      nettPriceExcludeVat: prefilled.estimatedPrice || 0,
      unitPrice: prefilled.estimatedPrice || 0,
      taxPercent: 11,
      priceWithTax: 0,
      uom: matchedSku.uom,
      moq: 1,
      leadTimeDays: 7,
      priceValidUntil: '2026-12-31',
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsPriceModalOpen(true);
  };

  const handleEditSubmission = (sub: VendorPriceSubmission) => {
    const parentSku = allSkus.find((s) => s.id === sub.skuId) || {
      id: sub.skuId,
      erpCode: sub.skuErpCode,
      level1: 'General Equipment',
      level2: 'Umum',
      level3: 'Produk Medis',
      level4: 'Standar RS',
      commodityName: sub.commodityName,
      generalSpec: sub.generalSpec,
      uom: sub.uom,
      isOpenForVendor: true,
      status: 'active',
      createdAt: '',
      updatedAt: '',
    };
    handleOpenPriceModal(parentSku, sub);
  };

  const tabBtn = (id: (typeof PORTAL_TABS)[number], label: string, icon: React.ReactNode) => {
    const active = activeSubTab === id || (id === 'pricing' && (activeSubTab as string) === 'matrix');
    return (
      <button
        type="button"
        onClick={() => setActiveSubTab(id)}
        className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-siloam transition-all cursor-pointer border-b-2 ${
          active
            ? 'border-[#1B3F9B] text-[#0B2361] font-bold bg-[#E2E8F0] dark:bg-[#091838] dark:text-blue-300 dark:border-blue-400 rounded-t-lg shadow-2xs'
            : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white font-medium'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-2.5">
      <Header
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        vendorName={currentVendor.companyName}
        vendorStatus={currentVendor.status}
        onOpenQuickGuide={() => setIsQuickGuideOpen(true)}
        onLogout={onLogoutOrChangeCompany}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {/* One shared tab bar — same chrome on every menu (no layout jump). */}
      <div className="sticky top-16 z-30 w-full rounded-2xl border border-slate-300/90 bg-[#E2E8F0] shadow-md transition-colors dark:border-slate-800 dark:bg-[#091838] overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-300/90 px-3 pt-2 bg-[#CBD5E1] dark:border-slate-800 dark:bg-[#061129]">
          <div className="flex items-center gap-1 -mb-px overflow-x-auto">
            {tabBtn('cover', 'Profil Perusahaan & PIC', <Building className="h-3.5 w-3.5 text-[#1B3F9B] dark:text-blue-400 shrink-0" />)}
            {tabBtn('terms', 'Lini Bisnis & Ketentuan Distribusi', <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />)}
            {tabBtn('pricing', 'Daftar SKU & Penawaran Harga', <TableProperties className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 shrink-0" />)}
            {tabBtn('submissions', 'Penawaran Tersimpan', <ClipboardList className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 shrink-0" />)}
          </div>
          <div className="flex items-center gap-2 pb-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsQuickGuideOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-300 bg-white/90 hover:bg-white text-blue-800 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">?</span>
              <span className="hidden sm:inline">Panduan 3 Langkah</span>
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'cover' && (
        <VendorCoverProfileTab
          vendor={currentVendor}
          onUpdateProfile={updateVendorProfile}
          onNavigateToPricing={() => setActiveSubTab('pricing')}
          onNavigateToTerms={() => setActiveSubTab('terms')}
          onNavigateToMatrix={() => setActiveSubTab('pricing')}
          onOpenQuickGuide={() => setIsQuickGuideOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        />
      )}

      {activeSubTab === 'terms' && (
        <VendorCommercialTermsTab
          vendor={currentVendor}
          onUpdateTerms={handleUpdateTerms}
          onUpdateScope={(_id, scope) => handleSaveScope(scope)}
          onNavigateToPricing={() => setActiveSubTab('pricing')}
          onOpenQuickGuide={() => setIsQuickGuideOpen(true)}
        />
      )}

      {(activeSubTab === 'pricing' || (activeSubTab as string) === 'matrix') && (
        <VendorSpreadsheetGrid
          masterSkus={activeAllSkus}
          allMasterSkus={activeAllSkus}
          vendor={currentVendor}
          initialSubmissions={submissions}
          onSaveBatch={bulkSave}
          onOpenAiMatcher={() => setIsAiMatcherOpen(true)}
          onOpenScopeModal={() => setIsScopeModalOpen(true)}
          onOpenQuickGuide={() => setIsQuickGuideOpen(true)}
          bypassScopeFilter={bypassScopeFilter}
          onToggleBypassScope={() => setBypassScopeFilter((prev) => !prev)}
          activeSubTab={activeSubTab}
          onChangeSubTab={(tab) => setActiveSubTab(tab as any)}
          totalSubmissionsCount={submissions.length}
          totalAllSkusCount={activeAllSkus.length}
          hideNavTabs
        />
      )}

      {activeSubTab === 'submissions' && (
        <VendorSubmissionList
          submissions={submissions}
          onEdit={handleEditSubmission}
          onDelete={deleteSubmission}
        />
      )}

      {/* POP-UP MODAL: PANDUAN SINGKAT 3 LANGKAH PENGISIAN HARGA */}
      <VendorQuickGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
      />

      {/* POP-UP MODAL: UBAH / BUAT PASSWORD REKANAN */}
      <VendorChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        accountName={currentVendor.companyName}
      />

      {/* Business Scope Onboarding Modal */}
      <VendorScopeOnboardingModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        vendor={currentVendor}
        onSaveScope={handleSaveScope}
      />

      {/* Modal Single Price Registration */}
      <VendorPriceModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        sku={selectedSkuForPrice}
        vendor={currentVendor}
        existingSubmission={selectedExistingSubmission}
        onSave={async (sub) => {
          await saveSubmission(sub);
          setIsPriceModalOpen(false);
        }}
      />

      {/* AI Smart SKU Matcher Modal */}
      <AiSkuMatcherModal
        isOpen={isAiMatcherOpen}
        onClose={() => setIsAiMatcherOpen(false)}
        masterSkus={activeAllSkus}
        onSelectMatchedSku={handleAiSelectMatched}
      />
    </div>
  );
};
