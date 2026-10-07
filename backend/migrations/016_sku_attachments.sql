-- Vendor product photos + brochure PDFs linked to a proposed/master SKU.
CREATE TABLE sku_attachments (
  id text PRIMARY KEY,
  sku_id text NOT NULL REFERENCES master_skus (id) ON DELETE CASCADE,
  vendor_id text NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'brochure')),
  filename text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  data bytea NOT NULL,
  extracted_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sku_attachments_sku_idx ON sku_attachments (sku_id);
CREATE INDEX sku_attachments_vendor_idx ON sku_attachments (vendor_id);
