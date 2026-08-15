-- ============================================================================
-- PERFECCITY P0 TEST SUITE - RBAC Boundaries
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Purpose: Verify Designer/Consultant/Admin permission boundaries are correctly
--          enforced through RLS policy structure.
-- Run AFTER applying migrations/v1.1.5_rls_policies.sql
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T-P0-RBAC-001: ADMIN has INSERT policies on master data tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'product_master', 'family_master', 'category_master',
        'design_family_master', 'design_subfamily_master',
        'sku_master', 'sku_variant', 'sku_compatibility'
    ];
    v_has_insert BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'INSERT'
              AND policyname LIKE '%admin%'
        ) INTO v_has_insert;

        IF NOT v_has_insert THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-001 - ADMIN has INSERT policies on all master data tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-001 - ADMIN missing INSERT policy on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-002: ADMIN has UPDATE policies on master data tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'product_master', 'family_master', 'category_master',
        'design_family_master', 'design_subfamily_master',
        'sku_master', 'sku_variant', 'sku_compatibility'
    ];
    v_has_update BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'UPDATE'
              AND policyname LIKE '%admin%'
        ) INTO v_has_update;

        IF NOT v_has_update THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-002 - ADMIN has UPDATE policies on all master data tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-002 - ADMIN missing UPDATE policy on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-003: ADMIN has DELETE policies on master data tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'product_master', 'family_master', 'category_master',
        'design_family_master', 'design_subfamily_master',
        'sku_master', 'sku_variant', 'sku_compatibility'
    ];
    v_has_delete BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity'
              AND tablename = v_table
              AND cmd = 'DELETE'
              AND policyname LIKE '%admin%'
        ) INTO v_has_delete;

        IF NOT v_has_delete THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-003 - ADMIN has DELETE policies on all master data tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-003 - ADMIN missing DELETE policy on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-004: ADMIN policies on master data check current_user_role() = 'ADMIN'
-- ============================================================================
DO $$
DECLARE
    v_with_check TEXT;
BEGIN
    SELECT with_check INTO v_with_check
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'product_master'
      AND policyname = 'product_master_insert_admin';

    IF v_with_check IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-004 - product_master_insert_admin policy not found';
    ELSIF v_with_check LIKE '%current_user_role()%' AND v_with_check LIKE '%ADMIN%' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-004 - ADMIN INSERT policies check current_user_role() = ADMIN';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-004 - ADMIN policy lacks role check. with_check=%', v_with_check;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-005: No DESIGNER INSERT/UPDATE/DELETE policies on master data
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'product_master', 'family_master', 'category_master',
        'design_family_master', 'design_subfamily_master',
        'sku_master', 'sku_variant', 'sku_compatibility'
    ];
    v_designer_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' on ' || tablename, ', ')
    INTO v_designer_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = ANY(v_tables)
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND policyname LIKE '%designer%';

    IF v_designer_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-005 - No DESIGNER write policies on master data tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-005 - % DESIGNER write policies found on master data: %', v_designer_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-006: No CONSULTANT INSERT/UPDATE/DELETE policies on master data
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'product_master', 'family_master', 'category_master',
        'design_family_master', 'design_subfamily_master',
        'sku_master', 'sku_variant', 'sku_compatibility'
    ];
    v_consultant_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' on ' || tablename, ', ')
    INTO v_consultant_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = ANY(v_tables)
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND policyname LIKE '%consultant%';

    IF v_consultant_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-006 - No CONSULTANT write policies on master data tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-006 - % CONSULTANT write policies found on master data: %', v_consultant_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-007: DESIGNER has INSERT/UPDATE/DELETE on template (own)
-- ============================================================================
DO $$
DECLARE
    v_insert_exists BOOLEAN;
    v_update_exists BOOLEAN;
    v_delete_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'template'
          AND policyname = 'template_insert_designer' AND cmd = 'INSERT'
    ) INTO v_insert_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'template'
          AND policyname = 'template_update_designer' AND cmd = 'UPDATE'
    ) INTO v_update_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'template'
          AND policyname = 'template_delete_designer' AND cmd = 'DELETE'
    ) INTO v_delete_exists;

    IF v_insert_exists AND v_update_exists AND v_delete_exists THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-007 - DESIGNER has full CRUD (own) on template';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-007 - DESIGNER template policies missing: insert=%, update=%, delete=%',
            v_insert_exists, v_update_exists, v_delete_exists;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-008: DESIGNER template INSERT enforces created_by = auth.uid()
-- ============================================================================
DO $$
DECLARE
    v_with_check TEXT;
