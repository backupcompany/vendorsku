import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// --- Strict edge middleware (BFF behind Caddy; still enforce here) ---
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (_req.secure || _req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use((req, res, next) => {
  const allowed = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'];
  if (!allowed.includes(req.method)) {
    res.status(405).json({ error: 'Method tidak diizinkan.' });
    return;
  }
  next();
});

app.use(express.json({ limit: '8mb' }));

const goPort = process.env.GO_PORT || '8080';

function clientIpOf(req: express.Request): string {
  const socketIp = req.socket.remoteAddress ?? '';
  const viaLocalProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socketIp);
  const realIp = req.headers['x-real-ip'];
  return viaLocalProxy && typeof realIp === 'string' && realIp ? realIp : socketIp;
}

// ponytail: in-memory AI quota per actor+IP; Redis if multi-instance matters.
const aiHits = new Map<string, number[]>();
function allowAiHit(key: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const kept = (aiHits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (kept.length >= limit) {
    aiHits.set(key, kept);
    return false;
  }
  kept.push(now);
  aiHits.set(key, kept);
  return true;
}

function proxyGo(req: express.Request, res: express.Response) {
  const body = req.method === 'GET' || req.method === 'HEAD' ? null : JSON.stringify(req.body ?? {});
  const clientIp = clientIpOf(req);
  const pick = (name: string) => {
    const v = req.headers[name];
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const headers: http.OutgoingHttpHeaders = {
    host: `127.0.0.1:${goPort}`,
    'content-type': pick('content-type') || 'application/json',
    accept: pick('accept') || 'application/json',
    'x-forwarded-for': clientIp,
    'x-forwarded-proto': pick('x-forwarded-proto') || (req.secure ? 'https' : 'http'),
  };
  const cookie = pick('cookie');
  if (cookie) headers.cookie = cookie;
  const realm = pick('x-session-realm');
  if (realm) headers['x-session-realm'] = realm;
  if (body !== null) headers['content-length'] = Buffer.byteLength(body);
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: goPort,
      path: req.originalUrl,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (value !== undefined && key !== 'transfer-encoding') res.setHeader(key, value);
      }
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'Backend belum jalan.' });
  });
  if (body !== null) upstream.write(body);
  upstream.end();
}

// Health on BFF; AI gated below; all other /api/* proxied to Go (incl. /api/password).
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Gemini costs money: require a real signed-in session (kind must be vendor|staff).
// Note: GET /api/session returns 200 with kind:null when logged out — do not trust status alone.
app.use('/api/ai', (req, res, next) => {
  const check = http.request(
    {
      hostname: '127.0.0.1',
      port: goPort,
      path: '/api/session',
      method: 'GET',
      headers: {
        cookie: req.headers.cookie ?? '',
        'x-session-realm': String(req.headers['x-session-realm'] ?? ''),
      },
    },
    (goRes) => {
      const chunks: Buffer[] = [];
      goRes.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      goRes.on('end', () => {
        if (goRes.statusCode !== 200) {
          res.status(401).json({ error: 'Sesi berakhir. Silakan masuk lagi.' });
          return;
        }
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            kind?: string | null;
            actorId?: string | null;
          };
          if (data.kind === 'vendor' || data.kind === 'staff') {
            const key = `${data.kind}:${data.actorId ?? '?'}:${clientIpOf(req)}`;
            if (!allowAiHit(key)) {
              res.status(429).json({ error: 'Terlalu banyak permintaan AI. Coba lagi sebentar.' });
              return;
            }
            res.locals.aiKind = data.kind;
            next();
            return;
          }
        } catch {
          /* fall through */
        }
        res.status(401).json({ error: 'Sesi berakhir. Silakan masuk lagi.' });
      });
    },
  );
  check.on('error', () => res.status(502).json({ error: 'Backend belum jalan.' }));
  check.end();
});

app.use('/api', (req, res, next) => {
  // Mounted at /api, so path is relative (e.g. /password, /ai/...).
  if (req.path === '/health' || req.path.startsWith('/ai')) {
    next();
    return;
  }
  proxyGo(req, res);
});

