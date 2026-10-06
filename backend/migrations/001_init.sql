-- Mirrors the browser stores in src/core/db/idbClient.ts.
-- password_hash is still the demo secret until the auth stage replaces it.

CREATE TABLE hospitals (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  island text NOT NULL,
  type text,
  bed_capacity integer,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX hospitals_city_idx ON hospitals (city);
CREATE INDEX hospitals_island_idx ON hospitals (island);

CREATE TABLE tenders (
  id text PRIMARY KEY,
  tender_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  submission_deadline date NOT NULL,
  status text NOT NULL,
  target_units text[] NOT NULL DEFAULT '{}',
  total_skus integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL
);

CREATE TABLE admin_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL,
  role_title text NOT NULL,
  department text NOT NULL,
  hospital_unit text,
  password_hash text
);

CREATE TABLE vendors (
  id text PRIMARY KEY,
  erp_vendor_code text UNIQUE,
  company_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  npwp text NOT NULL,
  address text,
  authorized_person text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  is_existing_supplier boolean NOT NULL DEFAULT false,
  source text,
  registration_date timestamptz,
  linked_master_vendor_id text,
  business_scope jsonb,
  commercial_terms jsonb,
  category text,
  notes text,
  password_hash text,
  password_created_at timestamptz
);

CREATE TABLE master_skus (
  id text PRIMARY KEY,
  erp_code text NOT NULL UNIQUE,
  level1 text NOT NULL,
  level2 text NOT NULL,
  level3 text NOT NULL,
  level4 text NOT NULL,
  commodity_name text NOT NULL,
  general_spec text NOT NULL,
  default_brand text,
  default_part_number text,
  uom text NOT NULL,
  benchmark_price bigint,
  is_open_for_vendor boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  tender_id text REFERENCES tenders (id) ON DELETE SET NULL,
  status text NOT NULL,
  document_type text,
  item_id text,
  fa_category text,
  is_generic_product boolean,
  is_contract boolean,
  spec1 text,
  spec2 text,
  spec3 text,
  is_uploaded boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX master_skus_level1_idx ON master_skus (level1);
CREATE INDEX master_skus_open_idx ON master_skus (is_open_for_vendor);

CREATE TABLE vendor_prices (
  id text PRIMARY KEY,
  sku_id text NOT NULL REFERENCES master_skus (id) ON DELETE CASCADE,
  sku_erp_code text NOT NULL,
  vendor_id text NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  vendor_email text NOT NULL,
  vendor_phone text,
  vendor_npwp text,
  commodity_name text NOT NULL,
  general_spec text NOT NULL,
  vendor_brand text NOT NULL,
  vendor_part_number text NOT NULL,
  full_formatted_sku_name text NOT NULL,
  vendor_spec_detail text,
  lkpp_price bigint,
  link_lkpp_price text,
  price_list_exclude_vat bigint NOT NULL,
  discount_percent numeric(5, 2) NOT NULL,
  nett_price_exclude_vat bigint NOT NULL,
  unit_price bigint NOT NULL,
  tax_percent numeric(5, 2) NOT NULL,
  price_with_tax bigint NOT NULL,
  uom text NOT NULL,
  moq integer NOT NULL,
  lead_time_days integer NOT NULL,
  price_valid_until date NOT NULL,
  installed_hospitals text[] NOT NULL DEFAULT '{}',
  kemenkes_license text,
  country_of_origin text,
  warranty_period text,
  additional_notes text,
  ai_confidence_score numeric(4, 3),
  ai_confidence_level text,
  ai_raw_document_source text,
  ai_raw_item_name text,
  ai_raw_spec text,
  ai_raw_price bigint,
  pairing_status text,
  admin_review_status text,
  status text NOT NULL,
  submitted_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX vendor_prices_sku_idx ON vendor_prices (sku_id);
CREATE INDEX vendor_prices_vendor_idx ON vendor_prices (vendor_id);

CREATE TABLE ai_logs (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  logged_at timestamptz NOT NULL,
  model text NOT NULL,
  action text NOT NULL,
  prompt_preview text NOT NULL,
  tokens_used integer NOT NULL,
  estimated_cost_usd numeric(12, 6) NOT NULL
);

CREATE TABLE ai_memory (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  title text NOT NULL,
  updated_at timestamptz NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE rag_documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  sku_id text REFERENCES master_skus (id) ON DELETE CASCADE,
  level1 text,
  level2 text,
  commodity_name text,
  source text NOT NULL,
  created_at timestamptz NOT NULL
);
