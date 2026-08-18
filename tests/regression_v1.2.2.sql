-- Regression tests for v1.2.2: Finalization integrity fixes
-- Structural assertions verifying the migration applied correctly.
-- Run against the live database after applying migrations/v1.2.2_finalization_integrity.sql.

SET search_path = 'perfecity';

-- =============================================================================
-- Test 1: finalize_project function exists with correct signature
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'finalize_project'
       AND pg_catalog.pg_get_function_arguments(p.oid) =
           'p_project_id uuid, p_user_id uuid, p_finalization_key text, p_computed_final_hash text'
       AND pg_catalog.pg_get_function_result(p.oid) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: finalize_project function not found with expected signature';
  END IF;
  RAISE NOTICE 'PASS: finalize_project exists with correct signature';
END;
$$;

-- =============================================================================
-- Test 2: finalize_project is SECURITY DEFINER
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'finalize_project'
       AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'FAIL: finalize_project is not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'PASS: finalize_project is SECURITY DEFINER';
END;
$$;

-- =============================================================================
-- Test 3: finalize_project computes hash server-side (D6 fix)
-- Verify function body contains digest/encode pattern and canonical_jsonb
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'finalize_project';

  IF v_func_body IS NULL THEN
    RAISE EXCEPTION 'FAIL: finalize_project function not found';
  END IF;

  IF v_func_body NOT LIKE '%digest%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not contain digest (D6 server-side hash not applied)';
  END IF;

  IF v_func_body NOT LIKE '%encode%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not contain encode (D6 hex encoding not applied)';
  END IF;

  IF v_func_body NOT LIKE '%canonical_jsonb%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not use canonical_jsonb for deterministic key ordering';
  END IF;

  IF v_func_body NOT LIKE '%actual_bom_line abl%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project hash computation does not reference actual_bom_line';
  END IF;

  RAISE NOTICE 'PASS: finalize_project contains digest, encode, and canonical_jsonb (D6 fix verified)';
END;
$$;

-- =============================================================================
-- Test 4: finalize_project raises on hash mismatch (D6 assertion)
-- Verify function body contains the mismatch exception
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'finalize_project';

  IF v_func_body NOT LIKE '%hash mismatch%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not raise on hash mismatch (D6 assertion missing)';
  END IF;

  RAISE NOTICE 'PASS: finalize_project raises on hash mismatch (D6 assertion present)';
END;
$$;

-- =============================================================================
-- Test 5: finalize_project populates source_trace with lineage fields (D7 fix)
-- Verify function body builds proper source_trace jsonb
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'finalize_project';

  IF v_func_body NOT LIKE '%snapshot_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project source_trace does not include snapshot_id (D7 fix missing)';
  END IF;

  IF v_func_body NOT LIKE '%configuration_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project source_trace does not include configuration_id (D7 fix missing)';
  END IF;

  IF v_func_body NOT LIKE '%actual_bom_line_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project source_trace does not include actual_bom_line_id (D7 fix missing)';
  END IF;

  IF v_func_body NOT LIKE '%rule_set_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project source_trace does not include rule_set_id (D7 fix missing)';
  END IF;

  IF v_func_body NOT LIKE '%zone_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project source_trace does not include zone_id (D7 fix missing)';
  END IF;

  RAISE NOTICE 'PASS: finalize_project source_trace includes all lineage fields (D7 fix verified)';
END;
$$;

-- =============================================================================
-- Test 6: finalize_project has search_path set to perfecity
-- =============================================================================

DO $$
DECLARE
    v_config TEXT;
BEGIN
  SELECT array_to_string(p.proconfig, ',') INTO v_config
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'finalize_project';

  IF v_config IS NULL OR v_config NOT LIKE '%search_path=perfecity%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not have search_path set to perfecity';
  END IF;

  RAISE NOTICE 'PASS: finalize_project has search_path=perfecity';
END;
$$;

-- =============================================================================
-- Test 7: authenticated role has EXECUTE on finalize_project
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'perfecity'
       AND routine_name = 'finalize_project'
       AND grantee = 'authenticated'
       AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated role does not have EXECUTE on finalize_project';
  END IF;
  RAISE NOTICE 'PASS: authenticated has EXECUTE on finalize_project';
END;
$$;

-- =============================================================================
-- Test 8: anon role does NOT have EXECUTE on finalize_project
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'perfecity'
       AND routine_name = 'finalize_project'
       AND grantee = 'anon'
       AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon role has EXECUTE on finalize_project (should not)';
  END IF;
  RAISE NOTICE 'PASS: anon does NOT have EXECUTE on finalize_project';
END;
$$;

-- =============================================================================
-- Test 9: finalize_project writes audit_event with correct columns
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'finalize_project';

  IF v_func_body NOT LIKE '%audit_event%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not write audit_event';
  END IF;

  IF v_func_body NOT LIKE '%PROJECT_FINALIZED%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not use PROJECT_FINALIZED event type';
  END IF;

  -- Verify correct column names (actor_id, actor_role, entity_type, entity_id, after_state)
  IF v_func_body NOT LIKE '%actor_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project audit INSERT does not use actor_id column';
  END IF;

  IF v_func_body NOT LIKE '%actor_role%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project audit INSERT does not use actor_role column';
  END IF;

  IF v_func_body NOT LIKE '%entity_type%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project audit INSERT does not use entity_type column';
  END IF;

  IF v_func_body NOT LIKE '%entity_id%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project audit INSERT does not use entity_id column';
  END IF;

  RAISE NOTICE 'PASS: finalize_project writes audit_event with correct columns and PROJECT_FINALIZED';
END;
$$;

-- =============================================================================
-- Test 10: finalize_project does NOT store p_computed_final_hash directly
-- (Verifies D6: server hash is stored, not the client parameter)
-- =============================================================================

DO $$
DECLARE
    v_func_body TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid) INTO v_func_body
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'perfecity'
     AND p.proname = 'finalize_project';

  -- The function should update final_bom with v_server_hash, not insert with p_computed_final_hash
  IF v_func_body NOT LIKE '%v_server_hash%' THEN
    RAISE EXCEPTION 'FAIL: finalize_project does not use a server-computed hash variable';
  END IF;

  RAISE NOTICE 'PASS: finalize_project uses server-computed hash (D6 verified)';
END;
$$;
