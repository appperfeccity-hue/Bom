-- ============================================================================
-- PERFECCITY P0 TEST SUITE - RLS Enforcement
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Purpose: Verify cross-tenant isolation, RLS enabled on all tables,
--          role-based visibility, and anon exclusion.
-- Run AFTER applying migrations/v1.1.5_rls_policies.sql
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T-P0-RLS-001: All 34 tables have RLS enabled
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
        RAISE NOTICE 'PASS: T-P0-RLS-001 - All 34 tables have RLS enabled (count=%)', v_rls_count;
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-001 - Expected 34 tables with RLS enabled, got %', v_rls_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-002: Every table has at least one RLS policy
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
        RAISE NOTICE 'PASS: T-P0-RLS-002 - All tables have at least one RLS policy';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-002 - % table(s) missing policies: %', v_tables_without_policies, v_missing_tables;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-003: Total policy count meets minimum threshold (151 policies)
-- ============================================================================
DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT count(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'perfecity';

    IF v_policy_count >= 151 THEN
        RAISE NOTICE 'PASS: T-P0-RLS-003 - Total policy count is % (minimum 151 required)', v_policy_count;
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-003 - Expected at least 151 policies, got %', v_policy_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-004: anon role has NO USAGE on perfecity schema
-- ============================================================================
DO $$
DECLARE
    v_has_usage BOOLEAN;
BEGIN
    SELECT has_schema_privilege('anon', 'perfecity', 'USAGE') INTO v_has_usage;

    IF NOT v_has_usage THEN
        RAISE NOTICE 'PASS: T-P0-RLS-004 - anon role does NOT have USAGE on perfecity schema';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-004 - anon role has USAGE on perfecity schema (security risk)';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-005: authenticated role HAS USAGE on perfecity schema
-- ============================================================================
DO $$
DECLARE
    v_has_usage BOOLEAN;
BEGIN
    SELECT has_schema_privilege('authenticated', 'perfecity', 'USAGE') INTO v_has_usage;

    IF v_has_usage THEN
        RAISE NOTICE 'PASS: T-P0-RLS-005 - authenticated role has USAGE on perfecity schema';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-005 - authenticated role lacks USAGE on perfecity schema';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-006: perfecity.current_user_role() function exists and is STABLE
-- ============================================================================
DO $$
DECLARE
    v_func_exists BOOLEAN;
    v_volatility TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'perfecity'
          AND p.proname = 'current_user_role'
    ) INTO v_func_exists;

    IF NOT v_func_exists THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-006 - perfecity.current_user_role() function not found';
    END IF;

    SELECT p.provolatile INTO v_volatility
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'perfecity'
      AND p.proname = 'current_user_role';

    IF v_volatility = 's' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-006 - perfecity.current_user_role() exists and is STABLE';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-006 - current_user_role() volatility is %, expected s (STABLE)', v_volatility;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-007: current_user_role() is SECURITY DEFINER
-- ============================================================================
DO $$
DECLARE
    v_is_secdef BOOLEAN;
BEGIN
    SELECT p.prosecdef INTO v_is_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'perfecity'
      AND p.proname = 'current_user_role';

    IF v_is_secdef THEN
        RAISE NOTICE 'PASS: T-P0-RLS-007 - current_user_role() is SECURITY DEFINER';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-007 - current_user_role() is not SECURITY DEFINER';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-008: No policies reference anon role directly
-- ============================================================================
DO $$
DECLARE
    v_anon_policies INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' on ' || tablename, ', ')
    INTO v_anon_policies, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND roles::text LIKE '%anon%';

    IF v_anon_policies = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RLS-008 - No policies reference anon role';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-008 - % policies reference anon role: %', v_anon_policies, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-009: All SELECT policies exist for master data tables
--   Master data: product_master, family_master, category_master,
--                design_family_master, design_subfamily_master
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'product_master', 'family_master', 'category_master',
        'design_family_master', 'design_subfamily_master'
    ];
    v_has_select BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'SELECT'
        ) INTO v_has_select;

        IF NOT v_has_select THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-009 - All master data tables have SELECT policies';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-009 - Missing SELECT policies on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-010: Project table has tenant isolation via created_by in CONSULTANT policy
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'project'
      AND policyname = 'project_select_consultant';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-010 - project_select_consultant policy not found';
    ELSIF v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-010 - project_select_consultant enforces tenant isolation via created_by';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-010 - project_select_consultant lacks tenant isolation. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-011: Project INSERT policy enforces created_by = auth.uid()
-- ============================================================================
DO $$
DECLARE
    v_with_check TEXT;
