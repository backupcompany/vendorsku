import React, { useState, useEffect } from 'react';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { VendorProfile, SupplierStatus } from '../../../core/types';
import { Building2, Save, X, AlertTriangle } from 'lucide-react';

interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorToEdit: VendorProfile | null;
  defaultType: 'erp' | 'new';
  onSave: (vendor: VendorProfile) => Promise<void>;
}

export const VendorFormModal: React.FC<VendorFormModalProps> = ({
  isOpen,
  onClose,
  vendorToEdit,
  defaultType,
  onSave,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [erpVendorCode, setErpVendorCode] = useState('');
  const [npwp, setNpwp] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [authorizedPerson, setAuthorizedPerson] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('DIAGNOSTIC AND MEDICAL DEVICES');
  const [status, setStatus] = useState<SupplierStatus>('verified');
  const [isExisting, setIsExisting] = useState(defaultType === 'erp');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (vendorToEdit) {
      setCompanyName(vendorToEdit.companyName);
      setErpVendorCode(vendorToEdit.erpVendorCode || '');
      setNpwp(vendorToEdit.npwp);
      setEmail(vendorToEdit.email);
      setPhone(vendorToEdit.phone);
      setAuthorizedPerson(vendorToEdit.authorizedPerson);
      setAddress(vendorToEdit.address || '');
      setCategory(vendorToEdit.businessScope?.level1 || vendorToEdit.category || 'DIAGNOSTIC AND MEDICAL DEVICES');
      setStatus(vendorToEdit.status);
      setIsExisting(vendorToEdit.isExistingSupplier ?? Boolean(vendorToEdit.erpVendorCode));
      setNotes(vendorToEdit.notes || '');
    } else {
      setCompanyName('');
      setErpVendorCode(defaultType === 'erp' ? `VND-ERP-${Math.floor(10000 + Math.random() * 90000)}` : '');
      setNpwp('');
      setEmail('');
      setPhone('');
      setAuthorizedPerson('');
      setAddress('');
      setCategory('DIAGNOSTIC AND MEDICAL DEVICES');
      setStatus(defaultType === 'erp' ? 'verified' : 'prospect');
      setIsExisting(defaultType === 'erp');
      setNotes('');
    }
    setErrorMessage(null);
  }, [vendorToEdit, defaultType, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMessage('Nama Perusahaan wajib diisi.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Email resmi perusahaan tidak valid.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Nomor WhatsApp PIC wajib diisi.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const vendorData: VendorProfile = {
        id: vendorToEdit?.id || (isExisting ? `vnd-erp-${Date.now()}` : `vnd-new-${Date.now()}`),
        companyName: companyName.trim(),
        erpVendorCode: isExisting && erpVendorCode.trim() ? erpVendorCode.trim() : undefined,
        npwp: npwp.trim() || '00.000.000.0-000.000',
        email: email.trim(),
        phone: phone.trim() || '-',
        authorizedPerson: authorizedPerson.trim() || 'PIC Perusahaan',
        address: address.trim() || '-',
        verified: status === 'verified',
        status,
        isExistingSupplier: isExisting,
        source: isExisting ? 'erp_upload' : 'manual_admin',
        registrationDate: vendorToEdit?.registrationDate || new Date().toISOString(),
        category,
        notes,
        businessScope: {
          level1: category,
          level2List: vendorToEdit?.businessScope?.level2List || ['SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS'],
        },
        password: vendorToEdit?.password,
      };

      await onSave(vendorData);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan vendor.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vendorToEdit ? 'Edit Data Rekanan Vendor' : isExisting ? 'Tambah Vendor ERP Baru Manual' : 'Tambah Calon Rekanan Baru (Non-ERP)'}
      subtitle="Kelola profil perusahaan, nomor izin, NPWP, dan kontak penanggung jawab tender"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tipe Rekanan Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="font-bold text-slate-800 dark:text-white block">
              Klasifikasi Master Rekanan:
            </span>
            <span className="text-[11px] text-slate-500">
              Tentukan apakah vendor ini telah terdaftar resmi di ERP Siloam atau vendor baru non-ERP.
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setIsExisting(true);
                if (!erpVendorCode) setErpVendorCode(`VND-ERP-${Math.floor(10000 + Math.random() * 90000)}`);
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                isExisting
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Vendor ERP
            </button>
            <button
              type="button"
              onClick={() => setIsExisting(false)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                !isExisting
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Vendor Baru (Non-ERP)
            </button>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Company Name */}
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Nama Lengkap Perusahaan (PT/CV) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Contoh: PT Medika Farma Pratama"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* ERP Code (Only if ERP Vendor) */}
          {isExisting && (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Kode Vendor ERP Siloam (SAP/SIM-RS) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required={isExisting}
                value={erpVendorCode}
                onChange={(e) => setErpVendorCode(e.target.value.toUpperCase())}
                placeholder="VND-ERP-10023"
                className="w-full rounded-xl border border-blue-300 font-mono font-bold text-blue-700 px-3 py-2 text-xs dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
              />
            </div>
          )}

          {/* NPWP */}
          <div className={!isExisting ? 'sm:col-span-1' : ''}>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Nomor Pokok Wajib Pajak (NPWP)
            </label>
            <input
              type="text"
              value={npwp}
              onChange={(e) => setNpwp(e.target.value)}
              placeholder="01.234.567.8-012.000"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Email */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Email Resmi Perusahaan <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tender@perusahaan.com"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              No. Telepon / WhatsApp PIC
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62 21 xxxx / 0812xxxx"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* PIC */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Nama PIC / Penanggung Jawab
            </label>
            <input
              type="text"
              value={authorizedPerson}
              onChange={(e) => setAuthorizedPerson(e.target.value)}
              placeholder="Hendra Gunawan (Direktur Penjualan)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Status */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Status Verifikasi Rekanan
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SupplierStatus)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="verified">Verified (Terverifikasi & Aktif)</option>
              <option value="identified">Identified (Teridentifikasi Dokumen)</option>
              <option value="prospect">Prospect (Calon Rekanan Baru)</option>
            </select>
          </div>

          {/* Category */}
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Kategori / Lini Bisnis Utama (Level 1)
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="DIAGNOSTIC AND MEDICAL DEVICES"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Alamat Kantor / Domisili Pabrik
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap kantor pusat vendor..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Catatan Internal Tim Procurement
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Distributor resmi brand X, evaluasi ISO 13485..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isProcessing}
          >
            Batal
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isProcessing}
            icon={<Save className="h-4 w-4" />}
            className="bg-[#1B3F9B] hover:bg-[#153482]"
          >
            {isProcessing ? 'Menyimpan...' : 'Simpan Data Vendor'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
