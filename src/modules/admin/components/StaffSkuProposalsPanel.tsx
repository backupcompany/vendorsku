import React, { useEffect, useState } from 'react';
import { Check, X, RefreshCw, Paperclip, Sparkles } from 'lucide-react';
import {
  fetchStaffSkuProposals,
  fetchStaffSkuAttachments,
  reviewSkuProposal,
  saveSkuProposalAI,
  openSkuAttachment,
  SkuProposal,
  SkuAttachment,
} from '../../../core/api/catalog';
import { aiService } from '../../../core/services/ai/aiService';
import { Button } from '../../../core/ui/Button';

interface Props {
  onChanged?: () => void;
}

type Draft = {
  commodityName: string;
  generalSpec: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
};

export const StaffSkuProposalsPanel: React.FC<Props> = ({ onChanged }) => {
  const [items, setItems] = useState<SkuProposal[]>([]);
  const [atts, setAtts] = useState<Record<string, SkuAttachment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const draftFrom = (p: SkuProposal): Draft => ({
    commodityName: p.ai?.commodityName || p.commodityName,
    generalSpec: p.ai?.generalSpec || p.generalSpec,
    level1: p.ai?.level1 || p.level1,
    level2: p.ai?.level2 || (p.level2 === 'VENDOR PROPOSAL' ? '' : p.level2),
    level3: p.ai?.level3 || (p.level3 === 'VENDOR PROPOSAL' ? '' : p.level3),
    level4: p.ai?.level4 || (p.level4 === 'VENDOR PROPOSAL' ? '' : p.level4),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchStaffSkuProposals('pending_review');
      setItems(list);
      const nextDrafts: Record<string, Draft> = {};
      list.forEach((p) => {
        nextDrafts[p.id] = draftFrom(p);
      });
      setDrafts(nextDrafts);
      const map: Record<string, SkuAttachment[]> = {};
      await Promise.all(
        list.map(async (p) => {
          if ((p.attachmentCount ?? 0) > 0) {
            try {
              map[p.id] = await fetchStaffSkuAttachments(p.id);
            } catch {
              map[p.id] = [];
            }
          }
        }),
      );
      setAtts(map);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat usulan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const runAi = async (p: SkuProposal) => {
    setBusyId(p.id);
    setError('');
    try {
      const brochureText = (atts[p.id] || [])
        .filter((a) => a.kind === 'brochure' && a.extractedTextPreview)
        .map((a) => a.extractedTextPreview)
        .join('\n')
        .slice(0, 4000);
      const ai = await aiService.standardizeCatalog({
        commodityName: p.rawName || p.commodityName,
        generalSpec: p.rawSpec || p.generalSpec,
        level1: p.level1,
        brochureText,
      });
      const saved = await saveSkuProposalAI(p.id, {
        commodityName: ai.commodityName,
        generalSpec: ai.generalSpec,
        level1: ai.level1 || p.level1,
        level2: ai.level2,
        level3: ai.level3,
        level4: ai.level4,
        attributes: ai.attributes,
        model: ai.model,
      });
      setItems((prev) => prev.map((x) => (x.id === p.id ? saved : x)));
      setDrafts((prev) => ({ ...prev, [p.id]: draftFrom(saved) }));
    } catch (e: any) {
      setError(e.message || 'Standarisasi AI gagal.');
    } finally {
      setBusyId(null);
    }
  };

  const act = async (id: string, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !confirm('Tolak usulan produk ini?')) return;
    setBusyId(id);
    try {
      const d = drafts[id];
      await reviewSkuProposal(id, {
        decision,
        ...(decision === 'approve' && d
          ? {
              commodityName: d.commodityName,
              generalSpec: d.generalSpec,
              level1: d.level1,
              level2: d.level2 || 'VENDOR PROPOSAL',
              level3: d.level3 || 'VENDOR PROPOSAL',
              level4: d.level4 || 'VENDOR PROPOSAL',
            }
          : {}),
      });
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
            Raw vendor tetap tersimpan. Jalankan AI untuk menyederhanakan spek, edit bila perlu, lalu setujui.
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
      <div className="space-y-3 max-h-[32rem] overflow-y-auto">
        {items.map((p) => {
          const d = drafts[p.id] || draftFrom(p);
          return (
            <div key={p.id} className="rounded-lg border border-amber-200 bg-white p-3 text-xs dark:border-amber-900 dark:bg-slate-900 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white">{p.rawName || p.commodityName}</div>
                  <div className="text-slate-500">{p.vendorName || p.vendorId} · {p.level1} · {p.uom}</div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button type="button" variant="outline" disabled={busyId === p.id} onClick={() => runAi(p)} className="!px-2 !py-1 !text-[11px]">
                    <Sparkles className="h-3 w-3" /> Standarisasi AI
                  </Button>
                  <Button type="button" disabled={busyId === p.id} onClick={() => act(p.id, 'approve')} className="!px-2 !py-1 !text-[11px]">
                    <Check className="h-3 w-3" /> Setujui
                  </Button>
                  <Button type="button" variant="secondary" disabled={busyId === p.id} onClick={() => act(p.id, 'reject')} className="!px-2 !py-1 !text-[11px]">
                    <X className="h-3 w-3" /> Tolak
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">Raw Vendor</div>
                  <pre className="whitespace-pre-wrap break-words text-[11px] text-slate-700 dark:text-slate-300 max-h-28 overflow-y-auto rounded bg-slate-50 p-2 dark:bg-slate-800">
                    {p.rawSpec || p.generalSpec}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Hasil Katalog {p.ai ? `(AI${p.ai.model ? `: ${p.ai.model}` : ''})` : '(edit sebelum setujui)'}
                  </div>
                  <input
                    value={d.commodityName}
                    onChange={(e) => setDraft(p.id, { commodityName: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold dark:border-slate-700 dark:bg-slate-850"
                    placeholder="Nama standar"
                  />
                  <textarea
                    rows={3}
                    value={d.generalSpec}
                    onChange={(e) => setDraft(p.id, { generalSpec: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-850 resize-y"
                    placeholder="Spek ringkas"
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <input value={d.level2} onChange={(e) => setDraft(p.id, { level2: e.target.value })} placeholder="Level 2" className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-850" />
                    <input value={d.level3} onChange={(e) => setDraft(p.id, { level3: e.target.value })} placeholder="Level 3" className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-850" />
                  </div>
                </div>
              </div>

              {(atts[p.id]?.length || p.attachmentCount) ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                    <Paperclip className="h-3 w-3" /> Lampiran ({atts[p.id]?.length || p.attachmentCount})
                  </div>
                  {(atts[p.id] || []).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="block text-left text-[11px] text-blue-700 hover:underline dark:text-blue-300"
                      onClick={() => openSkuAttachment(a.id)}
                      title={a.extractedTextPreview || a.filename}
                    >
                      {a.kind === 'photo' ? 'Foto' : 'PDF'}: {a.filename}
                      {a.hasExtractedText ? ' · teks terindeks' : ''}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
