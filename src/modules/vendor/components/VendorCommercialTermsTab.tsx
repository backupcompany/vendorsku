import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Truck,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Save,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  DollarSign,
  HelpCircle,
  Search,
  CheckSquare,
  Square,
  BadgePercent,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { VendorProfile, CommercialTerms, HospitalUnit, BusinessScope } from '../../../core/types';
import { hospitalService } from '../../../core/services/hospitalService';
import { Button } from '../../../core/ui/Button';
import { VendorBusinessScopeCard } from './VendorBusinessScopeCard';
import { useOptions } from '../../../core/api/options';
import { matchesSearch, searchTokens } from '../../../core/search';

interface VendorCommercialTermsTabProps {
  vendor: VendorProfile;
  onUpdateTerms: (terms: CommercialTerms) => Promise<void>;
  onUpdateScope: (vendorId: string, scope: BusinessScope) => Promise<void>;
  onNavigateToPricing: () => void;
  onOpenQuickGuide?: () => void;
}

export const VendorCommercialTermsTab: React.FC<VendorCommercialTermsTabProps> = ({
  vendor,
  onUpdateTerms,
  onUpdateScope,
  onNavigateToPricing,
  onOpenQuickGuide,
}) => {
  const existingTerms = vendor.commercialTerms;
  const regionalGroups = useOptions('hospital_region').map((o) => ({ name: o.label, units: (o.meta.units as string[]) ?? [] }));
  const taxConditions = useOptions('tax_condition');

  // 1. Price Validity Period
  const [validFrom, setValidFrom] = useState(
    existingTerms?.validFrom || new Date().toISOString().split('T')[0]
  );
  const [priceValidUntil, setPriceValidUntil] = useState(
    existingTerms?.priceValidUntil || '2026-12-31'
  );
  const [commitmentPeriodMonths, setCommitmentPeriodMonths] = useState<number>(
    existingTerms?.commitmentPeriodMonths || 12
  );

  // 2. Hospital Coverage
  const [allHospitals, setAllHospitals] = useState<HospitalUnit[]>([]);
  const [coverageType, setCoverageType] = useState<'all_units' | 'selected_units'>(
    existingTerms?.coverageType || 'all_units'
  );
  const [coveredUnits, setCoveredUnits] = useState<string[]>(
    existingTerms?.coveredHospitalUnits && existingTerms.coveredHospitalUnits.length > 0
      ? existingTerms.coveredHospitalUnits
      : []
  );
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');

  // Load active hospitals from database on mount
  useEffect(() => {
    hospitalService.getActiveHospitals().then((list) => {
      if (!list?.length) return;
      setAllHospitals(list);
      setCoveredUnits((prev) => (prev.length > 0 ? prev : list.map((h) => h.name)));
    }).catch(console.error);
  }, []);

  // 3. Commercial & Delivery Terms
  const [currency] = useState('IDR');
  const [taxCondition, setTaxCondition] = useState<'exclude_vat_11' | 'include_vat_11'>(
    existingTerms?.taxCondition || 'exclude_vat_11'
  );
  const [leadTimeDays, setLeadTimeDays] = useState<number>(
    existingTerms?.standardLeadTimeDays || 7
  );
  const [moq, setMoq] = useState<number>(existingTerms?.standardMoq || 1);
  const [deliveryTerm, setDeliveryTerm] = useState(
    existingTerms?.deliveryTerm || 'Franco Rumah Sakit Siloam (Bebas Ongkir Pengiriman)'
  );
  const [paymentTerm, setPaymentTerm] = useState(
    existingTerms?.paymentTerm || '30 Hari Kalender setelah Faktur & BAST Diterima (TOP 30)'
  );
  const [warrantyGeneral, setWarrantyGeneral] = useState(
    existingTerms?.warrantyGeneral || 'Garansi Resmi 1 Tahun Penuh Sparepart & Servis'
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    existingTerms?.additionalNotes || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Quick preset duration
  const handlePresetDuration = (months: number, targetDate: string) => {
    setCommitmentPeriodMonths(months);
    setPriceValidUntil(targetDate);
  };

  // Toggle hospital unit
  const handleToggleHospital = (unit: string) => {
    setCoveredUnits((prev) => {
      if (prev.includes(unit)) {
        return prev.filter((u) => u !== unit);
      } else {
        return [...prev, unit];
      }
    });
  };

  const handleSelectAllHospitals = () => {
    setCoveredUnits(allHospitals.map((h) => h.name));
  };

  const handleClearAllHospitals = () => {
    setCoveredUnits([]);
  };

  // Filtered hospital list
  const filteredHospitals = useMemo(() => {
    let list = allHospitals;
    if (selectedRegion !== 'ALL') {
      const reg = regionalGroups.find((r) => r.name === selectedRegion);
      if (reg) {
        list = list.filter((h) => reg.units.includes(h.name));
      } else {
        list = list.filter((h) => h.island === selectedRegion);
      }
    }
    const tokens = searchTokens(hospitalSearch);
    if (tokens.length) list = list.filter((h) => matchesSearch(tokens, h.name, h.code, h.city, h.island));
    return list;
  }, [allHospitals, selectedRegion, hospitalSearch]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const terms: CommercialTerms = {
        validFrom,
        priceValidUntil,
        commitmentPeriodMonths,
        coverageType,
        coveredHospitalUnits: coverageType === 'all_units' ? allHospitals.map((h) => h.name) : coveredUnits,
        currency,
        taxCondition,
        standardLeadTimeDays: leadTimeDays,
        standardMoq: moq,
        deliveryTerm: deliveryTerm.trim(),
        paymentTerm: paymentTerm.trim(),
        warrantyGeneral: warrantyGeneral.trim(),
        additionalNotes: additionalNotes.trim(),
        updatedAt: new Date().toISOString(),
      };

      await onUpdateTerms(terms);
      setIsSaving(false);
      setSaveSuccessMsg('Ketentuan komersial & cakupan distribusi berhasil disimpan! Nilai ini otomatis menjadi ketentuan standar untuk penawaran harga SKU Anda.');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      setIsSaving(false);
      alert('Gagal menyimpan ketentuan komersial: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Lini Bisnis & Ketentuan Komersial Tingkat Header</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-siloam font-bold text-slate-900 dark:text-white">
              Lini Bisnis &amp; Ketentuan Distribusi Penawaran
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Tentukan kategori produk yang Anda suplai (Lini Bisnis Level 1 &amp; Level 2), masa berlaku harga, cakupan unit Rumah Sakit Siloam yang dilayani, dan syarat pengiriman secara terpusat.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenQuickGuide && (
              <button
                type="button"
                onClick={onOpenQuickGuide}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer shadow-2xs"
              >
                <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Panduan</span>
              </button>
            )}

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSave}
              isLoading={isSaving}
              icon={<Save className="h-4 w-4" />}
              className="text-xs font-bold shadow-md shadow-blue-600/20"
            >
              Simpan Ketentuan
            </Button>
          </div>
        </div>

        {/* Success Notice Banner */}
        {saveSuccessMsg && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{saveSuccessMsg}</p>
                <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                  Anda dapat langsung melanjutkan ke daftar penawaran harga SKU untuk memasukkan harga satuan komoditas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToPricing}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
            >
              <span>Masukkan Penawaran Harga pada Daftar SKU Siloam</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: LINI BISNIS & OPSI PRODUK YANG DIJUAL */}
      <VendorBusinessScopeCard
        vendor={vendor}
        onUpdateScope={onUpdateScope}
        onNavigateToPricing={onNavigateToPricing}
      />

      {/* Main Commercial Terms Sections Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* SECTION 2: MASA BERLAKU HARGA */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                2. Masa Berlaku Penawaran Harga
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tentukan jangka waktu berlakunya harga penawaran yang Anda berikan kepada Siloam Hospitals Group.
              </p>
            </div>
          </div>

          {/* Form Fields: Single Column Layout */}
          <div className="space-y-4 pt-1">
            {/* Tanggal Mulai */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tanggal Mulai Berlaku
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
              <span className="text-[11px] text-slate-400">Tanggal penawaran resmi dimulai</span>
            </div>

            {/* Batas Akhir Masa Berlaku */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Batas Akhir Berlaku (Valid Sampai)
              </label>
              <input
                type="date"
                value={priceValidUntil}
                onChange={(e) => setPriceValidUntil(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold text-blue-700 dark:text-blue-400"
                required
              />
              <span className="text-[11px] text-slate-400">Harga penawaran mengikat sampai tanggal ini</span>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Pilihan Durasi Cepat (Klik untuk Otomatis Mengisi Batas Akhir)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetDuration(12, '2026-12-31')}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                    priceValidUntil === '2026-12-31'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold ring-1 ring-blue-600/30'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Akhir 2026 (1 Tahun)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDuration(24, '2027-12-31')}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                    priceValidUntil === '2027-12-31'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold ring-1 ring-blue-600/30'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Akhir 2027 (2 Tahun)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDuration(6, '2026-06-30')}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                    priceValidUntil === '2026-06-30'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold ring-1 ring-blue-600/30'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  6 Bulan (Semester 1)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDuration(3, '2026-03-31')}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                    priceValidUntil === '2026-03-31'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold ring-1 ring-blue-600/30'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  3 Bulan (Kuartal 1)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: CAKUPAN & DISTRIBUSI RUMAH SAKIT SILOAM */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  3. Cakupan Distribusi Rumah Sakit Siloam
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tentukan unit Rumah Sakit Siloam yang dapat di-cover untuk distribusi dan pengiriman produk.
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
              <Building2 className="h-3.5 w-3.5" />
              <span>
                {coverageType === 'all_units'
                  ? `Seluruh ${allHospitals.length} RS Siloam Nasional`
                  : `${coveredUnits.length} dari ${allHospitals.length} RS Terpilih`}
              </span>
            </span>
          </div>

          {/* Toggle Type: All Units vs Specific Units (Single Column Stack) */}
          <div className="flex flex-col gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setCoverageType('all_units');
                setCoveredUnits(allHospitals.map((h) => h.name));
              }}
              className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                coverageType === 'all_units'
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-700 shadow-xs ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850'
              }`}
            >
              <div className={`flex h-5 w-5 rounded-full items-center justify-center border mt-0.5 shrink-0 ${
                coverageType === 'all_units' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
              }`}>
                {coverageType === 'all_units' && <CheckCircle2 className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Cakupan Seluruh Unit RS Siloam Nasional (Rekomendasi Utama)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 font-bold shrink-0">
                    Poin Tertinggi
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Mendukung pengiriman ke seluruh {allHospitals.length || '…'} Rumah Sakit Siloam di seluruh Indonesia. Memberikan poin evaluasi tender tertinggi.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCoverageType('selected_units')}
              className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                coverageType === 'selected_units'
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-700 shadow-xs ring-1 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850'
              }`}
            >
              <div className={`flex h-5 w-5 rounded-full items-center justify-center border mt-0.5 shrink-0 ${
                coverageType === 'selected_units' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
              }`}>
                {coverageType === 'selected_units' && <CheckCircle2 className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  Unit / Wilayah Rumah Sakit Tertentu
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Pilih unit rumah sakit atau wilayah spesifik yang sanggup dilayani oleh jaringan logistik Anda.
                </div>
              </div>
            </button>
          </div>

          {/* Hospital Unit Selector (Visible when selected_units) */}
          {coverageType === 'selected_units' && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-850/50 space-y-3.5">
              {/* Region Filter & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedRegion('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                      selectedRegion === 'ALL'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Semua Wilayah
                  </button>
                  {regionalGroups.map((reg) => (
                    <button
                      key={reg.name}
                      type="button"
                      onClick={() => setSelectedRegion(reg.name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                        selectedRegion === reg.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {reg.name}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={hospitalSearch}
                      onChange={(e) => setHospitalSearch(e.target.value)}
                      placeholder="Cari nama RS, kode unit, kota, atau pulau..."
                      className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllHospitals}
                    className="text-xs text-blue-600 font-semibold hover:underline shrink-0"
                  >
                    Pilih Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearAllHospitals}
                    className="text-xs text-slate-400 hover:text-slate-600 underline shrink-0"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {/* Checkboxes Single Column List */}
              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                {filteredHospitals.map((hosp) => {
                  const isChecked = coveredUnits.includes(hosp.name);
                  return (
                    <button
                      key={hosp.id || hosp.code}
                      type="button"
                      onClick={() => handleToggleHospital(hosp.name)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                        isChecked
                          ? 'border-blue-300 bg-blue-50/80 text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 font-medium'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{hosp.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 font-mono font-bold">
                              {hosp.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            <span>{hosp.city}, {hosp.island}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 ml-3">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                          isChecked 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {isChecked ? 'Terpilih' : 'Pilih'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: KETENTUAN KOMERSIAL & PENGIRIMAN STANDAR */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 font-bold">
              <BadgePercent className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                4. Ketentuan Komersial, Pajak, dan Pengiriman
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ketentuan standar yang berlaku untuk setiap pesanan dan faktur pengadaan Siloam Hospitals.
              </p>
            </div>
          </div>

          {/* Single Column Form Fields */}
          <div className="space-y-4 pt-1">
            {/* 1. Status PPN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Ketentuan Pajak (PPN 11%)
              </label>
              <select
                value={taxCondition}
                onChange={(e) => setTaxCondition(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium cursor-pointer"
              >
                {taxConditions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400">Sistem otomatis menghitung nilai PPN 11% pada daftar SKU</span>
            </div>

            {/* 2. Lead Time Pengiriman */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Standar Lead Time Pengiriman (Hari Kalender)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-14 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  required
                />
                <span className="absolute inset-y-0 right-0 my-auto mr-3.5 flex items-center text-xs text-slate-400 font-semibold pointer-events-none">
                  Hari
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Estimasi waktu dari PO terbit hingga barang fisik tiba di unit RS Siloam</span>
            </div>

            {/* 3. Minimum Order Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                3. Minimum Order Quantity (MOQ) Standar
              </label>
              <input
                type="number"
                min={1}
                value={moq}
                onChange={(e) => setMoq(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                required
              />
              <span className="text-[11px] text-slate-400">Jumlah minimal pemesanan per Purchase Order (standar: 1)</span>
            </div>

            {/* 4. Syarat Penyerahan Barang (Franco) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                4. Syarat Penyerahan Barang (Incoterm / Franco)
              </label>
              <input
                type="text"
                value={deliveryTerm}
                onChange={(e) => setDeliveryTerm(e.target.value)}
                placeholder="Franco Rumah Sakit Siloam (Bebas Ongkir Pengiriman)"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
              <span className="text-[11px] text-slate-400">Contoh: Franco RS Siloam Tujuan (Bebas Biaya Kirim / Free Ongkir)</span>
            </div>

            {/* 5. Syarat Pembayaran (TOP) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                5. Syarat Pembayaran (Term of Payment)
              </label>
              <input
                type="text"
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                placeholder="30 Hari Kalender setelah Faktur & BAST Diterima (TOP 30)"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
              <span className="text-[11px] text-slate-400">Contoh: 30 Hari Kalender setelah dokumen lengkap diterima (TOP 30)</span>
            </div>

            {/* 6. Standar Garansi & Purna Jual */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                6. Standar Garansi & Layanan Purna Jual
              </label>
              <input
                type="text"
                value={warrantyGeneral}
                onChange={(e) => setWarrantyGeneral(e.target.value)}
                placeholder="Garansi Resmi 1 Tahun Penuh Sparepart & Servis"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
              <span className="text-[11px] text-slate-400">Garansi suku cadang/alat atau jaminan masa kedaluwarsa BMHP (minimal 18-24 bulan)</span>
            </div>
          </div>

          {/* Catatan Tambahan Penawaran */}
          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              7. Catatan & Syarat Khusus Penawaran (Opsional)
            </label>
            <textarea
              rows={3}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Tuliskan catatan khusus terkait diskon volume, komitmen training alat kesehatan, atau sertifikasi Kemenkes..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
            />
            <span className="text-[11px] text-slate-400">Catatan tambahan yang relevan bagi komite evaluasi Siloam Hospitals</span>
          </div>
        </div>

        {/* Bottom Floating Save Button Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Ketentuan komersial di atas otomatis diaplikasikan ke seluruh baris produk SKU yang Anda isi.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              icon={<Save className="h-4 w-4" />}
              className="w-full sm:w-auto text-xs font-bold"
            >
              Simpan Ketentuan Komersial
            </Button>

            <button
              type="button"
              onClick={onNavigateToPricing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 transition-colors cursor-pointer shrink-0"
            >
              <span>Masukkan Penawaran Harga pada Daftar SKU Siloam</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};
