import React, { useEffect, useState } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import { fetchStaffSkuProposals, reviewSkuProposal, SkuProposal } from '../../../core/api/catalog';
import { Button } from '../../../core/ui/Button';

interface Props {
  onChanged?: () => void;
}

export const StaffSkuProposalsPanel: React.FC<Props> = ({ onChanged }) => {
  const [items, setItems] = useState<SkuProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchStaffSkuProposals('pending_review'));
    } catch (e: any) {
      setError(e.message || 'Gagal memuat usulan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !confirm('Tolak usulan produk ini?')) return;
    setBusyId(id);
    try {
      await reviewSkuProposal(id, { decision });
      setItems((prev) => prev.filter((p) => p.id !== id));
      onChanged?.();
    } catch (e: any) {
      alert(e.message || 'Review gagal.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Usulan Produk Vendor</h3>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Review sebelum masuk katalog aktif. Spek asli vendor tetap tersimpan.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:underline dark:text-amber-300">
          <RefreshCw className="h-3 w-3" /> Muat ulang
        </button>
      </div>
      {loading && <p className="text-xs text-slate-500">Memuat…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!loading && items.length === 0 && (
        <p className="text-xs text-slate-500">Tidak ada usulan menunggu review.</p>
      )}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.map((p) => (
          <div key={p.id} className="rounded-lg border border-amber-200 bg-white p-3 text-xs dark:border-amber-900 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">{p.commodityName}</div>
                <div className="text-slate-500">{p.vendorName || p.vendorId} · {p.level1} · {p.uom}</div>
                <pre className="whitespace-pre-wrap break-words text-[11px] text-slate-700 dark:text-slate-300 max-h-28 overflow-y-auto">
                  {p.rawSpec || p.generalSpec}
                </pre>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button type="button" disabled={busyId === p.id} onClick={() => act(p.id, 'approve')} className="!px-2 !py-1 !text-[11px]">
                  <Check className="h-3 w-3" /> Setujui
                </Button>
                <Button type="button" variant="secondary" disabled={busyId === p.id} onClick={() => act(p.id, 'reject')} className="!px-2 !py-1 !text-[11px]">
                  <X className="h-3 w-3" /> Tolak
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
