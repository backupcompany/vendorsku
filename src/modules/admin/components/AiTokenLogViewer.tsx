import React, { useState, useEffect } from 'react';
import { tokenLogger } from '../../../core/services/ai/tokenLogger';
import { AiLogEntry } from '../../../core/types';
import { Button } from '../../../core/ui/Button';
import { Cpu, DollarSign, Database } from 'lucide-react';

export const AiTokenLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [stats, setStats] = useState<{ totalTokens: number; totalCostUsd: number }>({
    totalTokens: 0,
    totalCostUsd: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const recent = await tokenLogger.getRecentLogs();
      const s = await tokenLogger.getTotalTokens();
      setLogs(recent);
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-4">
      {/* Top metric overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Cpu className="h-4 w-4 text-blue-600" />
            <span>Total Token Digunakan</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {stats.totalTokens.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Model: gemini-3.8-flash & fallback rules
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span>Estimasi Biaya AI (USD)</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            ${stats.totalCostUsd.toFixed(4)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Dioptimalkan dengan token logging
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <Database className="h-4 w-4 text-purple-600" />
              <span>Log di server</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              {logs.length.toLocaleString('id-ID')} log tersimpan di server
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Audit Trail Pemanggilan AI & Token Logger
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={loadLogs}>
            Muat Ulang Log
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada aktivitas AI tercatat dalam sesi ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">Waktu</th>
                  <th className="px-3 py-2 font-semibold">Model</th>
                  <th className="px-3 py-2 font-semibold">Aksi</th>
                  <th className="px-3 py-2 font-semibold">Prompt Preview</th>
                  <th className="px-3 py-2 font-semibold text-right">Tokens</th>
                  <th className="px-3 py-2 font-semibold text-right">Biaya USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {log.model}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[260px] truncate">
                      {log.promptPreview}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      {log.tokensUsed}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      ${log.estimatedCostUsd.toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
