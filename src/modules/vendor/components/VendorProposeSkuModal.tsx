import React, { useState } from 'react';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { proposeSku, SkuProposal } from '../../../core/api/catalog';
import { useOptions } from '../../../core/api/options';

interface Props {
  open: boolean;
  vendorId: string;
  defaultLevel1?: string;
  onClose: () => void;
  onSubmitted: (p: SkuProposal) => void;
}

export const VendorProposeSkuModal: React.FC<Props> = ({
  open,
  vendorId,
  defaultLevel1,
  onClose,
  onSubmitted,
}) => {
  const categories = useOptions('product_category');
  const [commodityName, setCommodityName] = useState('');
  const [generalSpec, setGeneralSpec] = useState('');
  const [level1, setLevel1] = useState(defaultLevel1 || '');
  const [uom, setUom] = useState('Pcs');
  const [brand, setBrand] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
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

  return (
    <Modal isOpen={open} onClose={onClose} title="Tambah Produk / SKU Baru" maxWidth="md">
      <div className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">
          Produk belum langsung masuk katalog aktif. Tim Catalog Management akan mereview usulan Anda.
        </p>
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
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? 'Mengirim…' : 'Kirim Usulan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
