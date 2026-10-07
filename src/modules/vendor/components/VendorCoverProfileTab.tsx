import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VendorProfile } from '../../../core/types';

interface VendorCoverProfileTabProps {
  vendor: VendorProfile;
  totalSubmissionsCount?: number;
  onUpdateProfile: (vendorId: string, updates: Partial<VendorProfile>) => Promise<VendorProfile>;
  onNavigateToMatrix?: () => void;
  onNavigateToPricing?: () => void;
  onNavigateToTerms?: () => void;
  onOpenQuickGuide: () => void;
  onOpenChangePassword?: () => void;
}

const fieldCls =
  'w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const labelCls =
  'w-full sm:w-52 shrink-0 text-sm font-semibold text-[#0B2361] dark:text-slate-200 pt-1.5';
const rowCls =
  'flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-[#edebe9] dark:border-slate-800 py-3 px-1';

export const VendorCoverProfileTab: React.FC<VendorCoverProfileTabProps> = ({
  vendor,
  onUpdateProfile,
  onNavigateToTerms,
  onOpenChangePassword,
}) => {
  const [companyName, setCompanyName] = useState(vendor.companyName || '');
  const [npwp, setNpwp] = useState(vendor.npwp || '');
  const [address, setAddress] = useState(vendor.address || '');
  const [authorizedPerson, setAuthorizedPerson] = useState(vendor.authorizedPerson || '');
  const [email, setEmail] = useState(vendor.email || '');
  const [phone, setPhone] = useState(vendor.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(vendor.companyName || '');
    setNpwp(vendor.npwp || '');
    setAddress(vendor.address || '');
    setAuthorizedPerson(vendor.authorizedPerson || '');
    setEmail(vendor.email || '');
    setPhone(vendor.phone || '');
  }, [vendor]);

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);
    if (!companyName.trim()) {
      setFormError('Nama Perusahaan wajib diisi.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Email resmi PIC wajib diisi dengan format yang benar.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Nomor WhatsApp / Telepon PIC wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateProfile(vendor.id, {
        companyName: companyName.trim(),
        npwp: npwp.trim(),
        address: address.trim(),
        authorizedPerson: authorizedPerson.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setSaveSuccessMsg('Profil perusahaan & kontak PIC berhasil disimpan.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan perubahan profil rekanan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-16 bg-[#faf9f8] dark:bg-transparent border border-[#edebe9] dark:border-slate-800">
      {/* SharePoint-style command bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#edebe9] bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="submit"
          form="vendor-cover-form"
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 bg-[#1B3F9B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#153482] disabled:opacity-60 cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Menyimpan…' : 'Simpan'}
        </button>
        {onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            className="px-3 py-1.5 text-sm text-[#1B3F9B] hover:underline cursor-pointer"
          >
            Ganti Password
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500 font-mono">ID: {vendor.id}</span>
      </div>

      <div className="bg-white px-4 sm:px-6 py-4 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-[#0B2361] dark:text-white border-l-4 border-[#1B3F9B] pl-3">
          Profil Perusahaan &amp; PIC
        </h1>
        <p className="mt-1 pl-4 text-sm text-slate-600 dark:text-slate-400">
          Lengkapi data legalitas perusahaan dan kontak resmi penanggung jawab (PIC).
        </p>
      </div>

      {saveSuccessMsg && (
        <div className="mx-4 mb-2 flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {saveSuccessMsg}
        </div>
      )}
      {formError && (
        <div className="mx-4 mb-2 flex items-center gap-2 border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {formError}
        </div>
      )}

      <form id="vendor-cover-form" onSubmit={handleSaveAll} className="bg-white px-4 sm:px-6 pb-6 dark:bg-slate-900">
        <h2 className="mt-2 mb-1 text-sm font-bold uppercase tracking-wide text-[#1B3F9B] border-b-2 border-[#1B3F9B] pb-1">
          Data Perusahaan
        </h2>

        <div className={rowCls}>
          <label className={labelCls}>
            Nama Perusahaan <span className="text-red-600">*</span>
          </label>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Contoh: PT Medika Farma Pratama"
              className={fieldCls}
            />
          </div>
        </div>

        <div className={rowCls}>
          <label className={labelCls}>NPWP</label>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={npwp}
              onChange={(e) => setNpwp(e.target.value)}
              placeholder="01.234.567.8-012.000"
              className={`${fieldCls} font-mono`}
            />
          </div>
        </div>

        <div className={rowCls}>
          <label className={labelCls}>Alamat Kantor / Gudang</label>
          <div className="flex-1 min-w-0">
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. …"
              className={`${fieldCls} resize-y`}
            />
          </div>
        </div>

        <div className={rowCls}>
          <label className={labelCls}>Lini Bisnis Utama</label>
          <div className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200 pt-1.5">
            <span className="font-medium">{vendor.businessScope?.level1 || 'Belum diatur'}</span>
            {onNavigateToTerms && (
              <>
                {' — '}
                <button
                  type="button"
                  onClick={onNavigateToTerms}
                  className="text-[#1B3F9B] hover:underline cursor-pointer"
                >
                  Atur di tab Lini Bisnis &amp; Ketentuan
                </button>
              </>
            )}
          </div>
        </div>

        <h2 className="mt-6 mb-1 text-sm font-bold uppercase tracking-wide text-[#1B3F9B] border-b-2 border-[#1B3F9B] pb-1">
          Penanggung Jawab (PIC)
        </h2>

        <div className={rowCls}>
          <label className={labelCls}>
            Nama Lengkap PIC <span className="text-red-600">*</span>
          </label>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              required
              value={authorizedPerson}
              onChange={(e) => setAuthorizedPerson(e.target.value)}
              placeholder="Nama & jabatan"
              className={fieldCls}
            />
          </div>
        </div>

        <div className={rowCls}>
          <label className={labelCls}>
            Email PIC <span className="text-red-600">*</span>
          </label>
          <div className="flex-1 min-w-0">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tender@perusahaan.co.id"
              className={fieldCls}
            />
          </div>
        </div>

        <div className={`${rowCls} border-b-0`}>
          <label className={labelCls}>
            WhatsApp / HP PIC <span className="text-red-600">*</span>
          </label>
          <div className="flex-1 min-w-0">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812-XXXX-XXXX"
              className={fieldCls}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end border-t border-[#edebe9] pt-4 dark:border-slate-800">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 bg-[#1B3F9B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153482] disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Menyimpan…' : 'Simpan Profil & Kontak PIC'}
          </button>
        </div>
      </form>
    </div>
  );
};
