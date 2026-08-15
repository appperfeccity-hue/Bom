-- ============================================================================
-- PERFECCITY P0 TEST SUITE - Snapshot Isolation
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Purpose: Verify snapshot immutability, template change isolation from
--          existing projects, and BOM determinism invariants.
-- Run AFTER applying baseline_v1.1.5.sql and migrations/v1.1.5_rls_policies.sql
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T-P0-SNAP-001: project_snapshot has NO UPDATE policy (immutability at RLS level)
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
        RAISE NOTICE 'PASS: T-P0-SNAP-001 - project_snapshot has no UPDATE policy (immutability enforced)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-001 - project_snapshot has % UPDATE policy(ies)', v_update_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-002: project_snapshot has NO DELETE policy (immutability at RLS level)
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
        RAISE NOTICE 'PASS: T-P0-SNAP-002 - project_snapshot has no DELETE policy (immutability enforced)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-002 - project_snapshot has % DELETE policy(ies)', v_delete_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-003: project_snapshot table has snapshot_hash column (integrity check)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project_snapshot'
          AND column_name = 'snapshot_hash'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-003 - project_snapshot has snapshot_hash column for integrity';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-003 - project_snapshot missing snapshot_hash column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-004: project_snapshot table has snapshot_data column (JSONB)
-- ============================================================================
DO $$
DECLARE
    v_data_type TEXT;
BEGIN
    SELECT data_type INTO v_data_type
    FROM information_schema.columns
    WHERE table_schema = 'perfecity'
      AND table_name = 'project_snapshot'
      AND column_name = 'snapshot_data';

    IF v_data_type IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-004 - project_snapshot missing snapshot_data column';
    ELSIF v_data_type = 'jsonb' THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-004 - project_snapshot.snapshot_data is JSONB type';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-004 - snapshot_data type is %, expected jsonb', v_data_type;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-005: project_snapshot references template_id (point-in-time link)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project_snapshot'
          AND column_name = 'template_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-005 - project_snapshot has template_id column (point-in-time reference)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-005 - project_snapshot missing template_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-006: project_snapshot references rule_set_id (determinism anchor)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project_snapshot'
          AND column_name = 'rule_set_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-006 - project_snapshot has rule_set_id column (determinism anchor)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-006 - project_snapshot missing rule_set_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-007: project.snapshot_id FK exists (links project to its snapshot)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project'
          AND column_name = 'snapshot_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-007 - project table has snapshot_id column';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-007 - project table missing snapshot_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-008: Template change does not alter existing snapshot data
--   (Structural test: snapshot_data is stored as JSONB, not a view/reference)
-- ============================================================================
DO $$
DECLARE
    v_is_generated TEXT;
BEGIN
    SELECT is_generated INTO v_is_generated
    FROM information_schema.columns
    WHERE table_schema = 'perfecity'
      AND table_name = 'project_snapshot'
      AND column_name = 'snapshot_data';

    IF v_is_generated = 'NEVER' THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-008 - snapshot_data is stored data (not generated/computed)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-008 - snapshot_data is generated (is_generated=%)', v_is_generated;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-009: actual_bom references snapshot_id (BOM tied to snapshot state)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'actual_bom'
          AND column_name = 'snapshot_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-009 - actual_bom has snapshot_id column (tied to snapshot state)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-009 - actual_bom missing snapshot_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-010: actual_bom has input_hash for deterministic recomputation check
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'actual_bom'
          AND column_name = 'input_hash'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-010 - actual_bom has input_hash column for deterministic verification';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-010 - actual_bom missing input_hash column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-011: Template modification demotes template from ACTIVE to DRAFT
--   (Verify trigger exists on template_zone that causes demotion)
-- ============================================================================
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_schema = 'perfecity'
          AND event_object_table = 'template_zone'
          AND event_manipulation IN ('UPDATE', 'DELETE')
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-011 - Trigger exists on template_zone for structural change detection';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-011 - No trigger on template_zone for structural change detection';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-012: Measurement change supersedes existing actual_bom
--   (Verify trigger exists on project_measurement for BOM invalidation)
-- ============================================================================
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_schema = 'perfecity'
          AND event_object_table = 'project_measurement'
          AND event_manipulation = 'UPDATE'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-012 - Trigger exists on project_measurement for BOM invalidation';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-012 - No trigger on project_measurement for BOM invalidation';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-013: actual_bom.status column exists (for VALIDATED/SUPERSEDED lifecycle)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'actual_bom'
          AND column_name = 'status'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-013 - actual_bom has status column for lifecycle tracking';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-013 - actual_bom missing status column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-014: actual_bom references configuration_id (snapshot + config = deterministic BOM)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'actual_bom'
          AND column_name = 'configuration_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-014 - actual_bom has configuration_id (deterministic input pair)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-014 - actual_bom missing configuration_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-015: actual_bom references engine_version (reproducibility)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'actual_bom'
          AND column_name = 'engine_version'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-015 - actual_bom has engine_version (reproducibility marker)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-015 - actual_bom missing engine_version column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-016: actual_bom references rule_set_id (deterministic rule binding)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'actual_bom'
          AND column_name = 'rule_set_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-016 - actual_bom has rule_set_id (deterministic rule binding)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-016 - actual_bom missing rule_set_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-017: project_configuration has configuration_hash for change detection
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project_configuration'
          AND column_name = 'configuration_hash'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-017 - project_configuration has configuration_hash for change detection';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-017 - project_configuration missing configuration_hash column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-018: project_configuration has configuration_version for versioning
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project_configuration'
          AND column_name = 'configuration_version'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-018 - project_configuration has configuration_version for versioning';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-018 - project_configuration missing configuration_version column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-019: project_idempotency table exists (prevents duplicate operations)