BEGIN
    SELECT with_check INTO v_with_check
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'template'
      AND policyname = 'template_insert_designer';

    IF v_with_check IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-008 - template_insert_designer policy not found';
    ELSIF v_with_check LIKE '%created_by%' AND v_with_check LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-008 - DESIGNER INSERT enforces created_by = auth.uid()';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-008 - template_insert_designer lacks ownership check. with_check=%', v_with_check;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-009: DESIGNER has INSERT/UPDATE/DELETE on template child tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'template_zone', 'template_lighting', 'template_furniture',
        'template_trim', 'template_hidden_component', 'template_consultant_permission'
    ];
    v_missing TEXT := '';
    v_has_insert BOOLEAN;
    v_has_update BOOLEAN;
    v_has_delete BOOLEAN;
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_insert_designer' AND cmd = 'INSERT'
        ) INTO v_has_insert;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_update_designer' AND cmd = 'UPDATE'
        ) INTO v_has_update;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_delete_designer' AND cmd = 'DELETE'
        ) INTO v_has_delete;

        IF NOT (v_has_insert AND v_has_update AND v_has_delete) THEN
            v_missing := v_missing || v_table || ' (I=' || v_has_insert || ' U=' || v_has_update || ' D=' || v_has_delete || '), ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-009 - DESIGNER has full write on all template child tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-009 - Missing DESIGNER policies: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-010: No CONSULTANT INSERT/UPDATE/DELETE on template tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'template', 'template_zone', 'template_lighting', 'template_furniture',
        'template_trim', 'template_hidden_component', 'template_consultant_permission',
        'template_zone_sku', 'template_zone_alternative'
    ];
    v_consultant_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' on ' || tablename, ', ')
    INTO v_consultant_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = ANY(v_tables)
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND policyname LIKE '%consultant%'
      AND policyname NOT LIKE 'template_consultant_permission%';

    IF v_consultant_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-010 - No CONSULTANT write policies on template tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-010 - % CONSULTANT write policies found on templates: %', v_consultant_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-011: CONSULTANT has INSERT/UPDATE on own project
-- ============================================================================
DO $$
DECLARE
    v_insert_exists BOOLEAN;
    v_update_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'project'
          AND policyname = 'project_insert_consultant' AND cmd = 'INSERT'
    ) INTO v_insert_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'project'
          AND policyname = 'project_update_consultant' AND cmd = 'UPDATE'
    ) INTO v_update_exists;

    IF v_insert_exists AND v_update_exists THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-011 - CONSULTANT has INSERT/UPDATE on project';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-011 - CONSULTANT project policies: insert=%, update=%', v_insert_exists, v_update_exists;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-012: CONSULTANT has INSERT on project child tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['project_snapshot', 'project_configuration', 'project_measurement'];
    v_has_insert BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_insert_consultant' AND cmd = 'INSERT'
        ) INTO v_has_insert;

        IF NOT v_has_insert THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-012 - CONSULTANT has INSERT on all project child tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-012 - CONSULTANT missing INSERT on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-013: CONSULTANT has UPDATE on project_configuration and project_measurement
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['project_configuration', 'project_measurement'];
    v_has_update BOOLEAN;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_update_consultant' AND cmd = 'UPDATE'
        ) INTO v_has_update;

        IF NOT v_has_update THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-013 - CONSULTANT has UPDATE on project_configuration and project_measurement';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-013 - CONSULTANT missing UPDATE on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-014: DESIGNER cannot INSERT/UPDATE/DELETE projects
-- ============================================================================
DO $$
DECLARE
    v_designer_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname, ', ')
    INTO v_designer_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'project'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND policyname LIKE '%designer%';

    IF v_designer_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-014 - DESIGNER has no write policies on project table';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-014 - DESIGNER has % write policies on project: %', v_designer_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-015: DESIGNER can SELECT all projects (to view templates in use)
-- ============================================================================
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'project'
          AND policyname = 'project_select_designer' AND cmd = 'SELECT'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-015 - DESIGNER has SELECT on projects';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-015 - DESIGNER lacks SELECT on projects';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-016: ADMIN can SELECT all projects
-- ============================================================================
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'project'
          AND policyname = 'project_select_admin' AND cmd = 'SELECT'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-016 - ADMIN has SELECT on projects';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-016 - ADMIN lacks SELECT on projects';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-017: Only ADMIN can SELECT audit_event
-- ============================================================================
DO $$
DECLARE
    v_select_count INTEGER;
    v_admin_select BOOLEAN;
BEGIN
    SELECT count(*) INTO v_select_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'audit_event'
      AND cmd = 'SELECT';

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity'
          AND tablename = 'audit_event'
          AND cmd = 'SELECT'
          AND policyname = 'audit_event_select_admin'
    ) INTO v_admin_select;

    IF v_select_count = 1 AND v_admin_select THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-017 - Only ADMIN can SELECT audit_event';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-017 - audit_event SELECT policies count=% (expected 1), admin_exists=%', v_select_count, v_admin_select;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-018: ADMIN audit_event SELECT uses current_user_role() = 'ADMIN'
