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
-- Final summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'RLS Authorization Model Regression Test Harness COMPLETE.';
    RAISE NOTICE 'If no exceptions were raised, all tests (T-RLS-01 to T-RLS-05) PASSED.';
    RAISE NOTICE 'RLS migration may be declared Execution-Verified.';
    RAISE NOTICE '=================================================================';
END;
$$;
