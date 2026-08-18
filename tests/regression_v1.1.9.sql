-- Regression tests for v1.1.9: Project Isolation
-- Structural assertions verifying the migration applied correctly.
-- Run against the live database after applying migrations/v1.1.9_project_isolation.sql.

SET search_path = 'perfecity';

-- =============================================================================
-- Test 1: project_update_consultant policy has WITH CHECK clause
-- =============================================================================

DO $$
DECLARE
  v_qual TEXT;
BEGIN
  SELECT pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
    INTO v_qual
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'perfecity'
     AND c.relname = 'project'
     AND p.polname = 'project_update_consultant';

  IF v_qual IS NULL OR v_qual = '' THEN
    RAISE EXCEPTION 'FAIL: project_update_consultant has no WITH CHECK clause';
  END IF;

  IF v_qual NOT LIKE '%created_by%' THEN
    RAISE EXCEPTION 'FAIL: project_update_consultant WITH CHECK does not reference created_by. Got: %', v_qual;
  END IF;

  RAISE NOTICE 'PASS: project_update_consultant has WITH CHECK referencing created_by';
END;
$$;

-- =============================================================================
-- Test 2: trg_project_status_guard trigger exists on project table
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.triggers
     WHERE trigger_schema = 'perfecity'
       AND event_object_table = 'project'
       AND trigger_name = 'trg_project_status_guard'
       AND event_manipulation = 'UPDATE'
       AND action_timing = 'BEFORE'
  ) THEN
    RAISE EXCEPTION 'FAIL: trg_project_status_guard trigger not found on project table';
  END IF;
  RAISE NOTICE 'PASS: trg_project_status_guard trigger exists on project table';
END;
$$;

-- =============================================================================
-- Test 3: trg_project_status_guard_fn function exists with SECURITY DEFINER
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'trg_project_status_guard_fn'
       AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'FAIL: trg_project_status_guard_fn function not found or not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'PASS: trg_project_status_guard_fn exists with SECURITY DEFINER';
END;
$$;

-- =============================================================================
-- Test 4: trg_project_status_guard_fn returns trigger
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity'
       AND p.proname = 'trg_project_status_guard_fn'
       AND pg_catalog.pg_get_function_result(p.oid) = 'trigger'
  ) THEN
    RAISE EXCEPTION 'FAIL: trg_project_status_guard_fn does not return trigger';
  END IF;
  RAISE NOTICE 'PASS: trg_project_status_guard_fn returns trigger';
END;
$$;

-- =============================================================================
-- Test 5: The trigger fires FOR EACH ROW
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.triggers
     WHERE trigger_schema = 'perfecity'
       AND event_object_table = 'project'
       AND trigger_name = 'trg_project_status_guard'
       AND action_orientation = 'ROW'
  ) THEN
    RAISE EXCEPTION 'FAIL: trg_project_status_guard is not FOR EACH ROW';
  END IF;
  RAISE NOTICE 'PASS: trg_project_status_guard fires FOR EACH ROW';
END;
$$;
