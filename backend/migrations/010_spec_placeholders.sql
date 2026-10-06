-- ERP placeholders ('-', NB, NP) are not specifications; same rule as the upload parser.
UPDATE master_skus s
SET general_spec = coalesce(c.spec, 'Standar Siloam'), updated_at = now()
FROM (
  SELECT id, string_agg(trim(p), ' ; ' ORDER BY ord) AS spec
  FROM master_skus, unnest(string_to_array(general_spec, ';')) WITH ORDINALITY AS t(p, ord)
  WHERE general_spec ~* '(^|;)\s*(-|NB|NP|NULL|NONE)?\s*(;|$)'
    AND upper(trim(p)) NOT IN ('', '-', 'NB', 'NP', 'NULL', 'NONE')
  GROUP BY id
) c
WHERE s.id = c.id AND s.general_spec IS DISTINCT FROM c.spec;

UPDATE master_skus
SET general_spec = 'Standar Siloam', updated_at = now()
WHERE upper(trim(general_spec)) IN ('', '-', 'NB', 'NP', 'NULL', 'NONE');
