-- ERP import keeps every source value: exact price, Sp Item Id, and the verbatim xlsx row.
ALTER TABLE master_skus
  ALTER COLUMN benchmark_price TYPE numeric USING benchmark_price::numeric,
  ADD COLUMN IF NOT EXISTS sp_item_id text,
  ADD COLUMN IF NOT EXISTS source_row jsonb;

-- One grouped pass over offers instead of a subquery per SKU.
CREATE OR REPLACE FUNCTION staff_skus() RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH offers AS (
    SELECT p.sku_id, jsonb_agg(
      jsonb_build_object(
        'vendor', jsonb_build_object(
          'id', v.id,
          'companyName', v.company_name,
          'erpVendorCode', v.erp_vendor_code,
          'pic', v.pic
        ),
        'offer', price_offer(p)
      )
      ORDER BY v.company_name
    ) AS list
    FROM vendor_prices p
    JOIN vendors v ON v.id = p.vendor_id
    GROUP BY p.sku_id
  )
  SELECT coalesce(jsonb_agg(
    sku_core(s) || jsonb_build_object('offers', coalesce(o.list, '[]'::jsonb))
    ORDER BY s.commodity_name
  ), '[]'::jsonb)
  FROM master_skus s
  LEFT JOIN offers o ON o.sku_id = s.id;
$$;

CREATE OR REPLACE FUNCTION vendor_catalog(p_vendor_id text, p_all boolean DEFAULT false) RETURNS jsonb LANGUAGE sql STABLE AS $$
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
        sku_core(s) || jsonb_build_object('offer', CASE WHEN p.id IS NULL THEN NULL ELSE price_offer(p) END)
        ORDER BY s.commodity_name
      ), '[]'::jsonb)
      FROM chosen s
      LEFT JOIN vendor_prices p ON p.sku_id = s.id AND p.vendor_id = p_vendor_id
    )
  END;
$$;

-- vendor_json is the row shape without offers, so lists can join offer counts set-based.
CREATE OR REPLACE FUNCTION vendor_json(v vendors) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', v.id,
    'erpVendorCode', v.erp_vendor_code,
    'companyName', v.company_name,
    'npwp', v.npwp,
    'address', v.address,
    'status', v.status,
    'verified', v.verified,
    'isExistingSupplier', v.is_existing_supplier,
    'source', v.source,
    'registrationDate', v.registration_date,
    'linkedMasterVendorId', v.linked_master_vendor_id,
    'category', v.category,
    'notes', v.notes,
    'pic', v.pic,
    'signIn', jsonb_build_array(
      jsonb_build_object('kind', 'pic_email', 'value', lower(trim(v.pic->>'email')))
    ) || CASE
      WHEN v.npwp IS NOT NULL AND v.npwp <> '' THEN
        jsonb_build_array(jsonb_build_object('kind', 'npwp', 'value', regexp_replace(v.npwp, '\D', '', 'g')))
      ELSE '[]'::jsonb
    END,
    'businessScope', v.business_scope,
    'commercialTerms', v.commercial_terms
  );
$$;

CREATE OR REPLACE FUNCTION vendor_doc(p_vendor_id text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT vendor_json(v) || jsonb_build_object('offers', coalesce((
    SELECT jsonb_agg(price_offer(p) ORDER BY p.submitted_at)
    FROM vendor_prices p
    WHERE p.vendor_id = v.id
  ), '[]'::jsonb))
  FROM vendors v
  WHERE v.id = p_vendor_id;
$$;

-- Bumped in the writing transaction, so a reader never pairs a new version with old rows.
CREATE TABLE IF NOT EXISTS data_version (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  v bigint NOT NULL DEFAULT 1
);
INSERT INTO data_version DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION bump_data_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE data_version SET v = v + 1;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER master_skus_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON master_skus
  FOR EACH STATEMENT EXECUTE FUNCTION bump_data_version();
CREATE OR REPLACE TRIGGER vendor_prices_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON vendor_prices
  FOR EACH STATEMENT EXECUTE FUNCTION bump_data_version();
CREATE OR REPLACE TRIGGER vendors_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON vendors
  FOR EACH STATEMENT EXECUTE FUNCTION bump_data_version();

-- vendor_prices_one_offer (vendor_id, sku_id) already serves vendor_id lookups; a lone boolean index never pays off.
DROP INDEX IF EXISTS vendor_prices_vendor_idx;
DROP INDEX IF EXISTS master_skus_open_idx;
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS master_skus_search_trgm ON master_skus
  USING gin ((commodity_name || ' ' || general_spec || ' ' || level2 || ' ' || level3) gin_trgm_ops)
  WHERE is_open_for_vendor AND is_active AND status <> 'archived';

ANALYZE master_skus;
ANALYZE vendor_prices;
