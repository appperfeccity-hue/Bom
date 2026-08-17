-- ============================================================================
-- PERFECCITY P0 TEST SUITE - Server-side snapshot (migration v1.1.8)
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Purpose: Prove that create_project() freezes the execution baseline itself:
--          the client supplies no snapshot, no hash and no rule set, the
--          snapshot carries everything the BOM pipeline needs, and later
--          template edits cannot reach an existing project.
-- Run AFTER baseline_v1.1.5.sql and all migrations up to v1.1.8.
--
-- auth.uid() / auth.jwt() must be resolvable; on a plain PostgreSQL instance
-- stub them so that they read current_setting('test.uid') / ('test.role').
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T-P0-SSS-001: the client-snapshot form of create_project() is withdrawn
-- ============================================================================
DO $$
DECLARE
    v_signatures TEXT[];
BEGIN
    SELECT array_agg(pg_get_function_identity_arguments(p.oid))
      INTO v_signatures
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'perfecity' AND p.proname = 'create_project';

    IF array_length(v_signatures, 1) <> 1 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-001 - expected exactly one create_project overload, found %', v_signatures;
    END IF;
    IF v_signatures[1] LIKE '%jsonb%' THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-001 - client-snapshot overload still callable: %', v_signatures[1];
    END IF;
    RAISE NOTICE 'PASS: T-P0-SSS-001 - only the server-snapshot create_project remains';
END;
$$;

