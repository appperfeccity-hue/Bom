-- ============================================================================
-- PERFECCITY MVP – RLS Authorization Model Regression Test Harness
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Run AFTER applying migrations/v1.1.5_rls_policies.sql
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T-RLS-01: Verify all 34 tables have RLS enabled
-- ============================================================================
DO $$
DECLARE
    v_rls_count INTEGER;
BEGIN
    SELECT count(*) INTO v_rls_count
    FROM pg_tables
    WHERE schemaname = 'perfecity'
      AND rowsecurity = true;

    IF v_rls_count = 34 THEN
        RAISE NOTICE 'PASS: T-RLS-01 - All 34 tables have RLS enabled (count=%)', v_rls_count;
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-01 - Expected 34 tables with RLS enabled, got %', v_rls_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-02: Verify authenticated role has USAGE on perfecity schema
-- ============================================================================
DO $$
DECLARE
    v_has_usage BOOLEAN;
BEGIN
    SELECT has_schema_privilege('authenticated', 'perfecity', 'USAGE') INTO v_has_usage;

    IF v_has_usage THEN
        RAISE NOTICE 'PASS: T-RLS-02 - authenticated role has USAGE on perfecity schema';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-02 - authenticated role lacks USAGE on perfecity schema';
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-03: Verify policies exist for all 34 tables
-- ============================================================================
DO $$
DECLARE
    v_tables_without_policies INTEGER;
    v_missing_tables TEXT;
BEGIN
    SELECT count(*), string_agg(t.tablename, ', ')
    INTO v_tables_without_policies, v_missing_tables
    FROM pg_tables t
    LEFT JOIN (
        SELECT DISTINCT tablename
        FROM pg_policies
        WHERE schemaname = 'perfecity'
    ) p ON t.tablename = p.tablename
    WHERE t.schemaname = 'perfecity'
      AND p.tablename IS NULL;

    IF v_tables_without_policies = 0 THEN
        RAISE NOTICE 'PASS: T-RLS-03 - All 34 tables have at least one RLS policy';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-03 - % table(s) missing policies: %', v_tables_without_policies, v_missing_tables;
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-04: Verify perfecity.current_user_role() function exists
-- ============================================================================
DO $$
DECLARE
    v_func_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'perfecity'
          AND p.proname = 'current_user_role'
    ) INTO v_func_exists;

    IF v_func_exists THEN
        RAISE NOTICE 'PASS: T-RLS-04 - perfecity.current_user_role() function exists';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-04 - perfecity.current_user_role() function not found';
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-05: Verify minimum policy count (at least 100 policies total)
-- ============================================================================
DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT count(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'perfecity';

    IF v_policy_count >= 100 THEN
        RAISE NOTICE 'PASS: T-RLS-05 - Total policy count is % (minimum 100 required)', v_policy_count;
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-05 - Expected at least 100 policies, got %', v_policy_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-06: Verify anon role has NO USAGE on perfecity schema
-- (Review Issue 1: anon must not access perfecity schema)
-- ============================================================================
DO $$
DECLARE
    v_has_usage BOOLEAN;
BEGIN
    SELECT has_schema_privilege('anon', 'perfecity', 'USAGE') INTO v_has_usage;

    IF NOT v_has_usage THEN
        RAISE NOTICE 'PASS: T-RLS-06 - anon role does NOT have USAGE on perfecity schema';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-06 - anon role has USAGE on perfecity schema (security risk)';
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-07: Verify project_snapshot has NO UPDATE policy
-- (Review Issue 2: snapshots are immutable, UPDATE policy contradicts invariant)
-- ============================================================================
DO $$
DECLARE
    v_update_count INTEGER;
BEGIN
    SELECT count(*) INTO v_update_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'project_snapshot'
      AND cmd = 'UPDATE';

    IF v_update_count = 0 THEN
        RAISE NOTICE 'PASS: T-RLS-07 - project_snapshot has no UPDATE policy (immutability preserved)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-07 - project_snapshot has % UPDATE policy(ies) (should be 0)', v_update_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-08: Verify master_bom DESIGNER UPDATE policy is ownership-scoped
-- (Review Issue 3: DESIGNER can only approve own template's Master BOM)
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'master_bom'
      AND policyname = 'master_bom_update_designer';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-RLS-08 - master_bom_update_designer policy not found';
    ELSIF v_qual LIKE '%template%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-RLS-08 - master_bom_update_designer is ownership-scoped via template';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-08 - master_bom_update_designer lacks ownership scope. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-09: Verify final_bom and final_bom_line have DESIGNER SELECT policies
-- (Review Issue 4: Designers can view projects using their own templates)
-- ============================================================================
DO $$
DECLARE
    v_fb_designer BOOLEAN;
    v_fbl_designer BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'final_bom'
          AND policyname = 'final_bom_select_designer' AND cmd = 'SELECT'
    ) INTO v_fb_designer;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'final_bom_line'
          AND policyname = 'final_bom_line_select_designer' AND cmd = 'SELECT'
    ) INTO v_fbl_designer;

    IF v_fb_designer AND v_fbl_designer THEN
        RAISE NOTICE 'PASS: T-RLS-09 - DESIGNER SELECT policies exist on final_bom and final_bom_line';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-09 - Missing DESIGNER SELECT: final_bom=%, final_bom_line=%', v_fb_designer, v_fbl_designer;
    END IF;
END;
$$;

-- ============================================================================
-- T-RLS-10: Verify audit_event has NO INSERT policy for authenticated
-- (Review Issue 6: audit writes restricted to service_role only)
-- ============================================================================
DO $$
DECLARE
    v_insert_count INTEGER;
BEGIN
    SELECT count(*) INTO v_insert_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'audit_event'
      AND cmd = 'INSERT';

    IF v_insert_count = 0 THEN
        RAISE NOTICE 'PASS: T-RLS-10 - audit_event has no INSERT policy (service_role-only writes)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-RLS-10 - audit_event has % INSERT policy(ies) (should be 0)', v_insert_count;
    END IF;
END;
$$;

-- ============================================================================
-- Final summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'RLS Authorization Model Regression Test Harness COMPLETE.';
    RAISE NOTICE 'If no exceptions were raised, all tests (T-RLS-01 to T-RLS-10) PASSED.';
    RAISE NOTICE 'RLS migration may be declared Execution-Verified.';
    RAISE NOTICE '=================================================================';
END;
$$;
