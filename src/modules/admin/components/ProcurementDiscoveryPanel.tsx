import React, { useEffect, useState } from 'react';
import { Search, Building2, Mail, Phone, Paperclip, ArrowRight } from 'lucide-react';
import { searchStaffDiscovery, DiscoveryHit, fetchStaffSkuAttachments, openSkuAttachment } from '../../../core/api/catalog';
import { navigate } from '../../../core/router/useAppRouter';

export const ProcurementDiscoveryPanel: React.FC = () => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DiscoveryHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setError('');
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        setHits(await searchStaffDiscovery(query));
      } catch (e: any) {
        setError(e.message || 'Pencarian gagal.');
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const openAttachments = async (skuId: string) => {
    setExpanded(skuId);
    try {
      const list = await fetchStaffSkuAttachments(skuId);
      for (const a of list) {
        // list shown via buttons below after expand — store in hit? keep simple: open first brochure
        if (a.kind === 'brochure') {
          await openSkuAttachment(a.id);
          return;
        }
      }
      if (list[0]) await openSkuAttachment(list[0].id);
    } catch (e: any) {
      alert(e.message || 'Gagal membuka lampiran.');
    }
  };

  const matchLabel: Record<string, string> = {
    nama: 'Nama',
    nama_raw: 'Nama raw',
    spek: 'Spek',
    spek_raw: 'Spek raw',
    spek_ai: 'Spek AI',
    brand: 'Brand',
    part: 'Part number',
    brosur: 'Isi brosur PDF',
    katalog: 'Katalog',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
          <Search className="h-4 w-4" />
          <span>Procurement / Category Discovery</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cari Produk & Vendor</h1>
        <p className="mt-1 text-xs text-slate-500 max-w-2xl">
          Cari berdasarkan nama, spek, brand, part number, atau isi brosur PDF. Hasil menampilkan vendor untuk follow-up.
        </p>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Contoh: sarung tangan latex AQL 1.5"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-850 dark:text-white"
          />
        </div>
        {loading && <p className="mt-2 text-xs text-slate-500">Mencari…</p>}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {!loading && q.trim().length >= 2 && hits.length === 0 && !error && (
          <p className="mt-2 text-xs text-slate-500">Tidak ada hasil untuk “{q.trim()}”.</p>
        )}
      </div>

      <div className="space-y-2">
        {hits.map((h) => (
          <div key={h.skuId} className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{h.commodityName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {matchLabel[h.matchField] || h.matchField}
                  </span>
                  <span className="text-[10px] text-slate-400">{h.status} · {h.level1}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{h.snippet || h.generalSpec}</p>
                {(h.brand || h.partNumber) && (
                  <p className="text-slate-500">Brand: {h.brand || '-'} · Part: {h.partNumber || '-'}</p>
                )}
                {(h.attachmentCount ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => openAttachments(h.skuId)}
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline dark:text-blue-300"
                  >
                    <Paperclip className="h-3 w-3" /> {h.attachmentCount} lampiran {expanded === h.skuId ? '(dibuka)' : ''}
                  </button>
                )}
              </div>

              <div className="shrink-0 rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/30 min-w-[200px]">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200 mb-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {h.vendor?.companyName || 'Vendor belum teridentifikasi'}
                </div>
                {h.vendor?.email && (
                  <a href={`mailto:${h.vendor.email}`} className="flex items-center gap-1 text-slate-700 hover:underline dark:text-slate-300">
                    <Mail className="h-3 w-3" /> {h.vendor.email}
                  </a>
                )}
                {h.vendor?.phone && (
                  <a href={`tel:${h.vendor.phone}`} className="flex items-center gap-1 text-slate-700 hover:underline dark:text-slate-300 mt-0.5">
                    <Phone className="h-3 w-3" /> {h.vendor.phone}
                  </a>
                )}
                {h.vendor?.id && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin/vendors')}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    Buka Master Vendor <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
