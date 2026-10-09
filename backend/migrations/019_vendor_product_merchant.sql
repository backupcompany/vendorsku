-- Merchant-center fields on vendor_products (pricing + legal + one photo).
-- ponytail: photo bytea on row is enough for one image; split to attachments table if multi-file needed.
ALTER TABLE vendor_products
  ADD COLUMN IF NOT EXISTS uom text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS izin_edar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS izin_edar_until date,
  ADD COLUMN IF NOT EXISTS lkpp_price bigint,
  ADD COLUMN IF NOT EXISTS lkpp_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_list bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moq int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lead_time_days int NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS price_valid_until date,
  ADD COLUMN IF NOT EXISTS photo_filename text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_content_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_data bytea;
