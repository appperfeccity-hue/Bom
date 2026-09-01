-- ============================================================================
-- PERFECCITY P0 TEST SUITE - Template Validation in create_project RPC
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Purpose: Verify that create_project() enforces ACTIVE template status.
--   - ACTIVE template -> project creation succeeds
--   - DRAFT template -> project creation is rejected
--   - RETIRED template -> project creation is rejected
--   - Non-existent template UUID -> project creation is rejected
-- Run AFTER applying baseline_v1.1.5.sql and migrations/v1.1.6_p0_fixes_grants_triggers_rpc.sql
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T-P0-TMPL-001: create_project with ACTIVE template succeeds
-- ============================================================================
DO $$
DECLARE
    v_project_id UUID;
    v_active_template_id UUID := '0b8007da-dfe5-46db-b5da-63f4b8387372'; -- Modern Oak TV Wall (ACTIVE)
    v_consultant_id UUID := '230d0b25-41e4-49ab-bb72-4158c4eaea13';
    v_rule_set_id UUID := '0d58e18b-8f83-485a-83af-a90883420573';
    v_idempotency_key TEXT := 'test-tmpl-001-' || gen_random_uuid()::text;
BEGIN
    -- Set auth context to simulate consultant
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_consultant_id::text,
        'role', 'authenticated'
    )::text, true);
    PERFORM set_config('role', 'authenticated', true);

    v_project_id := perfecity.create_project(
        v_active_template_id,
        v_consultant_id,
        v_idempotency_key,
        '{"zones":[]}'::jsonb,
        'hash-active-test',
        v_rule_set_id
    );

    IF v_project_id IS NOT NULL THEN
        RAISE NOTICE 'PASS: T-P0-TMPL-001 - create_project with ACTIVE template returns project_id %', v_project_id;
    ELSE
        RAISE EXCEPTION 'FAIL: T-P0-TMPL-001 - create_project with ACTIVE template returned NULL';
    END IF;
END;
$$;

-- ============================================================================
-- T-P0-TMPL-002: create_project with DRAFT template is rejected
-- ============================================================================
DO $$
DECLARE
    v_project_id UUID;
    v_draft_template_id UUID;
    v_consultant_id UUID := '230d0b25-41e4-49ab-bb72-4158c4eaea13';
    v_rule_set_id UUID := '0d58e18b-8f83-485a-83af-a90883420573';
    v_idempotency_key TEXT := 'test-tmpl-002-' || gen_random_uuid()::text;
BEGIN
    -- Create a DRAFT template for testing
    INSERT INTO perfecity.template (template_id, name, description, design_family_id, wall_application, wall_geometry, adaptation_strategy, waste_factor, metadata, status, created_by)
    SELECT gen_random_uuid(), 'Test Draft Template', 'for validation test',
           design_family_id, 'FULL_WALL',
           '{"type":"STRAIGHT","base_width_mm":3000,"base_height_mm":2400}'::jsonb,
           'PROPORTIONAL', 0.05, '{}'::jsonb, 'DRAFT', '7703d1f5-7297-47f7-ad72-23612138dc80'
    FROM perfecity.design_family_master LIMIT 1
    RETURNING template_id INTO v_draft_template_id;

    -- Set auth context to simulate consultant
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_consultant_id::text,
        'role', 'authenticated'
    )::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN
        v_project_id := perfecity.create_project(
            v_draft_template_id,
            v_consultant_id,
            v_idempotency_key,
            '{"zones":[]}'::jsonb,
            'hash-draft-test',
            v_rule_set_id
        );
        -- If we get here, the function did NOT reject the DRAFT template
        RAISE EXCEPTION 'FAIL: T-P0-TMPL-002 - create_project should reject DRAFT template but returned %', v_project_id;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Template is not active or does not exist' THEN
                RAISE NOTICE 'PASS: T-P0-TMPL-002 - create_project correctly rejects DRAFT template';
            ELSE
                RAISE EXCEPTION 'FAIL: T-P0-TMPL-002 - unexpected error: %', SQLERRM;
            END IF;
    END;

    -- Cleanup
    DELETE FROM perfecity.template WHERE template_id = v_draft_template_id;
