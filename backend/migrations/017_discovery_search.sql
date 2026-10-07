-- Procurement discovery: search brochure text + broader SKU text (incl. proposals).
CREATE INDEX IF NOT EXISTS sku_attachments_text_trgm
  ON sku_attachments USING gin (extracted_text gin_trgm_ops)
  WHERE extracted_text <> '';

CREATE INDEX IF NOT EXISTS master_skus_discovery_trgm ON master_skus
  USING gin ((
    commodity_name || ' ' || general_spec || ' ' ||
    coalesce(default_brand, '') || ' ' || coalesce(default_part_number, '') || ' ' ||
    coalesce(source_row->>'rawSpec', '') || ' ' || coalesce(source_row->'ai'->>'generalSpec', '')
  ) gin_trgm_ops);
