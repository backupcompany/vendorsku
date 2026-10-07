import React, { useState } from 'react';
import { MasterSku } from '../types';
import { aiService, SkuParseResult } from '../../../core/services/ai/aiService';
import { Modal } from '../../../core/ui/Modal';
import { Button } from '../../../core/ui/Button';
import { Sparkles, ArrowRight, Check, Search } from 'lucide-react';

interface AiSkuMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterSkus: MasterSku[];
  onSelectMatchedSku: (matchedSku: MasterSku, prefilled: Partial<SkuParseResult>) => void;
}

export const AiSkuMatcherModal: React.FC<AiSkuMatcherModalProps> = ({
  isOpen,
  onClose,
  masterSkus,
  onSelectMatchedSku,
}) => {
  const [rawText, setRawText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SkuParseResult | null>(null);

  const sampleInputs = [
    'Spuit 3cc merk Terumo jarum 23G box isi 100 ref SS*03L2332 harga 128000',
    'Infus Paracetamol 10mg/ml botol 100ml steril infus set Sanbe farma',
    'Nitrile gloves powder free size M merek Sensi box 100 pcs AKD 10903021455',
  ];

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsLoading(true);
    try {
      const parsed = await aiService.matchAndParseSku(rawText, masterSkus);
      setResult(parsed);
    } catch (err: any) {
      alert('Gagal menganalisis teks: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    const targetSku =
      (result.matchingMasterSkuId
        ? masterSkus.find((s) => s.id === result.matchingMasterSkuId)
        : null) ||
      masterSkus.find(
        (s) =>
          s.commodityName.toLowerCase().includes(result.commodityName.toLowerCase()) ||
          result.commodityName.toLowerCase().includes(s.commodityName.toLowerCase())
      ) ||
      masterSkus[0];

    onSelectMatchedSku(targetSku, result);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Smart SKU Matcher & Parser"
      subtitle="Tempelkan deskripsi mentah katalog vendor Anda untuk dipisahkan menjadi 4 bagian standar katalog"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Input area */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Teks Katalog Produk Vendor (Bebas / Raw Text):
          </label>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Contoh: Terumo Surflo IV Catheter 20G pink needle port kateter steril ref SR-OX2032 box isi 50 harga 365.000..."
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Quick sample chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span className="text-[11px] font-medium">Contoh Teks:</span>
          {sampleInputs.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setRawText(sample)}
              className="text-[11px] text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded truncate max-w-[220px]"
            >
              {sample}
            </button>
          ))}
        </div>

        {/* Submit button */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleParse}
            isLoading={isLoading}
            disabled={!rawText.trim()}
            icon={<Sparkles className="h-4 w-4" />}
          >
            Analisis & Petakan ke Taksonomi Katalog
          </Button>
        </div>

        {/* Analysis Result Card */}
        {result && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200 pb-2 dark:border-blue-900 text-xs">
              <span className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Hasil Ekstraksi Standar Katalog (4 Bagian)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Skor Akurasi: {Math.round(result.confidenceScore * 100)}%
              </span>
            </div>

            {/* Extracted 4 Parts Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Bagian 1: Nama Komoditas
                </div>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {result.commodityName}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Bagian 2: Spesifikasi Umum
                </div>
                <div className="text-slate-800 dark:text-slate-200 mt-0.5">
                  {result.generalSpec}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Bagian 3: Merk / Brand Terdeteksi
                </div>
                <div className="font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                  {result.vendorBrand || '-'}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Bagian 4: Part / REF Number
                </div>
                <div className="font-mono text-purple-700 dark:text-purple-400 mt-0.5">
                  {result.vendorPartNumber || '-'}
                </div>
              </div>
            </div>

            {/* Recommended Taxonomy Match */}
            <div className="rounded-lg bg-white p-2.5 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                Rekomendasi Jalur Taksonomi 4-Level:
              </span>
              <div className="mt-1 font-medium text-blue-700 dark:text-blue-300">
                {result.level1} › {result.level2} › {result.level3} › {result.level4}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {result.matchingNotes}
              </div>
            </div>

            {/* Formatted Preview */}
            <div className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2 rounded">
              <span className="text-slate-400 font-sans text-[10px] block mb-1">
                Preview Format Final:
              </span>
              {result.commodityName} ; {result.generalSpec} ; {result.vendorBrand} ; {result.vendorPartNumber}
            </div>

            {/* Action */}
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApply}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Gunakan & Buka Form Pengisian Harga
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
