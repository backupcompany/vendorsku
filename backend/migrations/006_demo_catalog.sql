-- Demo catalog the screens already show: six SKUs and five bids.
-- Same rows as src/core/db/initialMockData.ts. Writes from the form still
-- land in the browser until the price POST exists.

INSERT INTO master_skus (
  id, erp_code, level1, level2, level3, level4,
  commodity_name, general_spec, default_brand, default_part_number,
  uom, benchmark_price, is_open_for_vendor, is_active, status,
  is_uploaded, source, created_at, updated_at
) VALUES
  ('sku-demo-spuit', '160101010001', 'DIAGNOSTIC AND MEDICAL DEVICES', 'SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS', 'INJECTION SUPPLIES', 'SYRINGE',
   'Spuit', '3 cc Luer Lock steril sekali pakai', 'Terumo', 'SS-03L',
   'Box', 17500, true, true, 'active', false, 'seed', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sku-demo-infus', '160101010014', 'DIAGNOSTIC AND MEDICAL DEVICES', 'SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS', 'IV THERAPY', 'INFUSION SET',
   'Infus Set', 'Makro 20 tetes dewasa steril', 'Terumo', 'TI-IS20',
   'Pcs', 12500, true, true, 'active', false, 'seed', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sku-demo-defib', '160202020088', 'DIAGNOSTIC AND MEDICAL DEVICES', 'CARDIOLOGY & VASCULAR DEVICES', 'RESUSCITATION', 'DEFIBRILLATOR',
   'Defibrillator', 'Biphasic dengan monitor AED', NULL, NULL,
   'Unit', 48000000, true, true, 'active', false, 'seed', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sku-demo-ventilator', '160303030021', 'DIAGNOSTIC AND MEDICAL DEVICES', 'ICU & CRITICAL CARE SYSTEMS', 'VENTILATION', 'PORTABLE VENTILATOR',
   'Ventilator', 'Portabel invasif dan non-invasif', NULL, NULL,
   'Unit', 125000000, true, true, 'active', false, 'seed', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sku-demo-gloves', '170404040007', 'GENERAL SUPPLIES', 'CONSUMABLES & DISPOSABLES', 'HAND PROTECTION', 'EXAMINATION GLOVES',
   'Sarung Tangan Pemeriksaan', 'Nitril non-steril ukuran M', NULL, NULL,
   'Box', 85000, true, true, 'active', false, 'seed', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sku-demo-locked', '170505050003', 'GENERAL SUPPLIES', 'LINEN & UNIFORM', 'BED LINEN', 'BEDSHEET',
   'Sprei Pasien', 'Katun 180 x 200 cm', NULL, NULL,
   'Pcs', 95000, false, true, 'active', false, 'seed', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_prices (
  id, sku_id, sku_erp_code, vendor_id,
  commodity_name, general_spec, vendor_brand, vendor_part_number, full_formatted_sku_name,
  price_list_exclude_vat, discount_percent, nett_price_exclude_vat, unit_price,
  tax_percent, price_with_tax, uom, moq, lead_time_days, price_valid_until,
  kemenkes_license, status, submitted_at, updated_at
) VALUES
  ('sub-demo-spuit-1', 'sku-demo-spuit', '160101010001', 'vnd-001',
   'Spuit', '3 cc Luer Lock steril sekali pakai', 'Terumo', 'SS-03L',
   'Spuit ; 3 cc Luer Lock steril sekali pakai ; Terumo ; SS-03L',
   18000, 10, 16200, 16200, 11, 17982, 'Box', 1, 5, '2026-12-31',
   'AKL 21601234567', 'submitted', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sub-demo-spuit-2', 'sku-demo-spuit', '160101010001', 'vnd-002',
   'Spuit', '3 cc Luer Lock steril sekali pakai', 'OneMed', 'OM-3CC',
   'Spuit ; 3 cc Luer Lock steril sekali pakai ; OneMed ; OM-3CC',
   20000, 0, 20000, 20000, 11, 22200, 'Box', 1, 14, '2026-12-31',
   'AKL 21601234567', 'submitted', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sub-demo-defib-1', 'sku-demo-defib', '160202020088', 'vnd-001',
   'Defibrillator', 'Biphasic dengan monitor AED', 'Mindray', 'BeneHeart D3',
   'Defibrillator ; Biphasic dengan monitor AED ; Mindray ; BeneHeart D3',
   45000000, 0, 45000000, 45000000, 11, 49950000, 'Unit', 1, 21, '2026-12-31',
   'AKL 21601234567', 'submitted', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sub-demo-defib-2', 'sku-demo-defib', '160202020088', 'vnd-002',
   'Defibrillator', 'Biphasic dengan monitor AED', 'Philips', 'HeartStart',
   'Defibrillator ; Biphasic dengan monitor AED ; Philips ; HeartStart',
   42000000, 5, 39900000, 39900000, 11, 44289000, 'Unit', 1, 30, '2026-12-31',
   'AKL 21601234567', 'submitted', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('sub-demo-gloves-1', 'sku-demo-gloves', '170404040007', 'vnd-003',
   'Sarung Tangan Pemeriksaan', 'Nitril non-steril ukuran M', 'Sensi', 'Nitril-M',
   'Sarung Tangan Pemeriksaan ; Nitril non-steril ukuran M ; Sensi ; Nitril-M',
   90000, 8, 82800, 82800, 11, 91908, 'Box', 1, 7, '2026-12-31',
   'AKL 21601234567', 'submitted', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
