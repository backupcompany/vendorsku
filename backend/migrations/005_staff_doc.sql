CREATE FUNCTION staff_doc(p_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'role', a.role,
    'roleTitle', a.role_title,
    'department', a.department,
    'hospitalUnit', a.hospital_unit,
    'signIn', jsonb_build_array(
      jsonb_build_object('kind', 'username', 'value', lower(trim(a.username))),
      jsonb_build_object('kind', 'email', 'value', lower(trim(a.email)))
    )
  )
  FROM admin_users a
  WHERE a.id = p_id;
$$;