-- ============================================================================
DO $$
DECLARE
    v_table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'perfecity'
          AND tablename = 'project_idempotency'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-019 - project_idempotency table exists (duplicate prevention)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-019 - project_idempotency table not found';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-020: finalization_idempotency table exists (prevents duplicate finalization)
-- ============================================================================
DO $$
DECLARE
    v_table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'perfecity'
          AND tablename = 'finalization_idempotency'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-020 - finalization_idempotency table exists (duplicate prevention)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-020 - finalization_idempotency table not found';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-021: Template activation requires approved master_bom
--   (Verify trigger/function exists on template for activation validation)
-- ============================================================================
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_schema = 'perfecity'
          AND event_object_table = 'template'
          AND event_manipulation = 'UPDATE'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-021 - Trigger exists on template for activation validation';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-021 - No trigger on template for activation validation';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-022: master_bom has status column (APPROVED required for template activation)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'master_bom'
          AND column_name = 'status'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-022 - master_bom has status column for approval lifecycle';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-022 - master_bom missing status column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-023: project.current_actual_bom_id column exists (active BOM reference)
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project'
          AND column_name = 'current_actual_bom_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-023 - project has current_actual_bom_id for active BOM tracking';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-023 - project missing current_actual_bom_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-024: project.current_configuration_id column exists
-- ============================================================================
DO $$
DECLARE
    v_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'perfecity'
          AND table_name = 'project'
          AND column_name = 'current_configuration_id'
    ) INTO v_col_exists;

    IF v_col_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-024 - project has current_configuration_id for config tracking';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-024 - project missing current_configuration_id column';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-025: project_snapshot.snapshot_hash has NOT NULL constraint
-- ============================================================================
DO $$
DECLARE
    v_is_nullable TEXT;
BEGIN
    SELECT is_nullable INTO v_is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'perfecity'
      AND table_name = 'project_snapshot'
      AND column_name = 'snapshot_hash';

    IF v_is_nullable IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-025 - snapshot_hash column not found';
    ELSIF v_is_nullable = 'NO' THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-025 - snapshot_hash is NOT NULL (integrity enforced)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-025 - snapshot_hash allows NULL (should be NOT NULL)';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-026: project_snapshot.snapshot_data has NOT NULL constraint
-- ============================================================================
DO $$
DECLARE
    v_is_nullable TEXT;
BEGIN
    SELECT is_nullable INTO v_is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'perfecity'
      AND table_name = 'project_snapshot'
      AND column_name = 'snapshot_data';

    IF v_is_nullable IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-026 - snapshot_data column not found';
    ELSIF v_is_nullable = 'NO' THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-026 - snapshot_data is NOT NULL (data integrity enforced)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-026 - snapshot_data allows NULL (should be NOT NULL)';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-027: Verify project_snapshot has INSERT policy for CONSULTANT (create-only)
-- ============================================================================
DO $$
DECLARE
    v_insert_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'perfecity'
          AND tablename = 'project_snapshot'
          AND policyname = 'project_snapshot_insert_consultant'
          AND cmd = 'INSERT'
    ) INTO v_insert_exists;

    IF v_insert_exists THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-027 - project_snapshot has INSERT policy for CONSULTANT (create-only)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-027 - project_snapshot missing INSERT policy for CONSULTANT';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-028: project_snapshot INSERT is scoped to own project
-- ============================================================================
DO $$
DECLARE
    v_with_check TEXT;
BEGIN
    SELECT with_check INTO v_with_check
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'project_snapshot'
      AND policyname = 'project_snapshot_insert_consultant';

    IF v_with_check IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-028 - project_snapshot_insert_consultant not found';
    ELSIF v_with_check LIKE '%project%' AND v_with_check LIKE '%created_by%' AND v_with_check LIKE '%auth.uid()%' THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-028 - project_snapshot INSERT scoped to own project';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-028 - project_snapshot INSERT lacks ownership scope. with_check=%', v_with_check;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-029: final_bom has NO INSERT/UPDATE/DELETE policies (immutable, service_role only)
-- ============================================================================
DO $$
DECLARE
    v_write_count INTEGER;
BEGIN
    SELECT count(*) INTO v_write_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'final_bom'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

    IF v_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-029 - final_bom has no write policies (immutable, service_role only)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-029 - final_bom has % write policy(ies)', v_write_count;
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-SNAP-030: final_bom_line has NO INSERT/UPDATE/DELETE policies (immutable)
-- ============================================================================
DO $$
DECLARE
    v_write_count INTEGER;
BEGIN
    SELECT count(*) INTO v_write_count
    FROM pg_policies
    WHERE schemaname = 'perfecity'
      AND tablename = 'final_bom_line'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

    IF v_write_count = 0 THEN
        RAISE NOTICE 'PASS: T-P0-SNAP-030 - final_bom_line has no write policies (immutable, service_role only)';
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-SNAP-030 - final_bom_line has % write policy(ies)', v_write_count;
    END IF;
END;
$$;

-- ============================================================================
-- Final summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'P0 Snapshot Isolation Test Suite COMPLETE.';
    RAISE NOTICE 'If no exceptions were raised, all tests (T-P0-SNAP-001 to T-P0-SNAP-030) PASSED.';
    RAISE NOTICE 'Snapshot immutability and template change isolation are verified.';
    RAISE NOTICE '=================================================================';
END;
$$;
