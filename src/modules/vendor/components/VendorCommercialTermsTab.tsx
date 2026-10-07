import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  Save,
  Search,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import { VendorProfile, CommercialTerms, HospitalUnit, BusinessScope } from '../../../core/types';
import { hospitalService } from '../../../core/services/hospitalService';
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

const fieldCls =
  'w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const labelCls =
  'w-full sm:w-56 shrink-0 text-sm font-semibold text-[#0B2361] dark:text-slate-200 pt-1.5';
const rowCls =
  'flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-[#edebe9] dark:border-slate-800 py-3';

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

  const [validFrom, setValidFrom] = useState(
    existingTerms?.validFrom || new Date().toISOString().split('T')[0],
  );
  const [priceValidUntil, setPriceValidUntil] = useState(
    existingTerms?.priceValidUntil || '2026-12-31',
  );
  const [commitmentPeriodMonths, setCommitmentPeriodMonths] = useState<number>(
    existingTerms?.commitmentPeriodMonths || 12,
  );

  const [allHospitals, setAllHospitals] = useState<HospitalUnit[]>([]);
  const [coverageType, setCoverageType] = useState<'all_units' | 'selected_units'>(
    existingTerms?.coverageType || 'all_units',
  );
  const [coveredUnits, setCoveredUnits] = useState<string[]>(
    existingTerms?.coveredHospitalUnits && existingTerms.coveredHospitalUnits.length > 0
      ? existingTerms.coveredHospitalUnits
      : [],
  );
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');

  useEffect(() => {
    hospitalService.getActiveHospitals().then((list) => {
      if (!list?.length) return;
      setAllHospitals(list);
      setCoveredUnits((prev) => (prev.length > 0 ? prev : list.map((h) => h.name)));
    }).catch(console.error);
  }, []);

  const [currency] = useState('IDR');
  const [taxCondition, setTaxCondition] = useState<'exclude_vat_11' | 'include_vat_11'>(
    existingTerms?.taxCondition || 'exclude_vat_11',
  );
  const [leadTimeDays, setLeadTimeDays] = useState<number>(
    existingTerms?.standardLeadTimeDays || 7,
  );
  const [moq, setMoq] = useState<number>(existingTerms?.standardMoq || 1);
  const [deliveryTerm, setDeliveryTerm] = useState(
    existingTerms?.deliveryTerm || 'Franco Rumah Sakit (Bebas Ongkir Pengiriman)',
  );
  const [paymentTerm, setPaymentTerm] = useState(
    existingTerms?.paymentTerm || '30 Hari Kalender setelah Faktur & BAST Diterima (TOP 30)',
  );
  const [warrantyGeneral, setWarrantyGeneral] = useState(
    existingTerms?.warrantyGeneral || 'Garansi Resmi 1 Tahun Penuh Sparepart & Servis',
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    existingTerms?.additionalNotes || '',
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handlePresetDuration = (months: number, targetDate: string) => {
    setCommitmentPeriodMonths(months);
    setPriceValidUntil(targetDate);
  };

  const handleToggleHospital = (unit: string) => {
    setCoveredUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit],
    );
  };

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
  }, [allHospitals, selectedRegion, hospitalSearch, regionalGroups]);

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
      setSaveSuccessMsg('Ketentuan komersial & cakupan distribusi berhasil disimpan.');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Gagal menyimpan ketentuan komersial: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const presets = [
    { months: 12, date: '2026-12-31', label: 'Akhir 2026 (1 thn)' },
    { months: 24, date: '2027-12-31', label: 'Akhir 2027 (2 thn)' },
    { months: 6, date: '2026-06-30', label: '6 bulan' },
    { months: 3, date: '2026-03-31', label: '3 bulan' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto pb-16 bg-[#faf9f8] dark:bg-transparent border border-[#edebe9] dark:border-slate-800">
      {/* Command bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#edebe9] bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="submit"
          form="vendor-terms-form"
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 bg-[#1B3F9B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#153482] disabled:opacity-60 cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button
          type="button"
          onClick={onNavigateToPricing}
          className="border border-[#a19f9d] bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-[#f3f2f1] cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          Ke Daftar SKU
        </button>
        {onOpenQuickGuide && (
          <button
            type="button"
            onClick={onOpenQuickGuide}
            className="px-3 py-1.5 text-sm text-[#1B3F9B] hover:underline cursor-pointer"
          >
            Panduan
          </button>
        )}
      </div>

      <div className="bg-white px-4 sm:px-6 py-4 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-[#0B2361] dark:text-white border-l-4 border-[#1B3F9B] pl-3">
          Lini Bisnis &amp; Ketentuan Distribusi
        </h1>
        <p className="mt-1 pl-4 text-sm text-slate-600 dark:text-slate-400">
          Atur lini bisnis, masa berlaku harga, cakupan unit RS, dan syarat pengiriman/pembayaran.
        </p>
      </div>

      {saveSuccessMsg && (
        <div className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {saveSuccessMsg}
          </span>
          <button type="button" onClick={onNavigateToPricing} className="text-[#1B3F9B] font-semibold hover:underline cursor-pointer">
            Lanjut ke Daftar SKU →
          </button>
        </div>
      )}

      <div className="bg-white px-4 sm:px-6 pb-4 dark:bg-slate-900">
        <VendorBusinessScopeCard
          vendor={vendor}
          onUpdateScope={onUpdateScope}
          onNavigateToPricing={onNavigateToPricing}
        />
      </div>

      <form id="vendor-terms-form" onSubmit={handleSave} className="bg-white px-4 sm:px-6 pb-6 space-y-6 dark:bg-slate-900">
        {/* Section 2 */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3F9B] border-b-2 border-[#1B3F9B] pb-1 mb-1">
            2. Masa Berlaku Penawaran Harga
          </h2>

          <div className={rowCls}>
            <label className={labelCls}>Tanggal mulai berlaku</label>
            <div className="flex-1 min-w-0">
              <input type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className={rowCls}>
            <label className={labelCls}>Valid sampai</label>
            <div className="flex-1 min-w-0 space-y-2">
              <input
                type="date"
                required
                value={priceValidUntil}
                onChange={(e) => setPriceValidUntil(e.target.value)}
                className={`${fieldCls} font-semibold text-[#1B3F9B]`}
              />
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.date}
                    type="button"
                    onClick={() => handlePresetDuration(p.months, p.date)}
                    className={`border px-2.5 py-1 text-xs cursor-pointer ${
                      priceValidUntil === p.date
                        ? 'border-[#1B3F9B] bg-[#deecf9] text-[#0B2361] font-semibold'
                        : 'border-[#a19f9d] bg-white text-slate-700 hover:bg-[#f3f2f1] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3F9B] border-b-2 border-[#1B3F9B] pb-1 mb-1">
            3. Cakupan Distribusi Rumah Sakit
          </h2>
          <p className="text-sm text-slate-500 mb-2">
            {coverageType === 'all_units'
              ? `Seluruh ${allHospitals.length} unit RS`
              : `${coveredUnits.length} dari ${allHospitals.length} RS terpilih`}
          </p>

          <div className="border border-[#edebe9] dark:border-slate-700 mb-3">
            <label className="flex items-start gap-3 px-3 py-2.5 border-b border-[#edebe9] dark:border-slate-700 cursor-pointer hover:bg-[#faf9f8] dark:hover:bg-slate-800">
              <input
                type="radio"
                name="coverage"
                checked={coverageType === 'all_units'}
                onChange={() => {
                  setCoverageType('all_units');
                  setCoveredUnits(allHospitals.map((h) => h.name));
                }}
                className="mt-1 accent-[#1B3F9B]"
              />
              <span className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">Seluruh unit RS nasional</span>
                <span className="block text-slate-500">Pengiriman ke semua rumah sakit terdaftar.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#faf9f8] dark:hover:bg-slate-800">
              <input
                type="radio"
                name="coverage"
                checked={coverageType === 'selected_units'}
                onChange={() => setCoverageType('selected_units')}
                className="mt-1 accent-[#1B3F9B]"
              />
              <span className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">Unit / wilayah tertentu</span>
                <span className="block text-slate-500">Pilih RS yang sanggup dilayani jaringan logistik Anda.</span>
              </span>
            </label>
          </div>

          {coverageType === 'selected_units' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedRegion('ALL')}
                  className={`border px-2 py-1 text-xs cursor-pointer ${
                    selectedRegion === 'ALL'
                      ? 'border-[#1B3F9B] bg-[#1B3F9B] text-white'
                      : 'border-[#a19f9d] bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800'
                  }`}
                >
                  Semua wilayah
                </button>
                {regionalGroups.map((reg) => (
                  <button
                    key={reg.name}
                    type="button"
                    onClick={() => setSelectedRegion(reg.name)}
                    className={`border px-2 py-1 text-xs cursor-pointer ${
                      selectedRegion === reg.name
                        ? 'border-[#1B3F9B] bg-[#1B3F9B] text-white'
                        : 'border-[#a19f9d] bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800'
                    }`}
                  >
                    {reg.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[12rem]">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={hospitalSearch}
                    onChange={(e) => setHospitalSearch(e.target.value)}
                    placeholder="Cari nama RS, kode, kota…"
                    className={`${fieldCls} pl-8`}
                  />
                </div>
                <button type="button" onClick={() => setCoveredUnits(allHospitals.map((h) => h.name))} className="text-sm text-[#1B3F9B] hover:underline cursor-pointer">
                  Pilih semua
                </button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={() => setCoveredUnits([])} className="text-sm text-slate-500 hover:underline cursor-pointer">
                  Hapus
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto border border-[#edebe9] dark:border-slate-700">
                {filteredHospitals.map((hosp, i) => {
                  const isChecked = coveredUnits.includes(hosp.name);
                  return (
                    <button
                      key={hosp.id || hosp.code}
                      type="button"
                      onClick={() => handleToggleHospital(hosp.name)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm border-b border-[#edebe9] dark:border-slate-800 cursor-pointer ${
                        i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#faf9f8] dark:bg-slate-800/40'
                      } hover:bg-[#deecf9] dark:hover:bg-slate-800`}
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-[#1B3F9B] shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{hosp.name}</span>
                        <span className="ml-2 font-mono text-xs text-slate-500">{hosp.code}</span>
                        <span className="block text-xs text-slate-500">{hosp.city}, {hosp.island}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 4 */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3F9B] border-b-2 border-[#1B3F9B] pb-1 mb-1">
            4. Ketentuan Komersial, Pajak &amp; Pengiriman
          </h2>

          <div className={rowCls}>
            <label className={labelCls}>Ketentuan pajak (PPN 11%)</label>
            <div className="flex-1 min-w-0">
              <select
                value={taxCondition}
                onChange={(e) => setTaxCondition(e.target.value as any)}
                className={`${fieldCls} cursor-pointer`}
              >
                {taxConditions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={rowCls}>
            <label className={labelCls}>Lead time pengiriman (hari)</label>
            <div className="flex-1 min-w-0">
              <input
                type="number"
                min={1}
                max={120}
                required
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                className={`${fieldCls} font-mono`}
              />
            </div>
          </div>

          <div className={rowCls}>
            <label className={labelCls}>MOQ standar</label>
            <div className="flex-1 min-w-0">
              <input
                type="number"
                min={1}
                required
                value={moq}
                onChange={(e) => setMoq(Number(e.target.value))}
                className={`${fieldCls} font-mono`}
              />
            </div>
          </div>

          <div className={rowCls}>
            <label className={labelCls}>Syarat penyerahan (Franco)</label>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                required
                value={deliveryTerm}
                onChange={(e) => setDeliveryTerm(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>

          <div className={rowCls}>
            <label className={labelCls}>Syarat pembayaran (TOP)</label>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                required
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>

          <div className={rowCls}>
            <label className={labelCls}>Garansi &amp; purna jual</label>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                required
                value={warrantyGeneral}
                onChange={(e) => setWarrantyGeneral(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>

          <div className={`${rowCls} border-b-0`}>
            <label className={labelCls}>Catatan khusus (opsional)</label>
            <div className="flex-1 min-w-0">
              <textarea
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Diskon volume, training, sertifikasi…"
                className={`${fieldCls} resize-y`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#edebe9] pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 text-[#1B3F9B] shrink-0 mt-0.5" />
            Ketentuan di atas diterapkan ke seluruh baris penawaran SKU.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onNavigateToPricing}
              className="border border-[#a19f9d] bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-[#f3f2f1] cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Ke Daftar SKU
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 bg-[#1B3F9B] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#153482] disabled:opacity-60 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Menyimpan…' : 'Simpan Ketentuan'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