-- ============================================================================
DO $$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'audit_event'
      AND policyname = 'audit_event_select_admin';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-018 - audit_event_select_admin not found';
    ELSIF v_qual LIKE '%current_user_role()%' AND v_qual LIKE '%ADMIN%' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-018 - audit_event_select_admin checks ADMIN role';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-018 - audit_event_select_admin lacks ADMIN check. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-019: master_bom UPDATE for DESIGNER is ownership-scoped
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
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-019 - master_bom_update_designer policy not found';
    ELSIF v_qual LIKE '%template%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-019 - master_bom_update_designer is ownership-scoped via template';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-019 - master_bom_update_designer lacks ownership scope. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-020: No CONSULTANT write policies on BOM tables
-- ============================================================================
DO $$
DECLARE
    v_bom_tables TEXT[] := ARRAY[
        'master_bom', 'master_bom_line', 'actual_bom', 'actual_bom_line',
        'final_bom', 'final_bom_line'
    ];
    v_consultant_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' on ' || tablename, ', ')
    INTO v_consultant_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = ANY(v_bom_tables)
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND policyname LIKE '%consultant%';

    IF v_consultant_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-020 - No CONSULTANT write policies on any BOM table';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-020 - % CONSULTANT write policies on BOM tables: %', v_consultant_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-021: DESIGNER has SELECT on final_bom (own template projects)
-- ============================================================================
DO $$
DECLARE
    v_exists BOOLEAN;
    v_qual TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'final_bom'
          AND policyname = 'final_bom_select_designer' AND cmd = 'SELECT'
    ) INTO v_exists;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-021 - final_bom_select_designer not found';
    END IF;

    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'final_bom'
      AND policyname = 'final_bom_select_designer';

    IF v_qual LIKE '%template%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-021 - DESIGNER can SELECT final_bom for own template projects';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-021 - final_bom_select_designer lacks template ownership. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-022: DESIGNER has SELECT on final_bom_line (own template projects)
-- ============================================================================
DO $$
DECLARE
    v_exists BOOLEAN;
    v_qual TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'final_bom_line'
          AND policyname = 'final_bom_line_select_designer' AND cmd = 'SELECT'
    ) INTO v_exists;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-022 - final_bom_line_select_designer not found';
    END IF;

    SELECT qual INTO v_qual
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'final_bom_line'
      AND policyname = 'final_bom_line_select_designer';

    IF v_qual LIKE '%template%' AND v_qual LIKE '%created_by%' AND v_qual LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-022 - DESIGNER can SELECT final_bom_line for own template projects';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-022 - final_bom_line_select_designer lacks template ownership. qual=%', v_qual;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-023: ADMIN has full CRUD on template tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'template', 'template_zone', 'template_lighting', 'template_furniture',
        'template_trim', 'template_hidden_component', 'template_consultant_permission',
        'template_zone_sku', 'template_zone_alternative'
    ];
    v_missing TEXT := '';
    v_has_insert BOOLEAN;
    v_has_update BOOLEAN;
    v_has_delete BOOLEAN;
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname LIKE '%admin%' AND cmd = 'INSERT'
        ) INTO v_has_insert;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname LIKE '%admin%' AND cmd = 'UPDATE'
        ) INTO v_has_update;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname LIKE '%admin%' AND cmd = 'DELETE'
        ) INTO v_has_delete;

        IF NOT (v_has_insert AND v_has_update AND v_has_delete) THEN
            v_missing := v_missing || v_table || ' (I=' || v_has_insert || ' U=' || v_has_update || ' D=' || v_has_delete || '), ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-023 - ADMIN has full CRUD on all template tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-023 - ADMIN missing template table policies: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-024: ADMIN can INSERT/UPDATE on catalogue tables
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['catalogue_entry', 'catalogue_asset', 'catalogue_asset_metadata'];
    v_missing TEXT := '';
    v_has_insert BOOLEAN;
    v_has_update BOOLEAN;
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname LIKE '%admin%' AND cmd = 'INSERT'
        ) INTO v_has_insert;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname LIKE '%admin%' AND cmd = 'UPDATE'
        ) INTO v_has_update;

        IF NOT (v_has_insert AND v_has_update) THEN
            v_missing := v_missing || v_table || ', ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-024 - ADMIN has INSERT/UPDATE on all catalogue tables';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-024 - ADMIN missing write on: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-025: ADMIN has INSERT/UPDATE on master_bom
