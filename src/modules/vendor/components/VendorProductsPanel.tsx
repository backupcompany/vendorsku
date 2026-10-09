import React, { useEffect, useState } from 'react';
import { Banknote, Link2, Link2Off, ListFilter, Loader2, Package, Plus, Send, Trash2 } from 'lucide-react';
import {
  createVendorProduct,
  createVendorProductsBulk,
  deleteVendorProduct,
  fetchProductMatchPreview,
  fetchVendorProducts,
  linkVendorProduct,
  linkVendorProductsBatch,
  proposeSku,
  suggestProductSkus,
  unlinkVendorProduct,
  type ProductMatchPreview,
  type ProductSuggestHit,
  type VendorProduct,
} from '../../../core/api/catalog';
import type { MasterSku, VendorProfile } from '../../../core/types';

type Props = {
  vendor: VendorProfile;
  onLinked: (sku: MasterSku, product: VendorProduct) => void;
  onPrice: (sku: MasterSku, product: VendorProduct) => void;
};

function toSku(hit: ProductSuggestHit | NonNullable<VendorProduct['linkedSku']>, level2 = ''): MasterSku {
  return {
    id: hit.id,
    erpCode: hit.erpCode,
    level1: hit.level1,
    level2: 'level2' in hit ? hit.level2 : level2,
    level3: '',
    level4: '',
    commodityName: hit.commodityName,
    generalSpec: hit.generalSpec,
    uom: hit.uom,
    isOpenForVendor: true,
    status: 'active',
    createdAt: '',
    updatedAt: '',
  };
}