BEGIN
    SELECT with_check INTO v_with_check
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'project'
      AND policyname = 'project_insert_consultant';

    IF v_with_check IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-011 - project_insert_consultant policy not found';
    ELSIF v_with_check LIKE '%created_by%' AND v_with_check LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-011 - project_insert_consultant enforces created_by = auth.uid()';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-011 - project_insert_consultant lacks ownership check. with_check=%', v_with_check;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-012: Project child tables enforce isolation via parent project ownership
--   Tables: project_snapshot, project_configuration, project_measurement
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['project_snapshot', 'project_configuration', 'project_measurement'];
    v_qual TEXT;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT qual INTO v_qual
        FROM pg_policies
        WHERE schemaname = 'perfecity'
          AND tablename = v_table
          AND policyname = v_table || '_select_consultant';

        IF v_qual IS NULL THEN
            v_missing := v_missing || v_table || ' (no policy), ';
        ELSIF NOT (v_qual LIKE '%project%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%') THEN
            v_missing := v_missing || v_table || ' (no tenant check), ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-012 - All project child tables enforce tenant isolation via project ownership';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-012 - Missing tenant isolation: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-013: Actual BOM enforces tenant isolation via project ownership
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'actual_bom'
      AND policyname = 'actual_bom_select_consultant';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-013 - actual_bom_select_consultant policy not found';
    ELSIF v_qual LIKE '%project%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-013 - actual_bom enforces tenant isolation via project ownership';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-013 - actual_bom_select_consultant lacks tenant check. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-014: Actual BOM line enforces tenant isolation through BOM->project chain
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'actual_bom_line'
      AND policyname = 'actual_bom_line_select_consultant';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-014 - actual_bom_line_select_consultant policy not found';
    ELSIF v_qual LIKE '%actual_bom%' AND v_qual LIKE '%project%' AND v_qual LIKE '%created_by%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-014 - actual_bom_line enforces tenant isolation through join chain';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-014 - actual_bom_line lacks proper tenant chain. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-015: Final BOM enforces tenant isolation for CONSULTANT
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'final_bom'
      AND policyname = 'final_bom_select_consultant';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-015 - final_bom_select_consultant policy not found';
    ELSIF v_qual LIKE '%project%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-015 - final_bom enforces tenant isolation for CONSULTANT';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-015 - final_bom_select_consultant lacks tenant check. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-016: Final BOM line enforces tenant isolation through join chain
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'final_bom_line'
      AND policyname = 'final_bom_line_select_consultant';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-016 - final_bom_line_select_consultant policy not found';
    ELSIF v_qual LIKE '%final_bom%' AND v_qual LIKE '%project%' AND v_qual LIKE '%created_by%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-016 - final_bom_line enforces tenant isolation through join chain';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-016 - final_bom_line lacks proper tenant chain. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-017: Template ownership enforcement - DESIGNER policies use created_by
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'template'
      AND policyname = 'template_update_designer';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-017 - template_update_designer policy not found';
    ELSIF v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-017 - template_update_designer enforces ownership via created_by';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-017 - template_update_designer lacks ownership check. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-018: Template zone DESIGNER policies enforce ownership via parent template
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'template_zone'
      AND policyname = 'template_zone_insert_designer';

    IF v_qual IS NULL THEN
        -- Check with_check for INSERT policies
        SELECT with_check INTO v_qual
        FROM pg_policies
        WHERE schemaname = 'perfecity'
          AND tablename = 'template_zone'
          AND policyname = 'template_zone_insert_designer';
    END IF;

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-018 - template_zone_insert_designer policy not found';
    ELSIF v_qual LIKE '%template%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-018 - template_zone DESIGNER policies enforce ownership via parent template';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-018 - template_zone_insert_designer lacks ownership chain. qual/check=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-019: Template zone SKU DESIGNER policies enforce grandparent ownership
-- ============================================================================
DO $$
DECLARE
    v_with_check TEXT;
BEGIN
    SELECT with_check INTO v_with_check
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'template_zone_sku'
      AND policyname = 'template_zone_sku_insert_designer';

    IF v_with_check IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-019 - template_zone_sku_insert_designer policy not found';
    ELSIF v_with_check LIKE '%template_zone%' AND v_with_check LIKE '%template%' AND v_with_check LIKE '%created_by%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-019 - template_zone_sku enforces grandparent ownership chain';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-019 - template_zone_sku lacks ownership chain. with_check=%', v_with_check;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-020: Idempotency tables enforce tenant isolation
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['project_idempotency', 'finalization_idempotency'];
    v_qual TEXT;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT qual INTO v_qual
        FROM pg_policies
        WHERE schemaname = 'perfecity'
          AND tablename = v_table
          AND policyname = v_table || '_select_consultant';

        IF v_qual IS NULL THEN
            v_missing := v_missing || v_table || ' (no policy), ';
        ELSIF NOT (v_qual LIKE '%project%' AND v_qual LIKE '%created_by%') THEN
            v_missing := v_missing || v_table || ' (no tenant check), ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-020 - Idempotency tables enforce tenant isolation';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-020 - Missing tenant isolation: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-021: audit_event has NO INSERT policy for authenticated
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
        RAISE NOTICE 'PASS: T-P0-RLS-021 - audit_event has no INSERT policy (service_role-only writes)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-021 - audit_event has % INSERT policy(ies) (should be 0)', v_insert_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-022: audit_event has NO UPDATE or DELETE policies
