-- Vendor-owned catalog (merchant-first). sku_id set when vendor confirms a match.
-- ponytail: no product_sku_links table yet — one confirmed link column is enough; add multi-candidate history when staff needs audit trail.
CREATE TABLE IF NOT EXISTS vendor_products (
  id text PRIMARY KEY,
  vendor_id text NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  part_number text NOT NULL DEFAULT '',
  spec text NOT NULL DEFAULT '',
  sku_id text REFERENCES master_skus(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_products_vendor_idx ON vendor_products (vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_products_vendor_sku_uidx
  ON vendor_products (vendor_id, sku_id)
  WHERE sku_id IS NOT NULL;
