-- Regression tests for v1.2.0: save_actual_bom RPC
-- Structural assertions verifying the migration applied correctly.
-- Run against the live database after applying migrations/v1.2.0_save_actual_bom.sql.

SET search_path = 'perfecity';

-- =============================================================================
-- Test 1: actual_bom_idempotency table exists with correct columns
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'perfecity'
       AND table_name = 'actual_bom_idempotency'
  ) THEN
    RAISE EXCEPTION 'FAIL: actual_bom_idempotency table not found';
  END IF;
  RAISE NOTICE 'PASS: actual_bom_idempotency table exists';
END;
$$;

-- =============================================================================
-- Test 2: actual_bom_idempotency has correct primary key column
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'perfecity'
       AND table_name = 'actual_bom_idempotency'
       AND column_name = 'idempotency_key'
       AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'FAIL: idempotency_key TEXT column not found';
  END IF;
  RAISE NOTICE 'PASS: idempotency_key column exists with correct type';
END;
$$;

-- =============================================================================
-- Test 3: actual_bom_idempotency has actual_bom_id UUID column
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'perfecity'
       AND table_name = 'actual_bom_idempotency'
       AND column_name = 'actual_bom_id'
       AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: actual_bom_id UUID column not found';
  END IF;
  RAISE NOTICE 'PASS: actual_bom_id column exists with correct type';
END;
$$;

-- =============================================================================
-- Test 4: actual_bom_idempotency has created_at TIMESTAMPTZ column
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'perfecity'
       AND table_name = 'actual_bom_idempotency'
       AND column_name = 'created_at'
       AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'FAIL: created_at TIMESTAMPTZ column not found';
  END IF;
  RAISE NOTICE 'PASS: created_at column exists with correct type';
END;
$$;

-- =============================================================================
-- Test 5: RLS is enabled on actual_bom_idempotency
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'perfecity'
       AND c.relname = 'actual_bom_idempotency'
       AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on actual_bom_idempotency';
  END IF;
  RAISE NOTICE 'PASS: RLS enabled on actual_bom_idempotency';
END;
$$;

-- =============================================================================
-- Test 6: save_actual_bom function exists with correct signature
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'save_actual_bom'
       AND pg_catalog.pg_get_function_arguments(p.oid) =
           'p_project_id uuid, p_user_id uuid, p_idempotency_key text, p_configuration_data jsonb, p_bom_lines jsonb, p_engine_version text, p_input_hash text'
       AND pg_catalog.pg_get_function_result(p.oid) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: save_actual_bom function not found with expected signature';
  END IF;
  RAISE NOTICE 'PASS: save_actual_bom exists with correct signature';
END;
$$;

-- =============================================================================
-- Test 7: save_actual_bom is SECURITY DEFINER
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'save_actual_bom'
       AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'FAIL: save_actual_bom is not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'PASS: save_actual_bom is SECURITY DEFINER';
END;
$$;

-- =============================================================================
-- Test 8: save_actual_bom returns UUID
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'save_actual_bom'
       AND pg_catalog.pg_get_function_result(p.oid) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: save_actual_bom does not return UUID';
  END IF;
  RAISE NOTICE 'PASS: save_actual_bom returns UUID';
END;
$$;

-- =============================================================================
-- Test 9: authenticated role has EXECUTE on save_actual_bom
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'perfecity'
       AND routine_name = 'save_actual_bom'
       AND grantee = 'authenticated'
       AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated role does not have EXECUTE on save_actual_bom';
  END IF;
  RAISE NOTICE 'PASS: authenticated has EXECUTE on save_actual_bom';
END;
$$;

-- =============================================================================
-- Test 10: anon role does NOT have EXECUTE on save_actual_bom
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'perfecity'
       AND routine_name = 'save_actual_bom'
       AND grantee = 'anon'
       AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon role has EXECUTE on save_actual_bom (should not)';
  END IF;
  RAISE NOTICE 'PASS: anon does NOT have EXECUTE on save_actual_bom';
END;
$$;
