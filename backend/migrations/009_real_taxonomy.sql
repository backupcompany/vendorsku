-- Level 2 names are unique across Level 1 in the ERP catalog, so a scope that lists
-- Level 2 values covers every Level 1 the vendor picked, not only the first one.
CREATE OR REPLACE FUNCTION vendor_catalog(p_vendor_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH v AS (
    SELECT * FROM vendors WHERE id = p_vendor_id
  ),
  open_skus AS (
    SELECT s.*
    FROM master_skus s
    WHERE s.is_open_for_vendor
      AND s.status <> 'archived'
      AND coalesce(s.is_active, true)
  ),
  scoped AS (
    SELECT s.*
    FROM open_skus s
    CROSS JOIN v
    WHERE v.business_scope IS NOT NULL
      AND CASE
        WHEN coalesce(jsonb_array_length(v.business_scope->'level2List'), 0) = 0
          THEN lower(trim(s.level1)) = lower(trim(v.business_scope->>'level1'))
        ELSE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(v.business_scope->'level2List') AS l2(value)
          WHERE lower(trim(l2.value)) = lower(trim(s.level2))
        )
      END
  ),
  chosen AS (
    SELECT * FROM scoped
    WHERE EXISTS (SELECT 1 FROM v WHERE business_scope IS NOT NULL)
      AND EXISTS (SELECT 1 FROM scoped)
    UNION ALL
    SELECT * FROM open_skus
    WHERE EXISTS (SELECT 1 FROM v)
      AND (
        EXISTS (SELECT 1 FROM v WHERE business_scope IS NULL)
        OR NOT EXISTS (SELECT 1 FROM scoped)
      )
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM v) THEN NULL
    ELSE (
      SELECT coalesce(jsonb_agg(
        sku_core(s) || jsonb_build_object(
          'offer', (
            SELECT price_offer(p)
            FROM vendor_prices p
            WHERE p.sku_id = s.id AND p.vendor_id = p_vendor_id
          )
        )
        ORDER BY s.commodity_name
      ), '[]'::jsonb)
      FROM chosen s
    )
  END;
$$;

-- Onboarding categories follow the ERP Level 1 values; Level 2 lists and examples come live from the catalog.
DELETE FROM ref_options WHERE list = 'product_category';
INSERT INTO ref_options (list, value, label, sort, meta) VALUES
  ('product_category', 'DIAGNOSTIC AND MEDICAL DEVICES', 'Alat Medis & Diagnostik', 1,
    '{"subtitle": "Bedah, kardiologi, ICU, laboratorium, radiologi, urologi, rehabilitasi", "badge": "Alkes & Diagnostik"}'),
  ('product_category', 'DRUGS & CONSUMABLE', 'Obat & Bahan Habis Pakai Medis', 2,
    '{"subtitle": "Obat, BMHP, dan bahan medis habis pakai", "badge": "Obat & BMHP"}'),
  ('product_category', 'GENERAL SUPPLIES', 'Perlengkapan Umum & Habis Pakai', 3,
    '{"subtitle": "Linen, seragam, ATK, housekeeping, dapur, plastik, amenities", "badge": "Supplies Umum"}'),
  ('product_category', 'GENERAL EQUIPMENT', 'Peralatan Umum Rumah Sakit', 4,
    '{"subtitle": "Furnitur, peralatan dapur, laundry, dan peralatan non-medis", "badge": "Peralatan Umum"}'),
  ('product_category', 'INFORMATION & COMMUNICATION TECHNOLOGY', 'Teknologi Informasi & Komunikasi', 5,
    '{"subtitle": "Hardware, software, jaringan, dan perangkat komunikasi", "badge": "IT & Komunikasi"}'),
  ('product_category', 'INFRASTRUCTURE & FACILITY MAINTENANCE', 'Infrastruktur & Pemeliharaan Fasilitas', 6,
    '{"subtitle": "Mekanikal, elektrikal, sanitasi gedung, dan perawatan fasilitas", "badge": "Fasilitas"}'),
  ('product_category', 'CONSTRUCTION', 'Konstruksi', 7,
    '{"subtitle": "Material dan pekerjaan konstruksi gedung", "badge": "Konstruksi"}'),
  ('product_category', 'UTILITIES', 'Utilitas', 8,
    '{"subtitle": "Listrik, air, gas medis, dan energi", "badge": "Utilitas"}'),
  ('product_category', 'CORPORATE SERVICES', 'Jasa Korporat', 9,
    '{"subtitle": "Jasa profesional, outsourcing, dan layanan pendukung", "badge": "Jasa"}'),
  ('product_category', 'MULTIMEDIA & EVENT', 'Multimedia & Event', 10,
    '{"subtitle": "Percetakan, promosi, dokumentasi, dan penyelenggaraan acara", "badge": "Multimedia"}');
