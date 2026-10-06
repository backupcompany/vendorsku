import React, { useState, useEffect } from 'react';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { VendorProfile } from '../../../core/types';
import { ShieldCheck, CheckCircle2, Building2, AlertCircle } from 'lucide-react';

interface PromoteVendorToErpModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorProfile | null;
  onPromoteSuccess: (vendorId: string, erpVendorCode: string, notes?: string) => Promise<void>;
}

export const PromoteVendorToErpModal: React.FC<PromoteVendorToErpModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onPromoteSuccess,
}) => {
  const [erpCode, setErpCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      // Auto-generate a clean standardized Siloam ERP vendor code
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      setErpCode(`VND-ERP-${randomSuffix}`);
      setNotes(`Disetujui dan dipromosikan ke Master ERP Siloam pada ${new Date().toLocaleDateString('id-ID')}`);
      setErrorMessage(null);
    }
  }, [vendor]);

  if (!vendor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!erpCode.trim()) {
      setErrorMessage('Kode Vendor ERP wajib diisi.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onPromoteSuccess(vendor.id, erpCode.trim(), notes.trim());
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mempromosikan vendor ke ERP.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Promosikan Calon Rekanan Baru ke Master ERP Siloam"
      subtitle={`Konfirmasi verifikasi dan penerbitan kode vendor resmi untuk ${vendor.companyName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Vendor Summary Card */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-850 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span>{vendor.companyName}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-400 block">NPWP:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{vendor.npwp}</span>
            </div>
            <div>
              <span className="text-slate-400 block">PIC / Kontak:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{vendor.authorizedPerson} ({vendor.phone})</span>
            </div>
            <div>
              <span className="text-slate-400 block">Email:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate">{vendor.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Lini Bisnis:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">{vendor.businessScope?.level1 || vendor.category || 'Alkes'}</span>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Kode Vendor ERP Siloam (SAP / SIM-RS) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={erpCode}
              onChange={(e) => setErpCode(e.target.value.toUpperCase())}
              placeholder="Contoh: VND-ERP-10255"
              className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:border-blue-600 focus:outline-none dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
            />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
              Kode unik yang akan tercatat di sistem ERP pusat dan digunakan untuk penerbitan PO / Kontrak Pengadaan.
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Catatan Persetujuan Tim Procurement
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan verifikasi, legalitas PT, kelayakan dokumen..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Benefits notice */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200 text-[11px] leading-relaxed">
          <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <span>
            Setelah dipromosikan, vendor ini akan berpindah ke <strong>Daftar Vendor ERP</strong> dengan status <strong>Verified</strong>, dapat diidentifikasi secara otomatis oleh sistem, dan memenuhi syarat penerbitan Kontrak Payung Tender Siloam.
          </span>
        </div>

        {/* Actions */}
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
            disabled={isProcessing || !erpCode.trim()}
            icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
            className="bg-[#1B3F9B] hover:bg-[#153482]"
          >
            {isProcessing ? 'Menyimpan...' : 'Konfirmasi & Masukkan ke ERP'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
