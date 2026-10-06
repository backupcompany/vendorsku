-- p_all lets a vendor browse every open SKU outside its declared scope ("Semua SKU").
DROP FUNCTION vendor_catalog(text);
CREATE FUNCTION vendor_catalog(p_vendor_id text, p_all boolean DEFAULT false)
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
    WHERE NOT p_all
      AND v.business_scope IS NOT NULL
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
    UNION ALL
    SELECT * FROM open_skus
    WHERE EXISTS (SELECT 1 FROM v)
      AND NOT EXISTS (SELECT 1 FROM scoped)
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
