import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { VendorProfile } from '../../../core/types';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Building2,
  RefreshCw,
  X
} from 'lucide-react';

interface ErpVendorUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (vendors: Partial<VendorProfile>[]) => Promise<number>;
}

export const ErpVendorUploadModal: React.FC<ErpVendorUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Kode Vendor ERP': 'VND-ERP-10101',
        'Nama Perusahaan': 'PT Kimia Farma Diagnostika',
        'NPWP': '01.345.678.9-051.000',
        'Email Resmi': 'hospital.tender@kimiafarma.co.id',
        'No. Telepon': '+62 21 384 7722',
        'Nama PIC': 'Bambang Trihatmodjo (Head of Key Account)',
        'Alamat Lengkap': 'Jl. Veteran No. 9, Gambir, Jakarta Pusat',
        'Kategori / Lini Bisnis': 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Catatan': 'Pemasok reagen dan diagnostik laboratorium',
      },
      {
        'Kode Vendor ERP': 'VND-ERP-10102',
        'Nama Perusahaan': 'PT Enseval Medika Prima',
        'NPWP': '02.456.789.0-072.000',
        'Email Resmi': 'sales.rs@ensevalmedika.com',
        'No. Telepon': '+62 21 460 9042',
        'Nama PIC': 'Dewi Sartika (Tender Manager)',
        'Alamat Lengkap': 'Kawasan Industri Pulo Gadung, Jakarta Timur',
        'Kategori / Lini Bisnis': 'GENERAL SUPPLIES',
        'Catatan': 'Distributor alat habis pakai medis & consumables',
      },
      {
        'Kode Vendor ERP': 'VND-ERP-10103',
        'Nama Perusahaan': 'PT B Braun Medical Indonesia',
        'NPWP': '01.567.890.1-014.000',
        'Email Resmi': 'procurement.tender@bbraun.com',
        'No. Telepon': '+62 21 5290 7100',
        'Nama PIC': 'dr. Ferry Indrawan',
        'Alamat Lengkap': 'Menara Prima Lt. 19, Mega Kuningan, Jakarta Selatan',
        'Kategori / Lini Bisnis': 'DIAGNOSTIC AND MEDICAL DEVICES',
        'Catatan': 'Infus, jarum suntik, dan instrumen bedah steril',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Vendor_ERP');
    XLSX.writeFile(wb, 'Template_Import_Vendor_ERP.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const processFile = async (f: File) => {
    setErrorMessage(null);
    setSuccessCount(null);
    setFile(f);
    setIsLoading(true);

    try {
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error('File tidak memiliki data atau baris kosong.');
      }

      // Map rows to standard schema
      const mapped = rawRows.map((r) => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(r).find((rk) => rk.toLowerCase().includes(k.toLowerCase()));
            if (foundKey && r[foundKey] !== undefined && r[foundKey] !== '') {
              return String(r[foundKey]).trim();
            }
          }
          return '';
        };

        const companyName = getVal(['nama perusahaan', 'nama vendor', 'company', 'perusahaan', 'vendor']) || 'Vendor Tanpa Nama';
        const erpCode = getVal(['kode vendor', 'erp', 'kode', 'vendor id', 'code']) || `VND-ERP-${Math.floor(10000 + Math.random() * 90000)}`;
        const npwp = getVal(['npwp', 'tax id', 'nomor pajak']) || '-';
        const email = getVal(['email', 'surel', 'mail']) || 'info@vendor.com';
        const phone = getVal(['telepon', 'phone', 'telp', 'hp', 'wa', 'whatsapp']) || '-';
        const pic = getVal(['pic', 'kontak', 'penanggung', 'authorized', 'person', 'contact']) || 'PIC Perusahaan';
        const address = getVal(['alamat', 'address', 'domisili', 'lokasi']) || '-';
        const category = getVal(['kategori', 'lini', 'category', 'bidang']) || 'DIAGNOSTIC AND MEDICAL DEVICES';
        const notes = getVal(['catatan', 'keterangan', 'notes', 'remark']) || 'Diimpor dari file ERP';

        return {
          erpVendorCode: erpCode,
          companyName,
          npwp,
          email,
          phone,
          authorizedPerson: pic,
          address,
          category,
          notes,
          businessScope: {
            level1: category,
            level2List: ['SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS'],
          },
        };
      });

      setPreviewRows(mapped);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membaca file spreadsheet.');
      setPreviewRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveImport = async () => {
    if (previewRows.length === 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const count = await onUploadSuccess(previewRows);
      setSuccessCount(count);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data vendor ke database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewRows([]);
    setErrorMessage(null);
    setSuccessCount(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload & Import Master Vendor dari ERP"
      subtitle="Sinkronisasi daftar rekanan resmi terdaftar dari sistem SAP / SIM-RS ke dalam portal pengadaan"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Banner with Download Template Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 dark:from-blue-950/40 dark:to-indigo-950/30 dark:border-blue-900 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white">
                Format Spreadsheet Master Vendor ERP
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Pastikan file memuat kolom Kode Vendor ERP, Nama Perusahaan, NPWP, Email, Telepon, dan PIC.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            icon={<Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
            className="shrink-0 bg-white dark:bg-slate-900 font-semibold"
          >
            Download Template (.xlsx)
          </Button>
        </div>

        {/* Error / Success alert */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Berhasil mengimpor {successCount} Vendor ERP ke dalam database portal!</span>
          </div>
        )}

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) processFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-blue-300 hover:border-blue-600 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-blue-50/30 hover:bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 space-y-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400">
            <Upload className="h-6 w-6" />
          </div>

          <div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
              {file ? file.name : 'Pilih file Excel (.xlsx, .xls) atau CSV Master Vendor ERP'}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Seret dokumen ke sini atau klik untuk menelusuri dari komputer Anda
            </p>
          </div>
        </div>

        {/* Preview Table */}
        {previewRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Pratinjau Data Terbaca ({previewRows.length} Rekanan ERP):
              </span>
              <span className="text-[11px] text-slate-500">
                Menampilkan 5 baris pertama
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="p-2">Kode ERP</th>
                    <th className="p-2">Nama Perusahaan</th>
                    <th className="p-2">NPWP</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">PIC</th>
                    <th className="p-2">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {r.erpVendorCode}
                      </td>
                      <td className="p-2 font-semibold text-slate-900 dark:text-white">
                        {r.companyName}
                      </td>
                      <td className="p-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {r.npwp}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">
                        {r.email}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">
                        {r.authorizedPerson}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">
                        {r.category}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isLoading}
          >
            Batal
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveImport}
            disabled={previewRows.length === 0 || isLoading}
            icon={isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            className="bg-[#1B3F9B] hover:bg-[#153482]"
          >
            {isLoading ? 'Memproses...' : `Import & Simpan ${previewRows.length} Vendor ke ERP`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