-- ============================================================================
-- T-P0-SSS-002: build_template_snapshot is not callable by API roles
-- ============================================================================
DO $$
BEGIN
    IF has_function_privilege('authenticated', 'perfecity.build_template_snapshot(uuid,uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'perfecity.build_template_snapshot(uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-002 - build_template_snapshot is directly callable from the API';
    END IF;
    IF NOT has_function_privilege('authenticated', 'perfecity.create_project(uuid,uuid,text,text,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-002 - authenticated cannot execute create_project';
    END IF;
    RAISE NOTICE 'PASS: T-P0-SSS-002 - snapshot construction is reachable only through create_project';
END;
$$;

-- ============================================================================
-- Fixture: an eligible ACTIVE template owned by a designer, with a primary
-- SKU, an alternative, a consultant permission and an APPROVED master BOM.
-- ============================================================================
DO $$
DECLARE
    v_designer  UUID := '00000000-0000-0000-0000-0000000000d1';
    v_consultant UUID := '00000000-0000-0000-0000-0000000000c1';
    v_fam UUID; v_cat UUID; v_dfam UUID; v_dsub UUID;
    v_sku UUID; v_alt_sku UUID; v_template UUID; v_zone UUID;
    v_rule_set UUID;
BEGIN
    INSERT INTO family_master (name, created_by) VALUES ('SSS Family', v_designer) RETURNING family_id INTO v_fam;
    INSERT INTO category_master (family_id, name, created_by) VALUES (v_fam, 'SSS Category', v_designer) RETURNING category_id INTO v_cat;
    INSERT INTO design_family_master (name, created_by) VALUES ('SSS Design Family', v_designer) RETURNING design_family_id INTO v_dfam;
    INSERT INTO design_subfamily_master (design_family_id, name, created_by) VALUES (v_dfam, 'SSS Design Subfamily', v_designer) RETURNING design_subfamily_id INTO v_dsub;

    INSERT INTO sku_master (sku_code, product_type, family_id, category_id, width_mm, height_mm, thickness_mm, depth_mm, gh_mm, gv_mm, created_by)
    VALUES ('SSS-PRIMARY', 'WALL_PANEL', v_fam, v_cat, 600, 2400, 18, 0, 2, 2, v_designer) RETURNING sku_id INTO v_sku;
    INSERT INTO sku_master (sku_code, product_type, family_id, category_id, width_mm, height_mm, thickness_mm, depth_mm, gh_mm, gv_mm, created_by)
    VALUES ('SSS-ALTERNATIVE', 'WALL_PANEL', v_fam, v_cat, 600, 2400, 18, 0, 2, 2, v_designer) RETURNING sku_id INTO v_alt_sku;

    INSERT INTO catalogue_entry (sku_id, status) VALUES (v_sku, 'READY'), (v_alt_sku, 'READY');
    INSERT INTO sku_compatibility (source_sku_id, target_sku_id, relationship_type, directionality)
    VALUES (v_sku, v_alt_sku, 'ALTERNATIVE_TO', 'BIDIRECTIONAL');

    INSERT INTO template (name, design_family_id, design_subfamily_id, wall_application, wall_geometry,
                          adaptation_strategy, waste_factor, status, created_by)
    VALUES ('SSS Template', v_dfam, v_dsub, 'FEATURE_WALL',
            '{"type":"STRAIGHT","base_width_mm":2400,"base_height_mm":2400}'::jsonb,
            'PROPORTIONAL', 0.05, 'DRAFT', v_designer)
    RETURNING template_id INTO v_template;

    INSERT INTO template_zone (template_id, x_mm, y_mm, width_mm, height_mm, width_strategy, height_strategy, position_strategy)
    VALUES (v_template, 0, 0, 600, 2400, 'PROPORTIONAL', 'DERIVED_FROM_WALL', 'FIXED')
    RETURNING zone_id INTO v_zone;

    INSERT INTO template_zone_sku (zone_id, sku_id, is_primary) VALUES (v_zone, v_sku, true);
    INSERT INTO template_zone_alternative (template_zone_id, alternative_sku_id, display_order, status)
    VALUES (v_zone, v_alt_sku, 1, 'ACTIVE');
    INSERT INTO template_consultant_permission (template_id, parameter_key, parameter_type, edit_mode, min_value, max_value)
    VALUES (v_template, 'ZONE_WIDTH', 'DIMENSION', 'RESTRICTED', 400, 900);

    SELECT rule_set_id INTO v_rule_set FROM rule_set WHERE status = 'ACTIVE';
    INSERT INTO master_bom (template_id, rule_set_id, status, engine_version)
    VALUES (v_template, v_rule_set, 'APPROVED', '1.0.0');

    UPDATE template SET status = 'ACTIVE' WHERE template_id = v_template;

    PERFORM set_config('test.template_id', v_template::text, false);
    PERFORM set_config('test.zone_id', v_zone::text, false);
    PERFORM set_config('test.sku_id', v_sku::text, false);
    PERFORM set_config('test.alt_sku_id', v_alt_sku::text, false);
    PERFORM set_config('test.consultant', v_consultant::text, false);
END;
$$;

-- ============================================================================
-- T-P0-SSS-003: create_project() builds a complete v2 snapshot from 3 arguments
-- ============================================================================
DO $$
DECLARE
    v_project UUID;
    v_snapshot JSONB;
    v_hash TEXT;
    v_rule_set UUID;
BEGIN
    PERFORM set_config('test.uid', current_setting('test.consultant'), false);
    PERFORM set_config('test.role', 'CONSULTANT', false);

    v_project := perfecity.create_project(
        current_setting('test.template_id')::uuid,
        current_setting('test.consultant')::uuid,
        'sss-key-1', 'CUST-1', 'SITE-1');
    PERFORM set_config('test.project_id', v_project::text, false);

    SELECT ps.snapshot_data, ps.snapshot_hash, ps.rule_set_id
      INTO v_snapshot, v_hash, v_rule_set
      FROM project_snapshot ps WHERE ps.project_id = v_project;

    IF v_snapshot IS NULL THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - no snapshot was created';
    END IF;
    IF (v_snapshot ->> 'snapshot_version')::int <> 2 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - snapshot_version is %', v_snapshot ->> 'snapshot_version';
    END IF;
    IF v_rule_set <> (SELECT rule_set_id FROM rule_set WHERE status = 'ACTIVE') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - rule set was not resolved server-side';
    END IF;
    IF v_hash <> perfecity.snapshot_hash(v_snapshot) THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - stored hash does not match canonical hash of the snapshot';
    END IF;
    IF jsonb_array_length(v_snapshot -> 'zones') <> 1
       OR (v_snapshot -> 'zones' -> 0 -> 'primary_sku' ->> 'sku_id') <> current_setting('test.sku_id') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - zone primary SKU is not frozen in the snapshot';
    END IF;
    IF jsonb_array_length(v_snapshot -> 'zones' -> 0 -> 'alternatives') <> 1
       OR (v_snapshot -> 'zones' -> 0 -> 'alternatives' -> 0 -> 'sku' ->> 'sku_id') <> current_setting('test.alt_sku_id') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - zone alternatives are missing from the snapshot';
    END IF;
    IF jsonb_array_length(v_snapshot -> 'consultant_permissions') <> 1 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - consultant permissions are missing from the snapshot';
    END IF;
    IF jsonb_array_length(v_snapshot -> 'sku_compatibility') <> 1 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - sku compatibility is missing from the snapshot';
    END IF;
    IF (v_snapshot -> 'rule_set' -> 'constants') = '{}'::jsonb THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - rule set constants are missing from the snapshot';
    END IF;
    IF (v_snapshot -> 'base_dimensions' ->> 'width_mm')::numeric <> 2400 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - base dimensions are wrong';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM project WHERE project_id = v_project AND snapshot_id IS NOT NULL AND status = 'DRAFT'
                     AND customer_reference = 'CUST-1' AND site_reference = 'SITE-1') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - project row was not linked to its snapshot';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM audit_event WHERE project_id = v_project AND event_type = 'PROJECT_CREATED') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-003 - no audit event was recorded';
    END IF;
    RAISE NOTICE 'PASS: T-P0-SSS-003 - server-built v2 snapshot is complete and self-consistent';
END;
$$;

-- ============================================================================
-- T-P0-SSS-004: repeating an idempotency key returns the same project
-- ============================================================================
DO $$
DECLARE
    v_again UUID;
    v_projects INTEGER;
BEGIN
    v_again := perfecity.create_project(
        current_setting('test.template_id')::uuid,
        current_setting('test.consultant')::uuid,
        'sss-key-1', 'CUST-1', 'SITE-1');

    IF v_again::text <> current_setting('test.project_id') THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-004 - repeated key created a different project';
    END IF;
    SELECT count(*) INTO v_projects FROM project_snapshot WHERE project_id = v_again;
    IF v_projects <> 1 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-004 - repeated key produced % snapshots', v_projects;
    END IF;
    RAISE NOTICE 'PASS: T-P0-SSS-004 - idempotency short-circuits before snapshot construction';
END;
$$;

-- ============================================================================
-- T-P0-SSS-005: a template edit after creation cannot reach the project
-- ============================================================================
DO $$
DECLARE
    v_before TEXT;
    v_after TEXT;
    v_zone_width INTEGER;
BEGIN
    SELECT snapshot_hash INTO v_before FROM project_snapshot WHERE project_id = current_setting('test.project_id')::uuid;

    UPDATE template_zone SET width_mm = 900 WHERE zone_id = current_setting('test.zone_id')::uuid;

    SELECT snapshot_hash,
           (snapshot_data -> 'zones' -> 0 ->> 'width_mm')::int
      INTO v_after, v_zone_width
      FROM project_snapshot WHERE project_id = current_setting('test.project_id')::uuid;

    IF v_after <> v_before OR v_zone_width <> 600 THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-005 - snapshot followed a live template change (width %)', v_zone_width;
    END IF;
    RAISE NOTICE 'PASS: T-P0-SSS-005 - the snapshot boundary holds against later template edits';
END;
$$;

-- ============================================================================
-- T-P0-SSS-006: authorization gates still reject non-consultants
-- ============================================================================
DO $$
DECLARE
    v_raised BOOLEAN := false;
BEGIN
    PERFORM set_config('test.role', 'DESIGNER', false);
    BEGIN
        PERFORM perfecity.create_project(
            current_setting('test.template_id')::uuid,
            current_setting('test.consultant')::uuid,
            'sss-key-2', NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
        v_raised := true;
    END;
    PERFORM set_config('test.role', 'CONSULTANT', false);

    IF NOT v_raised THEN
        RAISE EXCEPTION 'FAIL: T-P0-SSS-006 - a DESIGNER was allowed to create a project';
    END IF;
    RAISE NOTICE 'PASS: T-P0-SSS-006 - non-CONSULTANT callers are rejected';
END;
$$;
