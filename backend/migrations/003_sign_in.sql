-- Sign-in keys are not one username.
-- pic.email is always a key. NPWP is a second key only after the company fills it.
-- pic.name is optional profile data, not a key. Company name is not a key.

ALTER TABLE vendors DROP CONSTRAINT vendors_pic_shape;
ALTER TABLE vendors ADD CONSTRAINT vendors_pic_shape CHECK (
  jsonb_typeof(pic) = 'object'
  AND jsonb_typeof(pic->'email') = 'string'
  AND length(pic->>'email') > 0
  AND jsonb_typeof(pic->'phone') = 'string'
  AND length(pic->>'phone') > 0
  AND (
    pic->'name' IS NULL
    OR jsonb_typeof(pic->'name') = 'null'
    OR (jsonb_typeof(pic->'name') = 'string' AND length(pic->>'name') > 0)
  )
);

ALTER TABLE vendors ALTER COLUMN npwp DROP NOT NULL;

CREATE UNIQUE INDEX vendors_npwp_uidx ON vendors (npwp) WHERE npwp IS NOT NULL;

CREATE OR REPLACE FUNCTION vendor_doc(p_vendor_id text)
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
    'signIn', jsonb_build_array(
      jsonb_build_object('kind', 'pic_email', 'value', lower(trim(v.pic->>'email')))
    ) || CASE
      WHEN v.npwp IS NOT NULL AND v.npwp <> '' THEN
        jsonb_build_array(jsonb_build_object('kind', 'npwp', 'value', v.npwp))
      ELSE '[]'::jsonb
    END,
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
