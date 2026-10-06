-- Quick search chips on the admin SKU list; terms that exist in the ERP catalog.
INSERT INTO ref_options (list, value, label, sort, meta) VALUES
  ('sku_quick_search', 'SARUNG TANGAN', 'Sarung Tangan', 1, '{}'),
  ('sku_quick_search', 'STETOSKOP', 'Stetoskop', 2, '{}'),
  ('sku_quick_search', 'TENSIMETER', 'Tensimeter', 3, '{}'),
  ('sku_quick_search', 'SYRINGE', 'Syringe', 4, '{}'),
  ('sku_quick_search', 'KATETER', 'Kateter', 5, '{}'),
  ('sku_quick_search', 'KURSI RODA', 'Kursi Roda', 6, '{}'),
  ('sku_quick_search', 'TONER', 'Toner', 7, '{}')
ON CONFLICT (list, value) DO NOTHING;