END;
$$;

-- ============================================================================
-- T-P0-TMPL-003: create_project with non-existent template UUID is rejected
-- ============================================================================
DO $$
DECLARE
    v_project_id UUID;
    v_nonexistent_template_id UUID := '00000000-0000-0000-0000-000000000000';
    v_consultant_id UUID := '230d0b25-41e4-49ab-bb72-4158c4eaea13';
    v_rule_set_id UUID := '0d58e18b-8f83-485a-83af-a90883420573';
    v_idempotency_key TEXT := 'test-tmpl-003-' || gen_random_uuid()::text;
BEGIN
    -- Set auth context to simulate consultant
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_consultant_id::text,
        'role', 'authenticated'
    )::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN
        v_project_id := perfecity.create_project(
            v_nonexistent_template_id,
            v_consultant_id,
            v_idempotency_key,
            '{"zones":[]}'::jsonb,
            'hash-nonexistent-test',
            v_rule_set_id
        );
        -- If we get here, the function did NOT reject the non-existent template
        RAISE EXCEPTION 'FAIL: T-P0-TMPL-003 - create_project should reject non-existent template but returned %', v_project_id;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Template is not active or does not exist' THEN
                RAISE NOTICE 'PASS: T-P0-TMPL-003 - create_project correctly rejects non-existent template UUID';
            ELSE
                RAISE EXCEPTION 'FAIL: T-P0-TMPL-003 - unexpected error: %', SQLERRM;
            END IF;
    END;
END;
$$;

-- ============================================================================
-- T-P0-TMPL-004: create_project with RETIRED template is rejected
-- ============================================================================
DO $$
DECLARE
    v_project_id UUID;
    v_retired_template_id UUID;
    v_consultant_id UUID := '230d0b25-41e4-49ab-bb72-4158c4eaea13';
    v_rule_set_id UUID := '0d58e18b-8f83-485a-83af-a90883420573';
    v_idempotency_key TEXT := 'test-tmpl-004-' || gen_random_uuid()::text;
BEGIN
    -- Create a RETIRED template for testing
    INSERT INTO perfecity.template (template_id, name, description, design_family_id, wall_application, wall_geometry, adaptation_strategy, waste_factor, metadata, status, created_by)
    SELECT gen_random_uuid(), 'Test Retired Template', 'for validation test',
           design_family_id, 'FULL_WALL',
           '{"type":"STRAIGHT","base_width_mm":3000,"base_height_mm":2400}'::jsonb,
           'PROPORTIONAL', 0.05, '{}'::jsonb, 'RETIRED', '7703d1f5-7297-47f7-ad72-23612138dc80'
    FROM perfecity.design_family_master LIMIT 1
    RETURNING template_id INTO v_retired_template_id;

    -- Set auth context to simulate consultant
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_consultant_id::text,
        'role', 'authenticated'
    )::text, true);
    PERFORM set_config('role', 'authenticated', true);

    BEGIN
        v_project_id := perfecity.create_project(
            v_retired_template_id,
            v_consultant_id,
            v_idempotency_key,
            '{"zones":[]}'::jsonb,
            'hash-retired-test',
            v_rule_set_id
        );
        RAISE EXCEPTION 'FAIL: T-P0-TMPL-004 - create_project should reject RETIRED template but returned %', v_project_id;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Template is not active or does not exist' THEN
                RAISE NOTICE 'PASS: T-P0-TMPL-004 - create_project correctly rejects RETIRED template';
            ELSE
                RAISE EXCEPTION 'FAIL: T-P0-TMPL-004 - unexpected error: %', SQLERRM;
            END IF;
    END;

    -- Cleanup
    DELETE FROM perfecity.template WHERE template_id = v_retired_template_id;
END;
$$;
