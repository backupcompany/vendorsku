-- PIC lives on the vendor. A price row points at vendor_id only,
-- so one vendor document cannot carry another vendor's name, email, or phone.

ALTER TABLE vendors ADD COLUMN pic jsonb;

UPDATE vendors
SET pic = jsonb_build_object(
  'name', authorized_person,
  'email', email,
  'phone', phone
)
WHERE pic IS NULL;

ALTER TABLE vendors DROP COLUMN authorized_person;
ALTER TABLE vendors DROP COLUMN email;
ALTER TABLE vendors DROP COLUMN phone;
ALTER TABLE vendors ALTER COLUMN pic SET NOT NULL;

ALTER TABLE vendors ADD CONSTRAINT vendors_pic_shape CHECK (
  jsonb_typeof(pic) = 'object'
  AND jsonb_typeof(pic->'name') = 'string'
  AND length(pic->>'name') > 0
  AND jsonb_typeof(pic->'email') = 'string'
  AND length(pic->>'email') > 0
  AND jsonb_typeof(pic->'phone') = 'string'
  AND length(pic->>'phone') > 0
);

CREATE UNIQUE INDEX vendors_pic_email_uidx ON vendors ((lower(pic->>'email')));

ALTER TABLE vendors ADD CONSTRAINT vendors_scope_shape CHECK (
  business_scope IS NULL
  OR (
    jsonb_typeof(business_scope) = 'object'
    AND jsonb_typeof(business_scope->'level1') = 'string'
    AND jsonb_typeof(business_scope->'level2List') = 'array'
  )
);

ALTER TABLE vendors ADD CONSTRAINT vendors_terms_shape CHECK (
  commercial_terms IS NULL
  OR (
    jsonb_typeof(commercial_terms) = 'object'
    AND commercial_terms->>'coverageType' IN ('all_units', 'selected_units')
    AND jsonb_typeof(commercial_terms->'coveredHospitalUnits') = 'array'
    AND commercial_terms->>'taxCondition' IN ('exclude_vat_11', 'include_vat_11')
    AND jsonb_typeof(commercial_terms->'currency') = 'string'
    AND jsonb_typeof(commercial_terms->'priceValidUntil') = 'string'
    AND jsonb_typeof(commercial_terms->'deliveryTerm') = 'string'
    AND jsonb_typeof(commercial_terms->'paymentTerm') = 'string'
    AND jsonb_typeof(commercial_terms->'warrantyGeneral') = 'string'
    AND jsonb_typeof(commercial_terms->'standardLeadTimeDays') = 'number'
    AND jsonb_typeof(commercial_terms->'standardMoq') = 'number'
  )
);

ALTER TABLE vendor_prices
  DROP COLUMN vendor_name,
  DROP COLUMN vendor_email,
  DROP COLUMN vendor_phone,
  DROP COLUMN vendor_npwp;

ALTER TABLE vendor_prices
  ADD CONSTRAINT vendor_prices_one_offer UNIQUE (vendor_id, sku_id);

CREATE FUNCTION sku_core(s master_skus)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'erpCode', s.erp_code,
    'taxonomy', jsonb_build_object(
      'level1', s.level1,
      'level2', s.level2,
      'level3', s.level3,
      'level4', s.level4
    ),
    'name', jsonb_build_object(
      'commodityName', s.commodity_name,
      'generalSpec', s.general_spec,
      'defaultBrand', s.default_brand,
      'defaultPartNumber', s.default_part_number
    ),
    'uom', s.uom,
    'benchmarkPrice', s.benchmark_price,
    'isOpenForVendor', s.is_open_for_vendor,
    'status', s.status
  );
$$;

CREATE FUNCTION price_offer(p vendor_prices)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'skuId', p.sku_id,
    'skuErpCode', p.sku_erp_code,
    'name', jsonb_build_object(
      'commodityName', p.commodity_name,
      'generalSpec', p.general_spec,
      'brand', p.vendor_brand,
      'partNumber', p.vendor_part_number,
      'fullFormattedSkuName', p.full_formatted_sku_name,
      'specDetail', p.vendor_spec_detail
    ),
    'commercial', jsonb_build_object(
      'lkppPrice', p.lkpp_price,
      'linkLkppPrice', p.link_lkpp_price,
      'priceListExcludeVat', p.price_list_exclude_vat,
      'discountPercent', p.discount_percent,
      'nettPriceExcludeVat', p.nett_price_exclude_vat,
      'unitPrice', p.unit_price,
      'taxPercent', p.tax_percent,
      'priceWithTax', p.price_with_tax,
      'uom', p.uom,
      'moq', p.moq,
      'leadTimeDays', p.lead_time_days,
      'priceValidUntil', p.price_valid_until
    ),
    'coverage', jsonb_build_object(
      'installedHospitals', to_jsonb(p.installed_hospitals)
    ),
    'compliance', jsonb_build_object(
      'kemenkesLicense', p.kemenkes_license,
      'countryOfOrigin', p.country_of_origin,
      'warrantyPeriod', p.warranty_period,
      'additionalNotes', p.additional_notes
    ),
    'match', jsonb_build_object(
      'confidenceScore', p.ai_confidence_score,
      'confidenceLevel', p.ai_confidence_level,
      'documentSource', p.ai_raw_document_source,
      'rawItemName', p.ai_raw_item_name,
      'rawSpec', p.ai_raw_spec,
      'rawPrice', p.ai_raw_price,
      'pairingStatus', p.pairing_status,
      'adminReviewStatus', p.admin_review_status
    ),
    'status', p.status,
    'submittedAt', p.submitted_at,
    'updatedAt', p.updated_at
  );
$$;

CREATE FUNCTION vendor_doc(p_vendor_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
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
    'businessScope', v.business_scope,
    'commercialTerms', v.commercial_terms,
    'offers', coalesce((
      SELECT jsonb_agg(price_offer(p) ORDER BY p.submitted_at)
      FROM vendor_prices p
      WHERE p.vendor_id = v.id
    ), '[]'::jsonb)
  )
  FROM vendors v
  WHERE v.id = p_vendor_id;
$$;

CREATE FUNCTION vendor_catalog(p_vendor_id text)
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
      AND lower(trim(s.level1)) = lower(trim(v.business_scope->>'level1'))
      AND (
        coalesce(jsonb_array_length(v.business_scope->'level2List'), 0) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(v.business_scope->'level2List') AS l2(value)
          WHERE lower(trim(l2.value)) = lower(trim(s.level2))
        )
      )
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

CREATE FUNCTION staff_skus()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(jsonb_agg(
    sku_core(s) || jsonb_build_object(
      'offers', coalesce((
        SELECT jsonb_agg(
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
        )
        FROM vendor_prices p
        JOIN vendors v ON v.id = p.vendor_id
        WHERE p.sku_id = s.id
      ), '[]'::jsonb)
    )
    ORDER BY s.commodity_name
  ), '[]'::jsonb)
  FROM master_skus s;
$$;
