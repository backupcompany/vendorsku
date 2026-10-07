import React, { useRef, useState } from 'react';
import { Download, Upload, Check, AlertTriangle } from 'lucide-react';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { proposeSku, proposeSkusBulk, SkuProposal, SkuProposalInput } from '../../../core/api/catalog';
import { useOptions } from '../../../core/api/options';
import { vendorService } from '../services/vendorService';

interface Props {
  open: boolean;
  vendorId: string;
  defaultLevel1?: string;
  onClose: () => void;
  onSubmitted: (p: SkuProposal | { saved: number }) => void;
}

export const VendorProposeSkuModal: React.FC<Props> = ({
  open,
  vendorId,
  defaultLevel1,
  onClose,
  onSubmitted,
}) => {
  const categories = useOptions('product_category');
  const [tab, setTab] = useState<'manual' | 'excel'>('manual');
  const [commodityName, setCommodityName] = useState('');
  const [generalSpec, setGeneralSpec] = useState('');
  const [level1, setLevel1] = useState(defaultLevel1 || '');
  const [uom, setUom] = useState('Pcs');
  const [brand, setBrand] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [validItems, setValidItems] = useState<SkuProposalInput[]>([]);
  const [excelErrors, setExcelErrors] = useState<{ row: number; reason: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const submitManual = async () => {
    setError('');
    const cat = (level1 || defaultLevel1 || '').trim();
    if (!commodityName.trim() || !generalSpec.trim() || !cat) {
      setError('Nama item, spesifikasi, dan kategori wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const saved = await proposeSku(vendorId, {
        commodityName: commodityName.trim(),
        generalSpec: generalSpec.trim(),
        level1: cat,
        uom: uom.trim() || 'Pcs',
        brand: brand.trim() || undefined,
      });
      setCommodityName('');
      setGeneralSpec('');
      setBrand('');
      onSubmitted(saved);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Gagal mengirim usulan.');
    } finally {
      setSaving(false);
    }
  };

  const onExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSaving(true);
    try {
      const result = vendorService.parseSkuProposalExcel(await file.arrayBuffer());
      setValidItems(result.validItems);
      setExcelErrors(result.errors);
      if (result.validItems.length === 0 && result.errors.length === 0) {
        setError('File kosong atau tidak ada baris yang bisa dibaca.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal membaca Excel.');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submitExcel = async () => {
    if (validItems.length === 0) return;
    setError('');
    setSaving(true);
    try {
      const result = await proposeSkusBulk(vendorId, validItems);
      setValidItems([]);
      setExcelErrors([]);
      onSubmitted(result);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Gagal mengirim usulan massal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Tambah Produk / SKU Baru" maxWidth="2xl">
      <div className="space-y-3 text-sm">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${tab === 'manual' ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500'}`}
          >
            Input Manual
          </button>
          <button
            type="button"
            onClick={() => setTab('excel')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${tab === 'excel' ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500'}`}
          >
            Upload Excel
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Produk belum langsung masuk katalog aktif. Tim Catalog Management akan mereview usulan Anda.
        </p>

        {tab === 'manual' ? (
          <>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Nama Item / Komoditas *</span>
              <input
                value={commodityName}
                onChange={(e) => setCommodityName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Contoh: Surgical Gloves Latex"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Spesifikasi (detail, boleh beberapa paragraf) *</span>
              <textarea
                rows={6}
                value={generalSpec}
                onChange={(e) => setGeneralSpec(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 resize-y"
                placeholder="Material, ukuran, kapasitas, sertifikasi, dll."
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Kategori Purchasing Level 1 *</span>
              <select
                value={level1 || defaultLevel1 || ''}
                onChange={(e) => setLevel1(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Pilih kategori…</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Satuan</span>
                <input value={uom} onChange={(e) => setUom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Brand (opsional)</span>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
              </label>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
              <Button type="button" onClick={submitManual} disabled={saving}>
                {saving ? 'Mengirim…' : 'Kirim Usulan'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() => vendorService.exportSkuProposalTemplate(defaultLevel1 || level1)}
              >
                Unduh Template Excel
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onExcelFile} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={saving}
                icon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => fileRef.current?.click()}
              >
                Pilih File Excel
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Kolom wajib: Nama Item, Spesifikasi, Kategori Level 1. Opsional: Satuan, Brand, Part Number. Maks 200 baris.
            </p>

            {excelErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 max-h-28 overflow-y-auto dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {excelErrors.length} baris ditolak
                </div>
                <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 font-mono">
                  {excelErrors.slice(0, 20).map((e, i) => (
                    <li key={i}>Baris {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {validItems.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-56">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-white sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Nama Item</th>
                      <th className="px-2 py-1.5">Kategori</th>
                      <th className="px-2 py-1.5">Spek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {validItems.map((item, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                        <td className="px-2 py-1.5 font-semibold">{item.commodityName}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{item.level1}</td>
                        <td className="px-2 py-1.5 max-w-[220px] truncate" title={item.generalSpec}>{item.generalSpec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
              <Button
                type="button"
                onClick={submitExcel}
                disabled={saving || validItems.length === 0}
                icon={<Check className="h-4 w-4" />}
              >
                {saving ? 'Mengirim…' : `Kirim ${validItems.length} Usulan`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
