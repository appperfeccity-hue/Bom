-- Regression tests for v1.1.8: Server-side snapshot + rule-set resolution
-- Structural assertions verifying the migration applied correctly.
-- Run against the live database after applying migrations/v1.1.8_server_side_snapshot.sql.

SET search_path = 'perfecity';

-- =============================================================================
-- Test 1: New 5-arg create_project function exists
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'create_project'
       AND pg_catalog.pg_get_function_arguments(p.oid) =
           'p_template_id uuid, p_user_id uuid, p_idempotency_key text, p_customer_reference text DEFAULT NULL::text, p_site_reference text DEFAULT NULL::text'
  ) THEN
    RAISE EXCEPTION 'FAIL: 5-arg create_project function not found';
  END IF;
  RAISE NOTICE 'PASS: 5-arg create_project exists';
END;
$$;

-- =============================================================================
-- Test 2: Old 6-arg create_project function is dropped
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'create_project'
       AND pronargs = 6
       AND proargtypes::text LIKE '%uuid%uuid%text%jsonb%text%uuid%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Old 6-arg create_project still exists';
  END IF;
  RAISE NOTICE 'PASS: Old 6-arg create_project is dropped';
END;
$$;

-- =============================================================================
-- Test 3: canonical_jsonb function exists with correct signature
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'canonical_jsonb'
       AND pg_catalog.pg_get_function_arguments(p.oid) = 'p jsonb'
       AND pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'FAIL: canonical_jsonb function not found';
  END IF;
  RAISE NOTICE 'PASS: canonical_jsonb exists with correct signature';
END;
$$;

-- =============================================================================
-- Test 4: build_template_snapshot function exists with correct signature
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'build_template_snapshot'
       AND pg_catalog.pg_get_function_arguments(p.oid) = 'p_template_id uuid, p_rule_set_id uuid'
       AND pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'FAIL: build_template_snapshot function not found';
  END IF;
  RAISE NOTICE 'PASS: build_template_snapshot exists with correct signature';
END;
$$;

-- =============================================================================
-- Test 5: canonical_jsonb is IMMUTABLE
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'canonical_jsonb'
       AND p.provolatile = 'i'  -- 'i' = IMMUTABLE
  ) THEN
    RAISE EXCEPTION 'FAIL: canonical_jsonb is not IMMUTABLE';
  END IF;
  RAISE NOTICE 'PASS: canonical_jsonb is IMMUTABLE';
END;
$$;

-- =============================================================================
-- Test 6: build_template_snapshot is STABLE and SECURITY DEFINER
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'build_template_snapshot'
       AND p.provolatile = 's'  -- 's' = STABLE
       AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'FAIL: build_template_snapshot is not STABLE SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'PASS: build_template_snapshot is STABLE SECURITY DEFINER';
END;
$$;

-- =============================================================================
-- Test 7: create_project is SECURITY DEFINER
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'create_project'
       AND p.prosecdef = true
       AND pg_catalog.pg_get_function_result(p.oid) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: create_project is not SECURITY DEFINER returning UUID';
  END IF;
  RAISE NOTICE 'PASS: create_project is SECURITY DEFINER returning UUID';
END;
$$;

-- =============================================================================
-- Test 8: canonical_jsonb actually sorts keys
-- =============================================================================

DO $$
DECLARE
  v_input  JSONB := '{"b": 2, "a": 1, "c": {"z": 26, "a": 1}}';
  v_result TEXT;
BEGIN
  v_result := perfecity.canonical_jsonb(v_input)::text;
  IF v_result != '{"a": 1, "b": 2, "c": {"a": 1, "z": 26}}' THEN
    RAISE EXCEPTION 'FAIL: canonical_jsonb did not sort keys. Got: %', v_result;
  END IF;
  RAISE NOTICE 'PASS: canonical_jsonb sorts keys correctly';
END;
$$;

-- =============================================================================
-- Test 9: canonical_jsonb preserves array order
-- =============================================================================

DO $$
DECLARE
  v_input  JSONB := '[3, 1, 2, {"b": 2, "a": 1}]';
  v_result TEXT;
BEGIN
  v_result := perfecity.canonical_jsonb(v_input)::text;
  IF v_result != '[3, 1, 2, {"a": 1, "b": 2}]' THEN
    RAISE EXCEPTION 'FAIL: canonical_jsonb did not preserve array order. Got: %', v_result;
  END IF;
  RAISE NOTICE 'PASS: canonical_jsonb preserves array order';
END;
$$;
