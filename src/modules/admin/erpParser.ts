import * as XLSX from 'xlsx';
import type { MasterSku } from '../../core/types';
import { cleanCommodityName } from '../sku/cleanName';

export const ERP_HEADERS = [
  'Product ID', 'Name',
  'Purch Category Lv 1', 'Purch Category Lv 2', 'Purch Category Lv 3', 'Purch Category Lv 4',
  'Document Type', 'Item Id', 'Fa Category', 'Sp Item Id', 'Unit of Measurement', 'Is Generic Product',
  'Brand', 'Specification 1', 'Specification 2', 'Specification 3', 'Part Number',
  'Standard Price', 'Is Active', 'Is Contract',
] as const;
type ErpHeader = (typeof ERP_HEADERS)[number];
export type ErpCell = string | number | boolean | null;
export type ErpIssue = { row: number; reason: string };
export type ErpParse = { skus: MasterSku[]; issues: ErpIssue[]; rowCount: number };

// ERP writes '-', 'NB' (no brand) and 'NP' (no part number) into empty spec cells.
const PLACEHOLDERS = new Set(['-', 'NB', 'NP', 'NULL', 'NONE']);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (v: ErpCell | undefined) => (v === null || v === undefined ? '' : String(v).trim());

export const skuIdOf = (erpCode: string) => 'sku-erp-' + erpCode.replace(/[^a-zA-Z0-9]/g, '_');

export function erpFlag(v: ErpCell | undefined): boolean | undefined {
  if (typeof v === 'boolean') return v;
  const t = text(v).toUpperCase();
  if (['TRUE', 'YES', 'Y', '1'].includes(t)) return true;
  if (['FALSE', 'NO', 'N', '0'].includes(t)) return false;
  return undefined;
}

