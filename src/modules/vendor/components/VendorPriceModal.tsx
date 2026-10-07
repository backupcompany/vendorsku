import React, { useState, useEffect } from 'react';
import { MasterSku, VendorPriceSubmission, VendorProfile } from '../types';
import { Modal } from '../../../core/ui/Modal';
import { Input } from '../../../core/ui/Input';
import { Button } from '../../../core/ui/Button';
import { vendorService } from '../services/vendorService';
import { useOptions } from '../../../core/api/options';
import { CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

interface VendorPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sku: MasterSku | null;
  vendor: VendorProfile;
  onSave: (submission: VendorPriceSubmission) => Promise<void>;
  existingSubmission?: VendorPriceSubmission | null;
}

export const VendorPriceModal: React.FC<VendorPriceModalProps> = ({
  isOpen,
  onClose,
  sku,
  vendor,
  onSave,
  existingSubmission,
}) => {
  const [vendorBrand, setVendorBrand] = useState('');
  const [vendorPartNumber, setVendorPartNumber] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [moq, setMoq] = useState<number>(1);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [priceValidUntil, setPriceValidUntil] = useState<string>('2026-12-31');
  const [kemenkesLicense, setKemenkesLicense] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Indonesia');
  const countries = useOptions('country_of_origin');
  const [warrantyPeriod, setWarrantyPeriod] = useState('Masa Simpan 3 Tahun');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-fill fields if editing existing submission
  useEffect(() => {
    if (existingSubmission) {
      setVendorBrand(existingSubmission.vendorBrand);
      setVendorPartNumber(existingSubmission.vendorPartNumber);
      setUnitPrice(existingSubmission.unitPrice);
      setTaxPercent(existingSubmission.taxPercent || 11);
      setMoq(existingSubmission.moq);
      setLeadTimeDays(existingSubmission.leadTimeDays);
      setPriceValidUntil(existingSubmission.priceValidUntil);
      setKemenkesLicense(existingSubmission.kemenkesLicense || '');
      setCountryOfOrigin(existingSubmission.countryOfOrigin || 'Indonesia');
      setWarrantyPeriod(existingSubmission.warrantyPeriod || 'Masa Simpan 3 Tahun');
      setAdditionalNotes(existingSubmission.additionalNotes || '');
    } else {
      setVendorBrand('');
      setVendorPartNumber('');
      setUnitPrice('');
      setTaxPercent(11);
      setMoq(1);
      setLeadTimeDays(7);
      setPriceValidUntil('2026-12-31');
      setKemenkesLicense('');
      setCountryOfOrigin('Indonesia');
      setWarrantyPeriod('Masa Simpan 3 Tahun');
      setAdditionalNotes('');
    }
    setErrorMsg('');
  }, [existingSubmission, isOpen, sku]);

  if (!sku) return null;

  // Live calculation of 4-Part SKU Name
  const formattedSkuName = vendorService.formatFullSkuName(
    sku.commodityName,
    sku.generalSpec,
    vendorBrand,
    vendorPartNumber
  );

  const numericPrice = typeof unitPrice === 'number' ? unitPrice : 0;
  const priceWithTax = vendorService.calculatePriceWithTax(numericPrice, taxPercent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorBrand.trim()) {
      setErrorMsg('Nama Merk / Brand wajib diisi oleh vendor.');
      return;
    }
    if (!numericPrice || numericPrice <= 0) {
      setErrorMsg('Harga satuan penawaran harus berupa angka lebih besar dari 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const submission: VendorPriceSubmission = {
        id: existingSubmission?.id || 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        skuId: sku.id,
        skuErpCode: sku.erpCode,
        vendorId: vendor.id,
        vendorName: vendor.companyName,
        vendorEmail: vendor.email,
        vendorPhone: vendor.phone,
        vendorNpwp: vendor.npwp,
        commodityName: sku.commodityName,
        generalSpec: sku.generalSpec,
        vendorBrand: vendorBrand.trim(),
        vendorPartNumber: vendorPartNumber.trim(),
        fullFormattedSkuName: formattedSkuName,
        priceListExcludeVat: numericPrice,
        discountPercent: 0,
        nettPriceExcludeVat: numericPrice,
        unitPrice: numericPrice,
        taxPercent,
        priceWithTax,
        uom: sku.uom,
        moq: moq || 1,
        leadTimeDays: leadTimeDays || 7,
        priceValidUntil,
        kemenkesLicense: kemenkesLicense.trim(),
        countryOfOrigin,
        warrantyPeriod,
        additionalNotes: additionalNotes.trim(),
        status: 'submitted',
        submittedAt: existingSubmission?.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(submission);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan penawaran harga.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daftarkan Harga & Pemetaan SKU Vendor"
      subtitle={`Vendor: ${vendor.companyName} · Kategori: ${sku.level1}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Master reference banner */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
            <span className="font-semibold tracking-wide uppercase text-[10px]">
              Referensi Kebutuhan RS
            </span>
          </div>
          <div className="mt-1 text-xs text-blue-700 dark:text-blue-300 font-medium">
            {sku.level1} › {sku.level2} › {sku.level3} › {sku.level4}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Nama Item:</span>
              <div className="font-semibold text-slate-900 dark:text-white">
                {sku.commodityName}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Spec Umum:</span>
              <div className="text-slate-800 dark:text-slate-200">
                {sku.generalSpec}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic 4-Part Full SKU Generator Preview */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Hasil Pemetaan Nama SKU (4 Bagian):
            </span>
          </div>
          <div className="font-mono text-xs text-slate-800 dark:text-slate-200 break-words leading-relaxed">
            <span className="text-blue-700 dark:text-blue-300 font-semibold">{sku.commodityName}</span>
            {' ; '}
            <span className="text-slate-600 dark:text-slate-400">{sku.generalSpec}</span>
            {' ; '}
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {vendorBrand.trim() || '[Brand Vendor]'}
            </span>
            {' ; '}
            <span className="text-purple-700 dark:text-purple-400 font-medium">
              {vendorPartNumber.trim() || '[Part / REF No]'}
            </span>
          </div>
        </div>

        {/* Vendor Input Section: Brand & Part Number */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Bagian 3: Nama Brand / Merk Vendor *"
            placeholder="Contoh: Terumo, B. Braun, Sanbe, Sensi..."
            value={vendorBrand}
            onChange={(e) => setVendorBrand(e.target.value)}
            required
            helperText="Merk resmi dari produk yang Anda tawarkan"
          />

          <Input
            label="Bagian 4: Part Number / Serial / REF Katalog"
            placeholder="Contoh: SS*03L2332, REF-4606051V..."
            value={vendorPartNumber}
            onChange={(e) => setVendorPartNumber(e.target.value)}
            helperText="Kode katalog resmi atau serial part number pabrik"
          />
        </div>

        {/* Pricing Inputs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Harga Satuan Sebelum PPN (IDR) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-mono text-slate-400">
                Rp
              </span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value ? Number(e.target.value) : '')}
                required
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Satuan: <span className="font-semibold text-slate-700 dark:text-slate-300">{sku.uom}</span>
              {sku.benchmarkPrice && (
                <span className="ml-2">
                  (HPS: Rp {sku.benchmarkPrice.toLocaleString('id-ID')})
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tarif PPN (%)
            </label>
            <select
              value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value={11}>11% (PPN Standar)</option>
              <option value={12}>12%</option>
              <option value={0}>0% (Bebas Pajak)</option>
            </select>
            <p className="mt-1 text-[11px] font-mono text-slate-700 dark:text-slate-300">
              Total + PPN: <span className="font-semibold">Rp {priceWithTax.toLocaleString('id-ID')}</span>
            </p>
          </div>
        </div>

        {/* Commercial Terms: MOQ, Lead Time, Validity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Minimum Order (MOQ)
            </label>
            <input
              type="number"
              min="1"
              value={moq}
              onChange={(e) => setMoq(Number(e.target.value) || 1)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Lead Time (Hari Kerja)
            </label>
            <input
              type="number"
              min="1"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Number(e.target.value) || 1)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Harga Berlaku Hingga
            </label>
            <input
              type="date"
              value={priceValidUntil}
              onChange={(e) => setPriceValidUntil(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Regulatory & Origin */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Nomor Izin Edar KEMENKES (AKD / AKL)"
            placeholder="Contoh: KEMENKES RI AKL 20902810992..."
            value={kemenkesLicense}
            onChange={(e) => setKemenkesLicense(e.target.value)}
            leftIcon={<ShieldCheck className="h-4 w-4" />}
            helperText="Diutamakan untuk mempercepat proses kualifikasi tender"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Negara Pembuat (Origin)
            </label>
            <select
              value={countryOfOrigin}
              onChange={(e) => setCountryOfOrigin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {countries.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Catatan Tambahan & Spesifikasi Khusus (Opsional)
          </label>
          <textarea
            rows={2}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Informasi kemasan, sertifikasi ISO/CE, ketersediaan buffer stock di gudang..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            {existingSubmission ? 'Perbarui Penawaran' : 'Kirim Penawaran Harga'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
