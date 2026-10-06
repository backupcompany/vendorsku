import { z } from 'zod';
import { apiError, http } from '../../api/http';
import { AiLogEntry } from '../../types';

const aiLogSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  timestamp: z.string(),
  model: z.string(),
  action: z.enum(['sku_parse', 'tender_analysis', 'rag_search', 'chat_assist']),
  promptPreview: z.string(),
  tokensUsed: z.number(),
  estimatedCostUsd: z.number(),
});

class TokenLoggerService {
  private sessionId: string;

  constructor() {
    this.sessionId = 'sess-' + Math.random().toString(36).substring(2, 9);
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public async logUsage(params: {
    action: AiLogEntry['action'];
    promptPreview: string;
    tokensUsed: number;
    model?: string;
  }): Promise<AiLogEntry> {
    try {
      const res = await http.post('/api/staff/ai-logs', {
        sessionId: this.sessionId,
        action: params.action,
        promptPreview: params.promptPreview,
        tokensUsed: params.tokensUsed,
        model: params.model || 'gemini-3.8-flash',
      });
      return aiLogSchema.parse(res.data);
    } catch (err) {
      if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
      console.warn('Could not persist token log:', err);
      throw apiError(err, 'Log AI gagal disimpan.');
    }
  }

  public async getRecentLogs(): Promise<AiLogEntry[]> {
    try {
      const { data } = await http.get('/api/staff/ai-logs');
      return z.array(aiLogSchema).parse(data);
    } catch (err) {
      if (err instanceof z.ZodError) throw new Error('Bentuk data server tidak sesuai.');
      throw apiError(err, 'Log AI gagal dimuat.');
    }
  }

  public async getTotalTokens(): Promise<{ totalTokens: number; totalCostUsd: number }> {
    const logs = await this.getRecentLogs();
    const totalTokens = logs.reduce((sum, item) => sum + (item.tokensUsed || 0), 0);
    const totalCostUsd = logs.reduce((sum, item) => sum + (item.estimatedCostUsd || 0), 0);
    return { totalTokens, totalCostUsd };
  }
}

export const tokenLogger = new TokenLoggerService();