export function erpPrice(v: ErpCell | undefined): number | undefined | 'invalid' {
  if (v === null || v === undefined || text(v) === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : 'invalid';
  const t = text(v);
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : 'invalid';
}

export function erpGeneralSpec(...specs: string[]): string {
  const parts = specs
    .flatMap((s) => s.split(';').map((p) => p.trim()))
    .filter((s) => s && !PLACEHOLDERS.has(s.toUpperCase()));
  return parts.length > 0 ? parts.join(' ; ') : 'Standar Katalog';
}

/** Reads the first sheet of an ERP Master Product Catalog export; bad rows are reported, never patched up. */
export function parseErpWorkbook(data: ArrayBuffer | Uint8Array, openForVendor: boolean): ErpParse {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.['!ref']) throw new Error('File Excel kosong.');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerCells: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headerCells.push(cell ? String(cell.v) : '');
  }
  const column = new Map<ErpHeader, string>();
  for (const header of ERP_HEADERS) {
    const found = headerCells.filter((h) => norm(h) === norm(header));
    if (found.length > 1) throw new Error(`Kolom "${header}" muncul lebih dari sekali.`);
    if (found.length === 1) column.set(header, found[0]);
  }
  const missing = ERP_HEADERS.filter((h) => !column.has(h));
  if (missing.length > 0) throw new Error(`Kolom ERP wajib tidak ditemukan: ${missing.join(', ')}.`);

  const rows = XLSX.utils.sheet_to_json<Record<string, ErpCell>>(sheet, { defval: null, raw: true, blankrows: false });
  const skus: MasterSku[] = [];
  const issues: ErpIssue[] = [];
  const rowOfErp = new Map<string, number>();
  const erpOfId = new Map<string, string>();

  for (const row of rows) {
    const rowNum = ((row as { __rowNum__?: number }).__rowNum__ ?? 0) + 1;
    const get = (h: ErpHeader) => row[column.get(h)!];
    const problems: string[] = [];

    const erpCode = text(get('Product ID'));
    if (!erpCode) problems.push('Product ID kosong');
    else if (rowOfErp.has(erpCode)) problems.push(`Product ID ${erpCode} sama dengan baris ${rowOfErp.get(erpCode)}`);
    const id = skuIdOf(erpCode);
    if (erpCode && erpOfId.has(id) && erpOfId.get(id) !== erpCode) {
      problems.push(`Product ID ${erpCode} bentrok ID dengan ${erpOfId.get(id)}`);
    }

    const commodityName = cleanCommodityName(text(get('Name')));
    if (!commodityName) problems.push('Name kosong');
    const levels = (['Purch Category Lv 1', 'Purch Category Lv 2', 'Purch Category Lv 3', 'Purch Category Lv 4'] as const).map(
      (h) => {
        const value = text(get(h));
        if (!value) problems.push(`${h} kosong`);
        return value;
      },
    );
    const uom = text(get('Unit of Measurement'));
    if (!uom) problems.push('Unit of Measurement kosong');

    const price = erpPrice(get('Standard Price'));
    if (price === 'invalid') problems.push(`Standard Price "${text(get('Standard Price'))}" bukan angka ≥ 0`);
    const [isActive, isGeneric, isContract] = (['Is Active', 'Is Generic Product', 'Is Contract'] as const).map((h) => {
      const flag = erpFlag(get(h));
      if (flag === undefined) problems.push(`${h} harus TRUE/FALSE`);
      return flag;
    });

    if (problems.length > 0) {
      issues.push({ row: rowNum, reason: problems.join('; ') });
      continue;
    }
    rowOfErp.set(erpCode, rowNum);
    erpOfId.set(id, erpCode);

    const spec1 = text(get('Specification 1'));
    const spec2 = text(get('Specification 2'));
    const spec3 = text(get('Specification 3'));
    const brand = text(get('Brand'));
    const part = text(get('Part Number'));
    skus.push({
      id,
      erpCode,
      level1: levels[0],
      level2: levels[1],
      level3: levels[2],
      level4: levels[3],
      commodityName,
      generalSpec: erpGeneralSpec(spec1, spec2, spec3),
      defaultBrand: brand && brand.toUpperCase() !== 'NB' ? brand : undefined,
      defaultPartNumber: part && part.toUpperCase() !== 'NP' ? part : undefined,
      uom,
      benchmarkPrice: price as number | undefined,
      isOpenForVendor: openForVendor && isActive!,
      isActive,
      status: isActive ? 'active' : 'archived',
      documentType: text(get('Document Type')) || undefined,
      itemId: text(get('Item Id')) || undefined,
      faCategory: text(get('Fa Category')) || undefined,
      spItemId: text(get('Sp Item Id')) || undefined,
      isGenericProduct: isGeneric,
      isContract,
      spec1: spec1 || undefined,
      spec2: spec2 || undefined,
      spec3: spec3 || undefined,
      sourceRow: { ...row },
      isUploaded: true,
      source: 'erp_upload',
      createdAt: '',
      updatedAt: '',
    });
  }
  return { skus, issues, rowCount: rows.length };
}

const utf8 = new TextEncoder();

/** Splits by encoded JSON size so every request stays under the API's 1 MB body cap. */
export function chunkByBytes<T>(items: T[], maxBytes = 900_000): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const item of items) {
    const n = utf8.encode(JSON.stringify(item)).length + 1;
    if (current.length > 0 && size + n > maxBytes) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += n;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** The SKU upsert is idempotent per Product ID, so a failed chunk is safe to resend. */
export async function importInChunks<T>(
  items: T[],
  post: (chunk: T[]) => Promise<number>,
  onProgress?: (saved: number, total: number) => void,
): Promise<number> {
  let saved = 0;
  for (const chunk of chunkByBytes(items)) {
    for (let attempt = 1; ; attempt++) {
      try {
        const n = await post(chunk);
        if (n !== chunk.length) throw new Error(`Server menyimpan ${n} dari ${chunk.length} SKU.`);
        saved += n;
        break;
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
    onProgress?.(saved, items.length);
  }
  return saved;
}