export const VendorProductsPanel: React.FC<Props> = ({ vendor, onLinked, onPrice }) => {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [spec, setSpec] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hits, setHits] = useState<ProductSuggestHit[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductMatchPreview[] | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [minScore, setMinScore] = useState(40);
  /** Suggested SKU picked to prefill the form; fields stay editable until link/save. */
  const [pickedHit, setPickedHit] = useState<ProductSuggestHit | null>(null);

  const level1 = vendor.businessScope?.level1?.trim() || '';

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchVendorProducts(vendor.id);
      setProducts(rows);
      return rows;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat produk.');
      return [] as VendorProduct[];
    } finally {
      setLoading(false);
    }
  };

  const runMatchPreview = async () => {
    setPreviewBusy(true);
    setError('');
    try {
      setPreview(await fetchProductMatchPreview(vendor.id, { level1: level1 || undefined }));
    } catch (err: any) {
      setError(err.message || 'Pratinjau match gagal.');
    } finally {
      setPreviewBusy(false);
    }
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await reload();
      if (!live) return;
      if (rows.some((p) => !p.skuId)) {
        setPreviewBusy(true);
        try {
          const prev = await fetchProductMatchPreview(vendor.id, { level1: level1 || undefined });
          if (live) setPreview(prev);
        } catch {
          /* non-fatal */
        } finally {
          if (live) setPreviewBusy(false);
        }
      } else if (live) {
        setPreview(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [vendor.id, level1]);

  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      setSuggesting(true);
      suggestProductSkus(vendor.id, q, {
        brand: brand.trim(),
        part: partNumber.trim(),
        level1: level1 || undefined,
      })
        .then((rows) => live && setHits(rows))
        .catch(() => live && setHits([]))
        .finally(() => live && setSuggesting(false));
    }, 280);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, brand, partNumber, vendor.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const created = await createVendorProduct(vendor.id, {
        name: name.trim(),
        brand: brand.trim(),
        partNumber: partNumber.trim(),
        spec: spec.trim(),
      });
      setProducts((prev) => [created, ...prev]);
      setActiveId(created.id);
      setName('');
      setBrand('');
      setPartNumber('');
      setSpec('');
      setHits([]);
      setPickedHit(null);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan produk.');
    } finally {
      setSaving(false);
    }
  };

  /** Select a suggest card → sync form fields from master SKU; vendor can still edit before save/link. */
  const applySuggestion = (hit: ProductSuggestHit) => {
    setName(hit.commodityName);
    setBrand((hit.brand || '').trim());
    setPartNumber((hit.partNumber || '').trim());
    setSpec(hit.generalSpec || '');
    setPickedHit(hit);
  };

  const handleBulk = async () => {
    const items = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 50)
      .map((line) => ({ name: line }));
    if (items.length === 0) return;
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const res = await createVendorProductsBulk(vendor.id, items);
      setOkMsg(`${res.saved} produk ditambahkan. Pilih satu untuk saran match.`);
      setBulkText('');
      await reload();
    } catch (err: any) {
      setError(err.message || 'Gagal bulk.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLink = async (hit: ProductSuggestHit) => {
    setBusyId(hit.id);
    setError('');
    try {
      let product = products.find((p) => p.id === activeId && !p.skuId);
      if (!product) {
        product = await createVendorProduct(vendor.id, {
          name: name.trim() || hit.commodityName,
          brand: brand.trim(),
          partNumber: partNumber.trim(),
          spec: spec.trim(),
        });
        setProducts((prev) => [product!, ...prev]);
      }
      const linked = await linkVendorProduct(vendor.id, product.id, hit.id);
      setProducts((prev) => {
        const without = prev.filter((p) => p.id !== linked.id);
        return [linked, ...without];
      });
      setActiveId(linked.id);
      setName('');
      setBrand('');
      setPartNumber('');
      setSpec('');
      setHits([]);
      setPickedHit(null);
      onLinked(toSku(hit), linked);
    } catch (err: any) {
      setError(err.message || 'Gagal memasangkan SKU.');
    } finally {
      setBusyId(null);
    }
  };

  const handleLink = async (product: VendorProduct, hit: ProductSuggestHit) => {
    setBusyId(hit.id);
    setError('');
    try {
      const linked = await linkVendorProduct(vendor.id, product.id, hit.id);
      setProducts((prev) => prev.map((p) => (p.id === linked.id ? linked : p)));
      setPreview((prev) => (prev ? prev.filter((row) => row.productId !== product.id) : prev));
      onLinked(toSku(hit), linked);
    } catch (err: any) {
      setError(err.message || 'Gagal memasangkan SKU.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlink = async (product: VendorProduct) => {
    setBusyId(product.id);
    setError('');
    try {
      const updated = await unlinkVendorProduct(vendor.id, product.id);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setActiveId(updated.id);
    } catch (err: any) {
      setError(err.message || 'Gagal melepas pairing.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePropose = async (product: VendorProduct) => {
    setBusyId(`propose-${product.id}`);
    setError('');
    setOkMsg('');
    try {
      await proposeSku(vendor.id, {
        commodityName: product.name,
        generalSpec: product.spec || product.name,
        level1,
        brand: product.brand || undefined,
        partNumber: product.partNumber || undefined,
        uom: 'Pcs',
      });
      setOkMsg(`Usulan SKU baru dikirim ke review admin: ${product.name}`);
    } catch (err: any) {
      setError(err.message || 'Gagal mengajukan SKU.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await deleteVendorProduct(vendor.id, id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus.');
    }
  };

  const linkHighScore = async () => {
    if (!preview) return;
    const links = preview
      .filter((row) => row.hasMatch && row.top && row.top.score >= minScore)
      .map((row) => ({ productId: row.productId, skuId: row.top!.id }));
    if (links.length === 0) {
      setError(`Tidak ada saran dengan skor ≥ ${minScore}.`);
      return;
    }
    setPreviewBusy(true);
    setError('');
    try {
      const n = await linkVendorProductsBatch(vendor.id, links);
      setOkMsg(`${n} produk ditautkan (skor ≥ ${minScore}).`);
      setPreview(null);
      await reload();
    } catch (err: any) {
      setError(err.message || 'Batch pairing gagal.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const unmatched = products.filter((p) => !p.skuId);
  const linkedCount = products.length - unmatched.length;
  const focus = products.find((p) => p.id === activeId) || unmatched[0] || null;
  const highCount = preview?.filter((r) => r.hasMatch && r.top && r.top.score >= minScore).length ?? 0;
  const topByProduct = new Map(
    (preview || []).filter((r) => r.hasMatch && r.top).map((r) => [r.productId, r.top!]),
  );

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 pb-16">
      <div className="border border-[#edebe9] bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#0B2361] dark:text-white border-l-4 border-[#1B3F9B] pl-3">
              Produk Saya
            </h2>
            <p className="mt-1 pl-4 text-sm text-slate-600 dark:text-slate-400">
              Ketik nama produk → pilih saran SKU RS (isi form otomatis, tetap bisa diedit) → simpan / tautkan.
            </p>
          </div>
          <div className="flex gap-2 text-[10px] font-semibold shrink-0">
            <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900">
              {unmatched.length} belum match
            </span>
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900">
              {linkedCount} terhubung
            </span>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
              Nama Produk Dagang <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (pickedHit) setPickedHit(null);
              }}
              placeholder="Contoh: Onemed Kassa Hidrofil 40x80"
              className="w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              required
              maxLength={200}
              autoComplete="off"
            />

            {(suggesting || hits.length > 0) && name.trim().length >= 2 && (
              <div className="mt-1.5 border border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-[#0B2361] dark:text-blue-200 border-b border-blue-100 dark:border-blue-900">
                  <span>Saran SKU RS — klik untuk isi form</span>
                  {suggesting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>
                <ul className="max-h-48 overflow-y-auto divide-y divide-blue-100 dark:divide-blue-900">
                  {hits.map((hit) => {
                    const selected = pickedHit?.id === hit.id;
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onClick={() => applySuggestion(hit)}
                          className={`w-full text-left px-2.5 py-2 text-xs cursor-pointer hover:bg-white dark:hover:bg-slate-900 ${
                            selected ? 'bg-white ring-1 ring-inset ring-[#1B3F9B] dark:bg-slate-900' : ''
                          }`}
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {hit.commodityName}
                            {selected && (
                              <span className="ml-2 text-[10px] font-bold text-[#1B3F9B]">dipilih</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {hit.erpCode} · {hit.uom} · skor {hit.score}
                            {hit.generalSpec ? ` · ${hit.generalSpec}` : ''}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!suggesting && hits.length === 0 && (
                  <p className="px-2.5 py-2 text-[11px] text-slate-500">
                    Tidak ada saran. Isi field di bawah lalu simpan, atau ajukan sebagai SKU baru.
                  </p>
                )}
              </div>
            )}
            {pickedHit && (
              <p className="mt-1 text-[11px] text-slate-500">
                Terisi dari ERP <span className="font-mono font-semibold text-[#1B3F9B]">{pickedHit.erpCode}</span>
                — field di bawah boleh diedit sebelum simpan/tautkan.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">Brand / Merk</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">Part / REF</label>
            <input
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              className="w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              maxLength={80}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">Spesifikasi singkat</label>
            <input
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="w-full border border-[#a19f9d] bg-white px-2.5 py-1.5 text-sm focus:border-[#1B3F9B] focus:outline-none focus:ring-1 focus:ring-[#1B3F9B] dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              maxLength={500}
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 bg-white border border-[#a19f9d] hover:bg-[#f3f2f1] disabled:opacity-50 text-slate-800 text-xs font-semibold px-4 py-2 cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Simpan tanpa tautkan
            </button>
            {pickedHit && (
              <button
                type="button"
                disabled={busyId === pickedHit.id || !name.trim()}
                onClick={() => void handleSaveAndLink(pickedHit)}
                className="inline-flex items-center gap-1.5 bg-[#1B3F9B] hover:bg-[#15337E] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 cursor-pointer"
              >
                {busyId === pickedHit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Simpan &amp; tautkan ke {pickedHit.erpCode}
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-semibold text-[#0B2361] dark:text-slate-200 mb-1">
            Tempel banyak nama (1 baris = 1 produk, maks 50)
          </label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={3}
            placeholder={"Kassa Hidrofil 40x80\nSpuit 3ml Luer Lock\n..."}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="button"
            disabled={saving || !bulkText.trim()}
            onClick={() => void handleBulk()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            Tambah massal
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}
        {okMsg && (
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300" role="status">
            {okMsg}
          </p>
        )}
      </div>

      {unmatched.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-siloam font-bold text-[#0B2361] dark:text-blue-200 flex items-center gap-1.5">
                <ListFilter className="h-3.5 w-3.5 text-[#E5A823]" />
                Cocokkan semua (match data)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ambil saran teratas per produk belum match — tanpa AI.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[10px] text-slate-500 flex items-center gap-1">
                Skor min
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                  className="w-14 rounded border border-slate-300 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <button
                type="button"
                disabled={previewBusy}
                onClick={() => void runMatchPreview()}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1B3F9B] text-white text-[10px] font-bold px-2.5 py-1.5 disabled:opacity-50 cursor-pointer"
              >
                {previewBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListFilter className="h-3 w-3" />}
                Pratinjau match
              </button>
              {preview && highCount > 0 && (
                <button
                  type="button"
                  disabled={previewBusy}
                  onClick={() => void linkHighScore()}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1.5 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 disabled:opacity-50 cursor-pointer"
                >
                  <Link2 className="h-3 w-3" />
                  Tautkan skor ≥ {minScore} ({highCount})
                </button>
              )}
            </div>
          </div>
          {preview && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto">
              {preview.map((row) => (
                <li key={row.productId} className="px-3 py-2 text-xs flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{row.name}</div>
                    {row.hasMatch && row.top ? (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-300 truncate">
                        → {row.top.commodityName} · {row.top.erpCode} · skor {row.top.score}
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-700 dark:text-amber-300">Tidak ada saran</div>
                    )}
                  </div>
                  {row.hasMatch && row.top && (
                    <button
                      type="button"
                      disabled={busyId === row.top.id}
                      onClick={() => {
                        const p = products.find((x) => x.id === row.productId);
                        if (p) void handleLink(p, row.top!);
                      }}
                      className="shrink-0 rounded-lg bg-[#1B3F9B] text-white text-[10px] font-bold px-2 py-1 disabled:opacity-50 cursor-pointer"
                    >
                      Tautkan
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {focus && !focus.skuId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-siloam font-bold text-[#0B2361] dark:text-blue-200">
              Pasangkan: {focus.name}
            </div>
            <button
              type="button"
              disabled={busyId === `propose-${focus.id}`}
              onClick={() => handlePropose(focus)}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 text-violet-800 text-[10px] font-bold px-2.5 py-1.5 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200 cursor-pointer disabled:opacity-50"
            >
              {busyId === `propose-${focus.id}` ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Ajukan SKU baru
            </button>
          </div>
          <ProductSuggestList
            vendorId={vendor.id}
            q={focus.name}
            brand={focus.brand}
            part={focus.partNumber}
            level1={level1}
            busyId={busyId}
            onLink={(hit) => handleLink(focus, hit)}
          />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-siloam font-bold text-[#0B2361] dark:text-blue-200 flex items-center justify-between gap-2">
          <span>Daftar Produk</span>
          {level1 ? (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Prioritas lini: {level1}
            </span>
          ) : null}
        </div>
        {loading ? (
          <div className="p-6 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 text-xs text-slate-500">Belum ada produk.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {products.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-start justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className="text-left min-w-0 flex-1 cursor-pointer"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {[p.brand, p.partNumber].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {p.linkedSku ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Link2 className="h-3 w-3" />
                      {p.linkedSku.erpCode} · {p.linkedSku.commodityName}
                    </div>
                  ) : topByProduct.get(p.id) ? (
                    <div className="mt-1 text-[10px] text-blue-700 dark:text-blue-300 truncate">
                      Saran: {topByProduct.get(p.id)!.commodityName} · skor {topByProduct.get(p.id)!.score}
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      Belum dipasangkan
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {p.linkedSku && (
                    <>
                      <button
                        type="button"
                        onClick={() => onPrice(toSku(p.linkedSku!), p)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#1B3F9B] hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        aria-label="Isi harga"
                        title="Isi harga"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => handleUnlink(p)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer disabled:opacity-50"
                        aria-label="Lepas pairing"
                        title="Lepas pairing"
                      >
                        <Link2Off className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {!p.skuId && topByProduct.get(p.id) && (
                    <button
                      type="button"
                      disabled={busyId === topByProduct.get(p.id)!.id}
                      onClick={() => void handleLink(p, topByProduct.get(p.id)!)}
                      className="p-1.5 rounded-lg text-[#1B3F9B] hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer disabled:opacity-50"
                      aria-label="Tautkan saran teratas"
                      title="Tautkan saran teratas"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!p.skuId && (
                    <button
                      type="button"
                      disabled={busyId === `propose-${p.id}`}
                      onClick={() => handlePropose(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40 cursor-pointer disabled:opacity-50"
                      aria-label="Ajukan SKU baru"
                      title="Ajukan SKU baru"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    aria-label="Hapus produk"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ProductSuggestList: React.FC<{
  vendorId: string;
  q: string;
  brand: string;
  part: string;
  level1: string;
  busyId: string | null;
  onLink: (hit: ProductSuggestHit) => void;
}> = ({ vendorId, q, brand, part, level1, busyId, onLink }) => {
  const [hits, setHits] = useState<ProductSuggestHit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setBusy(true);
    suggestProductSkus(vendorId, q, { brand, part, level1: level1 || undefined })
      .then((rows) => live && setHits(rows))
      .catch(() => live && setHits([]))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [vendorId, q, brand, part, level1]);

  if (busy) {
    return (
      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mencari match…
      </div>
    );
  }
  if (hits.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        Tidak ada saran dari master. Pakai tombol <strong>Ajukan SKU baru</strong> untuk antrean admin.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {hits.map((hit) => (
        <div
          key={hit.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{hit.commodityName}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {hit.erpCode} · skor {hit.score} · rank {hit.rank}
            </div>
          </div>
          <button
            type="button"
            disabled={busyId === hit.id}
            onClick={() => onLink(hit)}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#1B3F9B] text-white text-[10px] font-bold px-2.5 py-1.5 disabled:opacity-50 cursor-pointer"
          >
            {busyId === hit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Tautkan
          </button>
        </div>
      ))}
    </div>
  );
};
