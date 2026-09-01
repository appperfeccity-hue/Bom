-- Regression tests for v1.2.1: generate_master_bom RPC
-- Structural assertions verifying the migration applied correctly.
-- Run against the live database after applying migrations/v1.2.1_master_bom_generation.sql.

SET search_path = 'perfecity';

-- =============================================================================
-- Test 1: generate_master_bom function exists with correct signature
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'generate_master_bom'
       AND pg_catalog.pg_get_function_arguments(p.oid) =
           'p_template_id uuid, p_user_id uuid'
       AND pg_catalog.pg_get_function_result(p.oid) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: generate_master_bom function not found with expected signature';
  END IF;
  RAISE NOTICE 'PASS: generate_master_bom exists with correct signature';
END;
$$;

-- =============================================================================
-- Test 2: generate_master_bom is SECURITY DEFINER
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'generate_master_bom'
       AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'FAIL: generate_master_bom is not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'PASS: generate_master_bom is SECURITY DEFINER';
END;
$$;

-- =============================================================================
-- Test 3: generate_master_bom returns UUID
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'generate_master_bom'
       AND pg_catalog.pg_get_function_result(p.oid) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: generate_master_bom does not return UUID';
  END IF;
  RAISE NOTICE 'PASS: generate_master_bom returns UUID';
END;
$$;

-- =============================================================================
-- Test 4: authenticated role has EXECUTE on generate_master_bom
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'perfecity'
       AND routine_name = 'generate_master_bom'
       AND grantee = 'authenticated'
       AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated role does not have EXECUTE on generate_master_bom';
  END IF;
  RAISE NOTICE 'PASS: authenticated has EXECUTE on generate_master_bom';
END;
$$;

-- =============================================================================
-- Test 5: anon role does NOT have EXECUTE on generate_master_bom
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'perfecity'
       AND routine_name = 'generate_master_bom'
       AND grantee = 'anon'
       AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon role has EXECUTE on generate_master_bom (should not)';
  END IF;
  RAISE NOTICE 'PASS: anon does NOT have EXECUTE on generate_master_bom';
END;
$$;

-- =============================================================================
-- Test 6: check_template_eligible function includes master_bom_line check
-- (Structural: verify function body references master_bom_line table)
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'check_template_eligible';

  IF v_func_body IS NULL THEN
    RAISE EXCEPTION 'FAIL: check_template_eligible function not found';
  END IF;

  IF v_func_body NOT LIKE '%master_bom_line%' THEN
    RAISE EXCEPTION 'FAIL: check_template_eligible does not reference master_bom_line (coverage check missing)';
  END IF;

  RAISE NOTICE 'PASS: check_template_eligible references master_bom_line (coverage check present)';
END;
$$;

-- =============================================================================
-- Test 7: check_template_eligible requires >= 1 master_bom_line
-- (Structural: verify function body includes line count check)
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'check_template_eligible';

  IF v_func_body NOT LIKE '%v_bom_line_count%' THEN
    RAISE EXCEPTION 'FAIL: check_template_eligible does not check bom_line_count';
  END IF;

  RAISE NOTICE 'PASS: check_template_eligible includes bom_line_count check';
END;
$$;

-- =============================================================================
-- Test 8: check_template_eligible checks zone coverage
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'check_template_eligible';

  IF v_func_body NOT LIKE '%template_component_id%' THEN
    RAISE EXCEPTION 'FAIL: check_template_eligible does not check component coverage';
  END IF;

  RAISE NOTICE 'PASS: check_template_eligible includes component coverage checks';
END;
$$;

-- =============================================================================
-- Test 9: generate_master_bom function has search_path set to perfecity
-- =============================================================================

DO $$
DECLARE
    v_config TEXT;
BEGIN
  SELECT array_to_string(p.proconfig, ',') INTO v_config
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'generate_master_bom';

  IF v_config IS NULL OR v_config NOT LIKE '%search_path=perfecity%' THEN
    RAISE EXCEPTION 'FAIL: generate_master_bom does not have search_path set to perfecity';
  END IF;

  RAISE NOTICE 'PASS: generate_master_bom has search_path=perfecity';
END;
$$;

-- =============================================================================
-- Test 10: generate_master_bom function body references audit_event
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'generate_master_bom';

  IF v_func_body NOT LIKE '%audit_event%' THEN
    RAISE EXCEPTION 'FAIL: generate_master_bom does not write audit_event';
  END IF;

  IF v_func_body NOT LIKE '%MASTER_BOM_GENERATED%' THEN
    RAISE EXCEPTION 'FAIL: generate_master_bom does not use MASTER_BOM_GENERATED event type';
  END IF;

  RAISE NOTICE 'PASS: generate_master_bom writes audit_event with MASTER_BOM_GENERATED';
END;
$$;
