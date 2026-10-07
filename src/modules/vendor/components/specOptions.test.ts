// Run: bun src/modules/vendor/components/specOptions.test.ts
import assert from 'node:assert/strict';

(globalThis as any).localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).indexedDB ??= { deleteDatabase() {} };
const { getSpecOptionsForRow, masterSkuForSpec } = await import('./VendorSpreadsheetGrid');

const sku = (id: string, generalSpec: string) => ({ id, commodityName: 'Kasa', generalSpec, uom: 'PCS' }) as any;
const row = {
  sku: sku('a', '10 x 10 cm'),
  specification: '',
  candidateErpSkus: [sku('a', '10 x 10 cm'), sku('b', '10 X 10 CM'), sku('c', '5 x 5 cm'), sku('d', '')],
} as any;

assert.deepEqual(getSpecOptionsForRow(row), ['5 x 5 cm', '10 x 10 cm']);
assert.equal(masterSkuForSpec(row, ' 5 X 5 CM ')?.id, 'c');
assert.equal(masterSkuForSpec(row, 'spek vendor sendiri'), undefined);
assert.equal(masterSkuForSpec(row, ''), undefined);
console.log('spec options ok');
