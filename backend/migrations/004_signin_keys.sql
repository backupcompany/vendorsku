-- Store NPWP as digits so "01.234.567.8-012.000" and "012345678012000" are one sign-in key.
UPDATE vendors
SET npwp = NULLIF(regexp_replace(npwp, '\D', '', 'g'), '')
WHERE npwp IS NOT NULL;

UPDATE vendors
SET npwp = NULL
WHERE npwp ~ '^0+$';

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
        jsonb_build_array(jsonb_build_object('kind', 'npwp', 'value', regexp_replace(v.npwp, '\D', '', 'g')))
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