// Server-side Gemini initialization if key exists
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}
const llmModel = process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash';

// AI SKU Parser & Taxonomy Matcher API
app.post('/api/ai/parse-sku', async (req, res) => {
  const { rawText, catalogSummary } = req.body;

  if (!rawText) {
    return res.status(400).json({ error: 'rawText is required' });
  }

  // If no Gemini API key configured, return smart structured fallback
  if (!aiClient) {
    return res.json({
      fallback: true,
      parsed: parseSkuFallback(rawText),
      tokensUsed: 0,
      model: 'rule-based-offline',
    });
  }

  try {
    const prompt = `Anda adalah sistem AI Master Data SKU Rumah Sakit.
Aturan penamaan SKU:
Nama SKU terdiri dari 4 bagian dipisahkan titik koma:
[Commodity Name] ; [General Specification] ; [Brand] ; [Part / REF / Catalog Number]

Dan taksonomi 4-level:
- Level 1: Kategori Utama (e.g. Alat Kesehatan & BMHP, Farmasi & Obat, Peralatan Medis & Diagnostik, Laboratorium & Reagen)
- Level 2: Sub-Kategori (e.g. Spuit & Jarum Suntik, Kasa & Balutan Bedah, Catheter & Selang Infus, Obat Injeksi)
- Level 3: Kelompok Produk (e.g. Spuit 3cc Luer Lock, Kasa Hidrofilik Steril)
- Level 4: Tipe Teknis (e.g. Steril Sekali Pakai Non-Toxic)

Ekstrak teks produk vendor mentah berikut ke dalam format JSON terstruktur:
Teks Vendor: "${rawText}"

Contoh konteks SKU yang relevan:
${catalogSummary || 'Katalog mencakup BMHP, Spuit, Infuset, Jarum, Kasa, Kateter, Handschoen/Gloves, Paracetamol, Antibakteri, Stetoskop'}

Kembalikan HANYA format JSON valid tanpa markdown atau backticks:
{
  "commodityName": "nama komoditas umum",
  "generalSpec": "spesifikasi teknis umum tanpa merk",
  "vendorBrand": "nama merk atau brand terdeteksi",
  "vendorPartNumber": "nomor part/katalog/AKD/AKL jika ada",
  "uom": "satuan (Box / Pcs / Ampul / Vial / Roll)",
  "estimatedPrice": 0,
  "level1": "kategori level 1",
  "level2": "sub-kategori level 2",
  "level3": "kelompok produk level 3",
  "level4": "tipe spesifik level 4",
  "confidenceScore": 0.95,
  "matchingNotes": "alasan pemetaan"
}`;

    const response = await aiClient.models.generateContent({
      model: llmModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    res.json({
      fallback: false,
      parsed: parsedData,
      tokensUsed: 250,
      model: llmModel,
    });
  } catch (err: any) {
    console.error('Gemini parse error:', err);
    res.json({
      fallback: true,
      parsed: parseSkuFallback(rawText),
      tokensUsed: 0,
      model: 'rule-based-offline',
      error: err.message,
    });
  }
});

// AI Tender Price Analysis API (staff-only — contains competitor pricing).
app.post('/api/ai/tender-analysis', async (req, res) => {
  if (res.locals.aiKind !== 'staff') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }
  const { skuName, submissions } = req.body;
  if (Array.isArray(submissions) && submissions.length > 50) {
    return res.status(400).json({ error: 'Maksimal 50 penawaran per analisis.' });
  }

  if (!aiClient) {
    return res.json({
      analysis: 'Analisis otomatis: Perbandingan harga menunjukkan selisih kompetitif antara vendor penawar. Pastikan verifikasi nomor izin edar Kemenkes AKD/AKL dan ketersediaan stok.',
      recommendedVendorId: submissions?.[0]?.vendorId || null,
      tokensUsed: 0,
    });
  }

  try {
    const prompt = `Anda adalah Konsultan Pengadaan Medis.
Evaluasi penawaran harga vendor untuk SKU: "${skuName}".

Data Penawaran Vendor:
${JSON.stringify(submissions, null, 2)}

Berikan analisis singkat, obyektif, dan rekomendasi vendor terbaik dengan mempertimbangkan:
1. Harga terendah & rasionalitas biaya
2. Minimum Order Quantity (MOQ)
3. Lead Time pengiriman
4. Izin edar resmi KEMENKES (AKD/AKL)

Format output JSON:
{
  "summary": "Ringkasan komparasi harga",
  "recommendedVendorName": "nama vendor yang direkomendasikan",
  "keyStrengths": ["poin 1", "poin 2"],
  "riskWarnings": ["risko jika ada"],
  "savingPotentialPercent": 12.5
}`;

    const response = await aiClient.models.generateContent({
      model: llmModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const data = JSON.parse(response.text || '{}');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Heuristic column mapper helper
function heuristicMapColumns(columns: string[]) {
  const cleanCols = columns.map((c) => ({ original: c, norm: c.toLowerCase().trim() }));
  const findCol = (keywords: string[]) => {
    const match = cleanCols.find((c) => keywords.some((k) => c.norm.includes(k)));
    return match ? match.original : '';
  };

  return {
    productNameCol: findCol(['nama barang', 'nama produk', 'product name', 'item name', 'nama komoditas', 'deskripsi produk', 'item description', 'description', 'produk', 'barang']) || columns[0] || '',
    specCol: findCol(['spesifikasi', 'specification', 'spec', 'ukuran', 'size', 'keterangan', 'detail']),
    brandCol: findCol(['brand', 'merk', 'merek', 'manufacturer', 'pabrikan', 'prinsipal']),
    partNumberCol: findCol(['part number', 'part no', 'ref', 'katalog', 'catalog', 'kode barang', 'item code', 'sku code', 'tipe', 'type', 'model']),
    uomCol: findCol(['uom', 'satuan', 'unit', 'kemasan', 'packaging']),
    priceCol: findCol(['harga satuan', 'harga', 'price', 'unit price', 'hps', 'tarif', 'price list', 'nett price', 'biaya']) || columns[columns.length - 1] || '',
    discountCol: findCol(['diskon', 'discount', 'disc']),
    kemenkesCol: findCol(['izin edar', 'kemenkes', 'akd', 'akl', 'nie', 'no izin']),
  };
}

// AI Column Structure Understanding & Mapping API
app.post('/api/ai/map-columns', async (req, res) => {
  const { columns, sampleRows, fileName } = req.body;
  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ error: 'columns array is required' });
  }

  const fallbackMapping = heuristicMapColumns(columns);

  if (!aiClient) {
    return res.json({
      fallback: true,
      mapping: fallbackMapping,
      explanation: 'Pemetaan kolom otomatis menggunakan algoritma linguistik heuristik.',
      tokensUsed: 0,
    });
  }

  try {
    const prompt = `Anda adalah sistem AI integrasi data pengadaan rumah sakit.
Tugas: Menganalisa struktur kolom tabel dari dokumen price list vendor (${fileName || 'dokumen vendor'}).

Daftar Kolom Terdeteksi di Dokumen:
${JSON.stringify(columns, null, 2)}

Contoh Baris Data (maksimal 3 baris):
${JSON.stringify(sampleRows?.slice(0, 3) || [], null, 2)}

Petakan kolom-kolom di atas ke field standar katalog berikut:
- productNameCol: Kolom yang memuat nama produk / komoditas (wajib)
- specCol: Kolom spesifikasi teknis / ukuran / deskripsi
- brandCol: Kolom merk / brand / pabrikan
- partNumberCol: Kolom nomor part / REF / tipe / kode katalog
- uomCol: Kolom satuan unit (Box, Pcs, Vial, dll)
- priceCol: Kolom harga satuan penawaran / list price (wajib)
- discountCol: Kolom diskon (%) jika ada
- kemenkesCol: Kolom nomor izin edar Kemenkes (AKD/AKL) jika ada

Kembalikan HANYA format JSON valid tanpa markdown backticks:
{
  "mapping": {
    "productNameCol": "nama kolom persis seperti di daftar kolom",
    "specCol": "nama kolom atau null",
    "brandCol": "nama kolom atau null",
    "partNumberCol": "nama kolom atau null",
    "uomCol": "nama kolom atau null",
    "priceCol": "nama kolom persis",
    "discountCol": "nama kolom atau null",
    "kemenkesCol": "nama kolom atau null"
  },
  "explanation": "penjelasan singkat alasan pemetaan"
}`;

    const response = await aiClient.models.generateContent({
      model: llmModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      fallback: false,
      mapping: parsed.mapping || fallbackMapping,
      explanation: parsed.explanation || 'Kolom berhasil dipetakan secara cerdas oleh AI.',
      tokensUsed: 150,
    });
  } catch (err: any) {
    console.warn('AI map columns error, using heuristic:', err);
    res.json({
      fallback: true,
      mapping: fallbackMapping,
      explanation: 'Pemetaan kolom menggunakan aturan heuristik cerdas.',
      error: err.message,
    });
  }
});

// AI PDF Price List Parser API
app.post('/api/ai/parse-pdf-document', async (req, res) => {
  const { base64Data, fileName } = req.body;
  if (!base64Data || typeof base64Data !== 'string') {
    return res.status(400).json({ error: 'base64Data is required' });
  }
  if (base64Data.length > 6_000_000) {
    return res.status(413).json({ error: 'PDF terlalu besar (maks ~4.5 MB).' });
  }

  if (!aiClient) {
    return res.status(503).json({ error: 'AI Client belum dikonfigurasi di server' });
  }

  try {
    const prompt = `Anda adalah asisten AI ekstraksi data price list.
Ekstrak seluruh tabel daftar produk dan penawaran harga dari dokumen PDF price list ini (${fileName || 'price list vendor'}).
Maksimal ekstrak hingga 1.000 baris data.

Format output JSON valid tanpa markdown backticks:
{
  "detectedColumns": ["Nama Produk", "Spesifikasi", "Merk", "No. Katalog", "Satuan", "Harga Satuan", "Diskon", "Izin Edar"],
  "rows": [
    {
      "Nama Produk": "string",
      "Spesifikasi": "string",
      "Merk": "string",
      "No. Katalog": "string",
      "Satuan": "string",
      "Harga Satuan": 150000,
      "Diskon": 0,
      "Izin Edar": "AKD/AKL..."
    }
  ]
}`;

    const response = await aiClient.models.generateContent({
      model: llmModel,
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const data = JSON.parse(response.text || '{}');
    res.json(data);
  } catch (err: any) {
    console.error('PDF parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI Semantic SKU Matching & Verification API
app.post('/api/ai/match-skus', async (req, res) => {
  const { items, candidateSkus } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }
  if (items.length > 200) {
    return res.status(400).json({ error: 'Maksimal 200 item per permintaan match.' });
  }

  if (!aiClient) {
    return res.status(503).json({ error: 'AI Client not configured', fallback: true });
  }

  try {
    // Provide a compact representation of candidates to save tokens
    const compactCandidates = (candidateSkus || []).slice(0, 500).map((c: any) => ({
      id: c.id,
      code: c.erpCode,
      name: c.commodityName,
      spec: c.generalSpec,
      l1: c.level1,
      l2: c.level2,
      l3: c.level3,
      l4: c.level4,
      brand: c.defaultBrand,
      part: c.defaultPartNumber,
    }));

    const prompt = `Anda adalah AI Medical Procurement Sourcing Specialist.
Tugas: Memadankan (matching) setiap produk yang diupload vendor dengan Master SKU yang relevan dari daftar kandidat Master SKU berikut.

Daftar Master SKU Tersedia (${compactCandidates.length} SKU):
${JSON.stringify(compactCandidates, null, 1)}

Daftar Produk yang Diunggah Vendor:
${JSON.stringify(items, null, 1)}

ATURAN KRUSIAL PENCOCOKAN:
1. Ketelitian Medis: Produk medis (seperti Defibrillator, Ventilator, KED Extrication Device, Spuit, Kateter, Infus) DILARANG KERAS dipadankan dengan produk non-medis / makanan / pantry / umum (seperti Gelas Puding, Kotak Snack, ATK, Sabun).
2. Jika suatu produk vendor TIDAK memiliki padanan yang mirip atau setara di daftar Master SKU, kembalikan matchedSkuId: null, confidenceScore: 0.0, confidenceLevel: "none", dan berikan matchExplanation yang jelas bahwa SKU ini belum tersedia di katalog.
3. Tingkat Confidence:
   - "high" (>= 0.80): Komoditas sama persis atau sinonim klinis langsung (misal: Defibrillator -> Alat Kejut Jantung / Defib, KED -> Kendrick Extrication Device, Ventilator -> Portable Ventilator).
   - "medium" (0.50 - 0.79): Kategori dan fungsi dasar sama namun ada perbedaan kapasitas, ukuran, atau merk.
   - "low" (0.20 - 0.49): Sangat sedikit kesamaan fungsional.
   - "none" (0.00): Tidak ada kemiripan komoditas sama sekali (JANGAN paksakan mencocokkan).

Kembalikan format JSON murni tanpa markdown:
{
  "matches": [
    {
      "itemId": "string",
      "matchedSkuId": "string atau null",
      "confidenceScore": 0.95,
      "confidenceLevel": "high",
      "matchExplanation": "Penjelasan mengapa cocok atau mengapa tidak ada padanan di database"
    }
  ]
}`;

    const response = await aiClient.models.generateContent({
      model: llmModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      fallback: false,
      matches: parsed.matches || [],
      tokensUsed: 250,
    });
  } catch (err: any) {
    console.warn('AI SKU matching error, falling back to local statistical:', err);
    res.status(500).json({ error: err.message, fallback: true });
  }
});

// Catalog Management only: simplify vendor raw name/spec into hospital e-catalog form.
app.post('/api/ai/standardize-catalog', async (req, res) => {
  if (res.locals.aiKind !== 'staff') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya Back Office yang boleh menstandarkan katalog.' });
  }
  const commodityName = String(req.body?.commodityName || '').trim();
  const generalSpec = String(req.body?.generalSpec || '').trim();
  const level1 = String(req.body?.level1 || '').trim();
  const brochureText = String(req.body?.brochureText || '').trim().slice(0, 8000);
  if (!commodityName || !generalSpec) {
    return res.status(400).json({ error: 'commodityName dan generalSpec wajib diisi.' });
  }

  const fallback = () => standardizeCatalogFallback(commodityName, generalSpec, level1, brochureText);

  if (!aiClient) {
    return res.json({ ...fallback(), tokensUsed: 0, model: 'rule-based-offline', fallback: true });
  }

  try {
    const prompt = `Anda adalah Catalog Management.
Tugas: standarisasi data produk vendor menjadi e-katalog rumah sakit yang singkat dan konsisten.
JANGAN menghapus informasi penting untuk pemilihan produk (material, ukuran, standar/sertifikasi, AQL, tipe).
Jangan inventarisasi data yang tidak ada di input.

Nama vendor: ${commodityName}
Spesifikasi vendor (raw):
${generalSpec}
Level 1 (jika ada): ${level1 || '-'}
Cuplikan brosur (opsional):
${brochureText || '-'}

Output JSON saja:
{
  "commodityName": "nama komoditas standar singkat",
  "generalSpec": "spesifikasi ringkas 1-2 kalimat, atribut kunci dipisah koma",
  "level1": "kategori purchasing level 1 bahasa Inggris seperti di ERP bila bisa disimpulkan, else kosong",
  "level2": "sub kategori singkat atau kosong",
  "level3": "kelompok singkat atau kosong",
  "level4": "tipe singkat atau kosong",
  "attributes": { "Material": "...", "Size": "...", "Standard": "..." }
}`;

    const response = await aiClient.models.generateContent({
      model: llmModel,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    const usage = (response as { usageMetadata?: { totalTokenCount?: number } }).usageMetadata;
    return res.json({
      commodityName: String(parsed.commodityName || commodityName).trim(),
      generalSpec: String(parsed.generalSpec || generalSpec).trim(),
      level1: String(parsed.level1 || level1 || '').trim(),
      level2: String(parsed.level2 || '').trim(),
      level3: String(parsed.level3 || '').trim(),
      level4: String(parsed.level4 || '').trim(),
      attributes: parsed.attributes && typeof parsed.attributes === 'object' ? parsed.attributes : {},
      tokensUsed: usage?.totalTokenCount || 0,
      model: llmModel,
      fallback: false,
    });
  } catch (err: any) {
    console.warn('AI standardize-catalog error, using fallback:', err?.message);
    return res.json({ ...fallback(), tokensUsed: 0, model: 'rule-based-offline', fallback: true, error: err?.message });
  }
});

function standardizeCatalogFallback(name: string, spec: string, level1: string, brochure: string) {
  const compact = spec
    .replace(/\s+/g, ' ')
    .replace(/\b(please note|note that|our product|we offer)\b/gi, '')
    .trim();
  const shortSpec = compact.length > 220 ? compact.slice(0, 217).replace(/[,;\s]+$/, '') + '…' : compact;
  const attrs: Record<string, string> = {};
  const mat = compact.match(/\b(latex|nitrile|cotton|katun|pvc|silicone|stainless|steel)\b/i);
  if (mat) attrs.Material = mat[1];
  const aql = compact.match(/\bAQL\s*([0-9.]+)/i);
  if (aql) attrs.AQL = aql[1];
  const std = compact.match(/\b(EN\s*\d+|ASTM\s*[A-Z0-9]+|ISO\s*\d+)\b/gi);
  if (std) attrs.Standard = std.slice(0, 3).join(', ');
  if (brochure && !attrs.Standard) {
    const fromBro = brochure.match(/\b(EN\s*\d+|ASTM\s*[A-Z0-9]+)\b/i);
    if (fromBro) attrs.Standard = fromBro[1];
  }
  return {
    commodityName: name.replace(/\s+/g, ' ').trim(),
    generalSpec: shortSpec,
    level1,
    level2: '',
    level3: '',
    level4: '',
    attributes: attrs,
  };
}

// Rule-based fallback parser for offline capability
function parseSkuFallback(text: string) {
  const clean = text.trim();
  const parts = clean.split(';').map((p) => p.trim());

  if (parts.length >= 4) {
    return {
      commodityName: parts[0] || 'Produk Medis',
      generalSpec: parts[1] || 'Spesifikasi Standar',
      vendorBrand: parts[2] || 'Merk Vendor',
      vendorPartNumber: parts[3] || 'REF-001',
      uom: 'Box',
      estimatedPrice: 0,
      level1: 'Alat Kesehatan & BMHP',
      level2: 'Peralatan Medis Habis Pakai',
      level3: parts[0] || 'Umum',
      level4: 'Steril Sekali Pakai',
      confidenceScore: 0.85,
      matchingNotes: 'Diparsing otomatis dari format titik koma',
    };
  }

  return {
    commodityName: clean.split(' ')[0] + ' ' + (clean.split(' ')[1] || ''),
    generalSpec: clean,
    vendorBrand: 'Vendor Brand',
    vendorPartNumber: 'REF-' + Math.floor(Math.random() * 90000 + 10000),
    uom: 'Pcs',
    estimatedPrice: 0,
    level1: 'Alat Kesehatan & BMHP',
    level2: 'Spuit & Perlengkapan Injeksi',
    level3: 'Habis Pakai Medis',
    level4: 'Standar RS',
    confidenceScore: 0.65,
    matchingNotes: 'Diparsing melalui deteksi heuristik teks mentah',
  };
}

// Development and production server setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const host = process.env.HOST || '127.0.0.1';
  app.listen(Number(port), host, () => {
    console.log(`Vendor SKU Portal server running on ${host}:${port}`);
  });
}

startServer();