-- ============================================================================
DO $$
DECLARE
    v_has_insert BOOLEAN;
    v_has_update BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'master_bom'
          AND policyname = 'master_bom_insert_admin' AND cmd = 'INSERT'
    ) INTO v_has_insert;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'master_bom'
          AND policyname = 'master_bom_update_admin' AND cmd = 'UPDATE'
    ) INTO v_has_update;

    IF v_has_insert AND v_has_update THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-025 - ADMIN has INSERT/UPDATE on master_bom';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-025 - ADMIN master_bom: insert=%, update=%', v_has_insert, v_has_update;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-026: No user role has INSERT/UPDATE/DELETE on actual_bom or actual_bom_line
-- ============================================================================
DO $$
DECLARE
    v_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' (' || cmd || ') on ' || tablename, ', ')
    INTO v_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename IN ('actual_bom', 'actual_bom_line')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

    IF v_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-026 - No user-facing write policies on actual_bom/actual_bom_line (service_role only)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-026 - % write policies found on actual_bom tables: %', v_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-027: No user role has INSERT/UPDATE/DELETE on final_bom or final_bom_line
-- ============================================================================
DO $$
DECLARE
    v_write_count INTEGER;
    v_details TEXT;
BEGIN
    SELECT count(*), string_agg(policyname || ' (' || cmd || ') on ' || tablename, ', ')
    INTO v_write_count, v_details
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename IN ('final_bom', 'final_bom_line')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

    IF v_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-027 - No user-facing write policies on final_bom/final_bom_line (service_role only)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-027 - % write policies found on final_bom tables: %', v_write_count, v_details;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-028: CONSULTANT can SELECT on actual_bom and actual_bom_line (own projects)
-- ============================================================================
DO $$
DECLARE
    v_ab_exists BOOLEAN;
    v_abl_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'actual_bom'
          AND policyname = 'actual_bom_select_consultant' AND cmd = 'SELECT'
    ) INTO v_ab_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'actual_bom_line'
          AND policyname = 'actual_bom_line_select_consultant' AND cmd = 'SELECT'
    ) INTO v_abl_exists;

    IF v_ab_exists AND v_abl_exists THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-028 - CONSULTANT has SELECT on actual_bom/actual_bom_line';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-028 - CONSULTANT actual_bom SELECT: ab=%, abl=%', v_ab_exists, v_abl_exists;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-029: ADMIN and DESIGNER can SELECT actual_bom (all)
-- ============================================================================
DO $$
DECLARE
    v_admin_exists BOOLEAN;
    v_designer_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'actual_bom'
          AND policyname = 'actual_bom_select_admin' AND cmd = 'SELECT'
    ) INTO v_admin_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = 'actual_bom'
          AND policyname = 'actual_bom_select_designer' AND cmd = 'SELECT'
    ) INTO v_designer_exists;

    IF v_admin_exists AND v_designer_exists THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-029 - ADMIN and DESIGNER can SELECT all actual_bom records';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-029 - actual_bom SELECT: admin=%, designer=%', v_admin_exists, v_designer_exists;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-RBAC-030: Idempotency tables - only CONSULTANT (own) and ADMIN can SELECT
-- ============================================================================
DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY['project_idempotency', 'finalization_idempotency'];
    v_consultant_exists BOOLEAN;
    v_admin_exists BOOLEAN;
    v_other_count INTEGER;
    v_missing TEXT := '';
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_select_consultant' AND cmd = 'SELECT'
        ) INTO v_consultant_exists;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'perfecity' AND tablename = v_table
              AND policyname = v_table || '_select_admin' AND cmd = 'SELECT'
        ) INTO v_admin_exists;

        SELECT count(*) INTO v_other_count
        FROM pg_policies
        WHERE schemaname = 'perfecity' AND tablename = v_table
          AND cmd = 'SELECT'
          AND policyname NOT LIKE '%consultant%'
          AND policyname NOT LIKE '%admin%';

        IF NOT v_consultant_exists OR NOT v_admin_exists OR v_other_count > 0 THEN
            v_missing := v_missing || v_table || ' (consultant=' || v_consultant_exists || ' admin=' || v_admin_exists || ' other_selects=' || v_other_count || '), ';
        END IF;
    END LOOP;

    IF v_missing = '' THEN
        RAISE NOTICE 'PASS: T-P0-RBAC-030 - Idempotency tables: only CONSULTANT (own) and ADMIN can SELECT';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-RBAC-030 - Idempotency table policy issues: %', v_missing;
    END IF;
END;
$$;

-- ============================================================================
-- Final summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'P0 RBAC Boundaries Test Suite COMPLETE.';
    RAISE NOTICE 'If no exceptions were raised, all tests (T-P0-RBAC-001 to T-P0-RBAC-030) PASSED.';
    RAISE NOTICE 'Role-based access control boundaries are verified.';
    RAISE NOTICE '=================================================================';
END;
$$;