-- ============================================================================
DO $$
DECLARE
    v_mutate_count INTEGER;
BEGIN
    SELECT count(*) INTO v_mutate_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'audit_event'
      AND cmd IN ('UPDATE', 'DELETE');

    IF v_mutate_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RLS-022 - audit_event has no UPDATE/DELETE policies (immutable audit trail)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-022 - audit_event has % UPDATE/DELETE policy(ies)', v_mutate_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-023: All policies target authenticated role only
-- ============================================================================
DO $$
DECLARE
    v_non_auth_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' on ' || tablename || ' (roles: ' || roles::text || ')', '; ')
    INTO v_non_auth_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND NOT (roles::text LIKE '%authenticated%');

    IF v_non_auth_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RLS-023 - All policies target authenticated role only';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-023 - % policies target non-authenticated roles: %', v_non_auth_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-024: Catalogue tables (catalogue_entry, catalogue_asset, catalogue_asset_metadata)
--               have SELECT policies for all authenticated users
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['catalogue_entry', 'catalogue_asset', 'catalogue_asset_metadata'];
    v_has_select BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'SELECT'
              AND policyname LIKE '%select_authenticated%'
        ) INTO v_has_select;

        IF NOT v_has_select THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-024 - All catalogue tables have authenticated SELECT policies';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-024 - Missing authenticated SELECT policies on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-025: SKU tables have read-all policies for authenticated
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['sku_master', 'sku_variant', 'sku_compatibility'];
    v_has_select BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'SELECT'
              AND policyname LIKE '%select_authenticated%'
        ) INTO v_has_select;

        IF NOT v_has_select THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-025 - All SKU tables have authenticated SELECT policies';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-025 - Missing authenticated SELECT on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-026: rule_set table has SELECT for all authenticated
-- ============================================================================
DO $$
DECLARE
    v_has_select BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity'
          AND tablename = 'rule_set'
          AND cmd = 'SELECT'
          AND policyname = 'rule_set_select_authenticated'
    ) INTO v_has_select;

    IF v_has_select THEN
        RAISE NOTICE 'PASS: T-P0-RLS-026 - rule_set has authenticated SELECT policy';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-026 - rule_set lacks authenticated SELECT policy';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-027: Master BOM tables have SELECT for all authenticated
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['master_bom', 'master_bom_line'];
    v_has_select BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'SELECT'
              AND policyname LIKE '%select_authenticated%'
        ) INTO v_has_select;

        IF NOT v_has_select THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-027 - Master BOM tables have authenticated SELECT policies';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-027 - Missing authenticated SELECT on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-028: Template SELECT policy uses USING(true) for universal read
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'template'
      AND policyname = 'template_select_authenticated';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RLS-028 - template_select_authenticated policy not found';
    ELSIF v_qual LIKE '%true%' THEN
        RAISE NOTICE 'PASS: T-P0-RLS-028 - template_select_authenticated uses USING(true) for universal read';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-028 - template_select_authenticated does not use USING(true). qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-029: Verify project_snapshot has NO UPDATE policy (immutability)
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
        RAISE NOTICE 'PASS: T-P0-RLS-029 - project_snapshot has no UPDATE policy (immutability preserved)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-029 - project_snapshot has % UPDATE policy(ies) (should be 0)', v_update_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RLS-030: Verify project_snapshot has NO DELETE policy
-- ============================================================================
DO $$
DECLARE
    v_delete_count INTEGER;
BEGIN
    SELECT count(*) INTO v_delete_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'project_snapshot'
      AND cmd = 'DELETE';

    IF v_delete_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RLS-030 - project_snapshot has no DELETE policy (immutability preserved)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RLS-030 - project_snapshot has % DELETE policy(ies) (should be 0)', v_delete_count;
    END IF;
END;
$$;

-- ============================================================================
-- Final summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'P0 RLS Enforcement Test Suite COMPLETE.';
    RAISE NOTICE 'If no exceptions were raised, all tests (T-P0-RLS-001 to T-P0-RLS-030) PASSED.';
    RAISE NOTICE 'RLS enforcement layer is verified.';
    RAISE NOTICE '=================================================================';
END;
$$;
