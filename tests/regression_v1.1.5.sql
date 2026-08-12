-- ============================================================================
-- PERFECCITY MVP v1.1.5 – Regression Test Harness
-- Target: PostgreSQL 16.4+, schema 'perfecity'
-- Run AFTER applying baseline_v1.1.5.sql
-- ============================================================================
SET search_path TO perfecity;

-- ============================================================================
-- T1-T4: Zone SKU 1:1 Invariant (v1.1.5 patch)
-- ============================================================================
DO $$
DECLARE
    v_fam_id UUID;
    v_cat_id UUID;
    v_sku1_id UUID;
    v_sku2_id UUID;
    v_design_fam_id UUID;
    v_design_subfam_id UUID;
    v_template_id UUID;
    v_zone_id UUID;
    v_alt_id UUID;
BEGIN
    -- Setup
    INSERT INTO family_master (family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Test Family v1.1.5', '00000000-0000-0000-0000-000000000001')
    RETURNING family_id INTO v_fam_id;

    INSERT INTO category_master (category_id, family_id, name, created_by)
    VALUES (gen_random_uuid(), v_fam_id, 'Test Category v1.1.5', '00000000-0000-0000-0000-000000000001')
    RETURNING category_id INTO v_cat_id;

    INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
        width_mm, height_mm, thickness_mm, depth_mm, status, created_by)
    VALUES ('TST-v1.1.5-WP-001', 'WALL_PANEL', v_fam_id, v_cat_id,
        600, 300, 18, 0, 'ACTIVE', '00000000-0000-0000-0000-000000000001')
    RETURNING sku_id INTO v_sku1_id;

    INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
        width_mm, height_mm, thickness_mm, depth_mm, status, created_by)
    VALUES ('TST-v1.1.5-WP-002', 'WALL_PANEL', v_fam_id, v_cat_id,
        800, 400, 18, 0, 'ACTIVE', '00000000-0000-0000-0000-000000000001')
    RETURNING sku_id INTO v_sku2_id;

    INSERT INTO catalogue_entry (sku_id, status) VALUES (v_sku1_id, 'READY');
    INSERT INTO catalogue_entry (sku_id, status) VALUES (v_sku2_id, 'READY');

    INSERT INTO design_family_master (design_family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Test Design Family v1.1.5', '00000000-0000-0000-0000-000000000001')
    RETURNING design_family_id INTO v_design_fam_id;

    INSERT INTO design_subfamily_master (design_subfamily_id, design_family_id, name, created_by)
    VALUES (gen_random_uuid(), v_design_fam_id, 'Test Design Subfamily v1.1.5', '00000000-0000-0000-0000-000000000001')
    RETURNING design_subfamily_id INTO v_design_subfam_id;

    INSERT INTO template (name, design_family_id, design_subfamily_id, wall_application, wall_geometry,
        adaptation_strategy, waste_factor, status, created_by)
    VALUES ('Test Template v1.1.5', v_design_fam_id, v_design_subfam_id, 'SINGLE',
        '{"type":"SINGLE"}'::jsonb, 'PROPORTIONAL', 0.05, 'DRAFT', '00000000-0000-0000-0000-000000000001')
    RETURNING template_id INTO v_template_id;

    INSERT INTO template_zone (template_id, x_mm, y_mm, width_mm, height_mm, width_strategy, height_strategy, position_strategy)
    VALUES (v_template_id, 0, 0, 600, 300, 'FIXED', 'FIXED', 'FIXED')
    RETURNING zone_id INTO v_zone_id;

    -- T1: One SKU can be assigned
    BEGIN
        INSERT INTO template_zone_sku (zone_id, sku_id, is_primary)
        VALUES (v_zone_id, v_sku1_id, true);
        RAISE NOTICE 'PASS: T1 - One SKU assigned to zone';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'FAIL: T1 - %', SQLERRM;
    END;

    -- T2: Second SKU on same zone rejected
    BEGIN
        INSERT INTO template_zone_sku (zone_id, sku_id, is_primary)
        VALUES (v_zone_id, v_sku2_id, false);
        RAISE EXCEPTION 'FAIL: T2 - Second SKU on zone accepted';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'PASS: T2 - Second SKU on zone rejected';
    END;

    -- T3: Duplicate same SKU rejected
    BEGIN
        INSERT INTO template_zone_sku (zone_id, sku_id, is_primary)
        VALUES (v_zone_id, v_sku1_id, false);
        RAISE EXCEPTION 'FAIL: T3 - Duplicate SKU on zone accepted';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'PASS: T3 - Duplicate SKU on zone rejected';
    END;

    -- T4: Alternative SKU via template_zone_alternative works
    BEGIN
        INSERT INTO template_zone_alternative (template_zone_id, alternative_sku_id, display_order, status)
        VALUES (v_zone_id, v_sku2_id, 1, 'ACTIVE')
        RETURNING alternative_id INTO v_alt_id;
        RAISE NOTICE 'PASS: T4 - Alternative SKU assigned';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'FAIL: T4 - %', SQLERRM;
    END;

    IF NOT EXISTS (SELECT 1 FROM template_zone_alternative WHERE alternative_id = v_alt_id) THEN
        RAISE EXCEPTION 'FAIL: T4 - Alternative not persisted';
    END IF;

    -- Cleanup T1-T4
    DELETE FROM template_zone_alternative WHERE alternative_id = v_alt_id;
    DELETE FROM template_zone_sku WHERE zone_id = v_zone_id;
    DELETE FROM template_zone WHERE zone_id = v_zone_id;
    DELETE FROM template WHERE template_id = v_template_id;
    DELETE FROM design_subfamily_master WHERE design_family_id = v_design_fam_id;
    DELETE FROM design_family_master WHERE design_family_id = v_design_fam_id;
    DELETE FROM catalogue_entry WHERE sku_id IN (v_sku1_id, v_sku2_id);
    DELETE FROM sku_master WHERE sku_id IN (v_sku1_id, v_sku2_id);
    DELETE FROM category_master WHERE family_id = v_fam_id;
    DELETE FROM family_master WHERE family_id = v_fam_id;
END;
$$;

-- ============================================================================
-- T5: v1.1.4 Template Lifecycle Tests
-- ============================================================================
DO $$
DECLARE
    v_fam_id UUID;
    v_cat_id UUID;
    v_sku_id UUID;
    v_design_fam_id UUID;
    v_design_subfam_id UUID;
    v_template_id UUID;
    v_zone_id UUID;
    v_rule_set_id UUID;
    v_status TEXT;
    v_mb_id UUID;
BEGIN
    SELECT rule_set_id INTO v_rule_set_id FROM rule_set WHERE rule_set_code = 'RS-2026-001';

    INSERT INTO family_master (family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Lifecycle Family', '00000000-0000-0000-0000-000000000001')
    RETURNING family_id INTO v_fam_id;

    INSERT INTO category_master (category_id, family_id, name, created_by)
    VALUES (gen_random_uuid(), v_fam_id, 'Lifecycle Category', '00000000-0000-0000-0000-000000000001')
    RETURNING category_id INTO v_cat_id;

    INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
        width_mm, height_mm, thickness_mm, depth_mm, status, created_by)
    VALUES ('LIFECYCLE-WP', 'WALL_PANEL', v_fam_id, v_cat_id,
        600, 300, 18, 0, 'ACTIVE', '00000000-0000-0000-0000-000000000001')
    RETURNING sku_id INTO v_sku_id;

    INSERT INTO catalogue_entry (sku_id, status) VALUES (v_sku_id, 'READY');

    INSERT INTO design_family_master (design_family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Lifecycle DF', '00000000-0000-0000-0000-000000000001')
    RETURNING design_family_id INTO v_design_fam_id;

    INSERT INTO design_subfamily_master (design_subfamily_id, design_family_id, name, created_by)
    VALUES (gen_random_uuid(), v_design_fam_id, 'Lifecycle DSF', '00000000-0000-0000-0000-000000000001')
    RETURNING design_subfamily_id INTO v_design_subfam_id;

    -- Create template in DRAFT
    INSERT INTO template (name, design_family_id, design_subfamily_id, wall_application, wall_geometry,
        adaptation_strategy, waste_factor, status, created_by)
    VALUES ('Lifecycle Template', v_design_fam_id, v_design_subfam_id, 'SINGLE',
        '{"type":"SINGLE"}'::jsonb, 'PROPORTIONAL', 0.05, 'DRAFT', '00000000-0000-0000-0000-000000000001')
    RETURNING template_id INTO v_template_id;

    -- Activation should fail (no zone, no master BOM)
    BEGIN
        UPDATE template SET status = 'ACTIVE' WHERE template_id = v_template_id;
        RAISE EXCEPTION 'FAIL: T5 - Template activated without zone/Master BOM';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE '%does not meet activation criteria%' THEN
            RAISE NOTICE 'PASS: T5 - Activation blocked without zone/Master BOM';
        ELSE
            RAISE;
        END IF;
    END;

    -- Add zone and zone SKU
    INSERT INTO template_zone (template_id, x_mm, y_mm, width_mm, height_mm, width_strategy, height_strategy, position_strategy)
    VALUES (v_template_id, 0, 0, 600, 300, 'FIXED', 'FIXED', 'FIXED')
    RETURNING zone_id INTO v_zone_id;

    INSERT INTO template_zone_sku (zone_id, sku_id, is_primary)
    VALUES (v_zone_id, v_sku_id, true);

    -- Create approved Master BOM
    INSERT INTO master_bom (template_id, status, engine_version, rule_set_id)
    VALUES (v_template_id, 'APPROVED', '1.0.0', v_rule_set_id)
    RETURNING master_bom_id INTO v_mb_id;

    -- Now activation should succeed
    UPDATE template SET status = 'ACTIVE' WHERE template_id = v_template_id;
    SELECT status INTO v_status FROM template WHERE template_id = v_template_id;
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'FAIL: T5 - Activation failed even with zone and approved Master BOM';
    END IF;
    RAISE NOTICE 'PASS: T5 - Template activation succeeded';

    -- Demotion on zone change
    UPDATE template_zone SET width_mm = 700 WHERE zone_id = v_zone_id;
    SELECT status INTO v_status FROM template WHERE template_id = v_template_id;
    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'FAIL: T5 - Template not demoted on zone change';
    END IF;
    RAISE NOTICE 'PASS: T5 - Template demoted on zone structural change';

    -- Cleanup T5
    DELETE FROM master_bom WHERE master_bom_id = v_mb_id;
    DELETE FROM template_zone_sku WHERE zone_id = v_zone_id;
    DELETE FROM template_zone WHERE zone_id = v_zone_id;
    DELETE FROM template WHERE template_id = v_template_id;
    DELETE FROM design_subfamily_master WHERE design_family_id = v_design_fam_id;
    DELETE FROM design_family_master WHERE design_family_id = v_design_fam_id;
    DELETE FROM catalogue_entry WHERE sku_id = v_sku_id;
    DELETE FROM sku_master WHERE sku_id = v_sku_id;
    DELETE FROM category_master WHERE family_id = v_fam_id;
    DELETE FROM family_master WHERE family_id = v_fam_id;
END;
$$;

-- ============================================================================
-- T6: P1-01 - LIGHT Dimension Constraint Tests
-- ============================================================================
DO $$
DECLARE
    v_fam_id UUID;
    v_cat_id UUID;
    v_sku_ids UUID[] := '{}';
    v_tmp_id UUID;
BEGIN
    INSERT INTO family_master (family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Test Family P1-01', '00000000-0000-0000-0000-000000000001')
    RETURNING family_id INTO v_fam_id;

    INSERT INTO category_master (category_id, family_id, name, created_by)
    VALUES (gen_random_uuid(), v_fam_id, 'Test Category P1-01', '00000000-0000-0000-0000-000000000001')
    RETURNING category_id INTO v_cat_id;

    -- Test 1: Valid WALL_PANEL
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            width_mm, height_mm, thickness_mm, depth_mm, created_by)
        VALUES ('TST-P1-01-WP-VALID', 'WALL_PANEL', v_fam_id, v_cat_id,
            600, 300, 18, 0, '00000000-0000-0000-0000-000000000001')
        RETURNING sku_id INTO v_tmp_id;
        v_sku_ids := v_sku_ids || v_tmp_id;
        RAISE NOTICE 'PASS: T6 - Valid WALL_PANEL inserted';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'FAIL: T6 - Valid WALL_PANEL rejected - %', SQLERRM;
    END;

    -- Test 2: Invalid WALL_PANEL (width NULL)
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            width_mm, height_mm, thickness_mm, depth_mm, created_by)
        VALUES ('TST-P1-01-WP-NOWIDTH', 'WALL_PANEL', v_fam_id, v_cat_id,
            NULL, 300, 18, 0, '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'FAIL: T6 - Invalid WALL_PANEL accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS: T6 - Invalid WALL_PANEL rejected';
    END;

    -- Test 3: Valid LIGHT (DISCRETE)
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            thickness_mm, depth_mm, quantity_mode, unit_length_mm, created_by)
        VALUES ('TST-P1-01-LT-DISCRETE', 'LIGHT', v_fam_id, v_cat_id,
            10, 0, 'DISCRETE', 1000, '00000000-0000-0000-0000-000000000001')
        RETURNING sku_id INTO v_tmp_id;
        v_sku_ids := v_sku_ids || v_tmp_id;
        RAISE NOTICE 'PASS: T6 - Valid LIGHT (DISCRETE) inserted';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'FAIL: T6 - Valid LIGHT (DISCRETE) rejected - %', SQLERRM;
    END;

    -- Test 4: Valid LIGHT (LINEAR)
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            thickness_mm, depth_mm, quantity_mode, created_by)
        VALUES ('TST-P1-01-LT-LINEAR', 'LIGHT', v_fam_id, v_cat_id,
            10, 0, 'LINEAR', '00000000-0000-0000-0000-000000000001')
        RETURNING sku_id INTO v_tmp_id;
        v_sku_ids := v_sku_ids || v_tmp_id;
        RAISE NOTICE 'PASS: T6 - Valid LIGHT (LINEAR) inserted';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'FAIL: T6 - Valid LIGHT (LINEAR) rejected - %', SQLERRM;
    END;

    -- Test 5: Invalid LIGHT (DISCRETE without unit_length_mm)
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            thickness_mm, depth_mm, quantity_mode, created_by)
        VALUES ('TST-P1-01-LT-NOUNIT', 'LIGHT', v_fam_id, v_cat_id,
            10, 0, 'DISCRETE', '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'FAIL: T6 - Invalid LIGHT accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS: T6 - Invalid LIGHT rejected';
    END;

    -- Test 6: Valid FURNITURE
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            width_mm, height_mm, depth_mm, thickness_mm, created_by)
        VALUES ('TST-P1-01-FN-VALID', 'FURNITURE', v_fam_id, v_cat_id,
            800, 400, 350, 0, '00000000-0000-0000-0000-000000000001')
        RETURNING sku_id INTO v_tmp_id;
        v_sku_ids := v_sku_ids || v_tmp_id;
        RAISE NOTICE 'PASS: T6 - Valid FURNITURE inserted';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'FAIL: T6 - Valid FURNITURE rejected - %', SQLERRM;
    END;

    -- Test 7: Invalid FURNITURE (depth=0)
    BEGIN
        INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
            width_mm, height_mm, depth_mm, thickness_mm, created_by)
        VALUES ('TST-P1-01-FN-NODEPTH', 'FURNITURE', v_fam_id, v_cat_id,
            800, 400, 0, 0, '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'FAIL: T6 - Invalid FURNITURE accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS: T6 - Invalid FURNITURE rejected';
    END;

    -- Cleanup T6
    DELETE FROM sku_master WHERE sku_id = ANY(v_sku_ids);
    DELETE FROM category_master WHERE family_id = v_fam_id;
    DELETE FROM family_master WHERE family_id = v_fam_id;
END;
$$;

-- ============================================================================
-- T7: P1-02 - Measurement Change -> Actual BOM Invalidation
-- ============================================================================
DO $$
DECLARE
    v_fam_id UUID;
    v_cat_id UUID;
    v_sku_id UUID;
    v_design_fam_id UUID;
    v_design_subfam_id UUID;
    v_template_id UUID;
    v_zone_id UUID;
    v_rule_set_id UUID;
    v_project_id UUID;
    v_snapshot_id UUID;
    v_config_id UUID;
    v_actual_bom_id UUID;
    v_measurement_id UUID;
    v_bom_count INTEGER;
    v_project_status TEXT;
    v_current_bom UUID;
    v_mb_id UUID;
BEGIN
    SELECT rule_set_id INTO v_rule_set_id FROM rule_set WHERE rule_set_code = 'RS-2026-001';

    INSERT INTO family_master (family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Test Family P1-02', '00000000-0000-0000-0000-000000000001')
    RETURNING family_id INTO v_fam_id;

    INSERT INTO category_master (category_id, family_id, name, created_by)
    VALUES (gen_random_uuid(), v_fam_id, 'Test Category P1-02', '00000000-0000-0000-0000-000000000001')
    RETURNING category_id INTO v_cat_id;

    INSERT INTO sku_master (sku_code, product_type, family_id, category_id,
        width_mm, height_mm, thickness_mm, depth_mm, status, created_by)
    VALUES ('TST-P1-02-WP-001', 'WALL_PANEL', v_fam_id, v_cat_id,
        600, 300, 18, 0, 'ACTIVE', '00000000-0000-0000-0000-000000000001')
    RETURNING sku_id INTO v_sku_id;

    INSERT INTO catalogue_entry (sku_id, status)
    VALUES (v_sku_id, 'READY');

    INSERT INTO design_family_master (design_family_id, name, created_by)
    VALUES (gen_random_uuid(), 'Test Design Family P1-02', '00000000-0000-0000-0000-000000000001')
    RETURNING design_family_id INTO v_design_fam_id;

    INSERT INTO design_subfamily_master (design_subfamily_id, design_family_id, name, created_by)
    VALUES (gen_random_uuid(), v_design_fam_id, 'Test Design Subfamily P1-02', '00000000-0000-0000-0000-000000000001')
    RETURNING design_subfamily_id INTO v_design_subfam_id;

    INSERT INTO template (name, design_family_id, design_subfamily_id, wall_application, wall_geometry,
        adaptation_strategy, waste_factor, status, created_by)
    VALUES ('Test Template P1-02', v_design_fam_id, v_design_subfam_id, 'SINGLE',
        '{"type":"SINGLE"}'::jsonb, 'PROPORTIONAL', 0.05, 'DRAFT', '00000000-0000-0000-0000-000000000001')
    RETURNING template_id INTO v_template_id;

    INSERT INTO template_zone (template_id, x_mm, y_mm, width_mm, height_mm, width_strategy, height_strategy, position_strategy)
    VALUES (v_template_id, 0, 0, 600, 300, 'FIXED', 'FIXED', 'FIXED')
    RETURNING zone_id INTO v_zone_id;

    INSERT INTO template_zone_sku (zone_id, sku_id, is_primary)
    VALUES (v_zone_id, v_sku_id, true);

    INSERT INTO master_bom (template_id, status, engine_version, rule_set_id)
    VALUES (v_template_id, 'APPROVED', '1.0.0', v_rule_set_id)
    RETURNING master_bom_id INTO v_mb_id;

    -- Activate template
    UPDATE template SET status = 'ACTIVE' WHERE template_id = v_template_id;

    INSERT INTO project (template_id, created_by, status)
    VALUES (v_template_id, '00000000-0000-0000-0000-000000000001', 'CONFIGURED')
    RETURNING project_id INTO v_project_id;

    INSERT INTO project_snapshot (project_id, template_id, snapshot_data, snapshot_hash, rule_set_id)
    VALUES (v_project_id, v_template_id, '{}'::jsonb, 'hash-p1-02-001', v_rule_set_id)
    RETURNING snapshot_id INTO v_snapshot_id;

    UPDATE project SET snapshot_id = v_snapshot_id WHERE project_id = v_project_id;

    INSERT INTO project_configuration (project_id, configuration_version, configuration_hash, updated_by, configuration_data)
    VALUES (v_project_id, 1, 'conf-hash-001', '00000000-0000-0000-0000-000000000001', '{}'::jsonb)
    RETURNING configuration_id INTO v_config_id;

    UPDATE project SET current_configuration_id = v_config_id WHERE project_id = v_project_id;

    INSERT INTO project_measurement (project_id, wall_width_mm, wall_height_mm, measured_by, measurement_source, measurement_status)
    VALUES (v_project_id, 3000, 2700, '00000000-0000-0000-0000-000000000001', 'MANUAL', 'CONFIRMED')
    RETURNING measurement_id INTO v_measurement_id;

    INSERT INTO actual_bom (project_id, snapshot_id, configuration_id, status, engine_version, rule_set_id, input_hash)
    VALUES (v_project_id, v_snapshot_id, v_config_id, 'VALIDATED', '1.0.0', v_rule_set_id, 'input-hash-001')
    RETURNING actual_bom_id INTO v_actual_bom_id;

    SELECT status, current_actual_bom_id INTO v_project_status, v_current_bom
    FROM project WHERE project_id = v_project_id;

    IF v_project_status <> 'VALIDATED' THEN
        RAISE EXCEPTION 'FAIL: T7 - Project should be VALIDATED, got %', v_project_status;
    END IF;

    -- Test 1: Update measurement -> BOM superseded
    UPDATE project_measurement
    SET wall_width_mm = 3200, wall_height_mm = 2700, measured_at = now()
    WHERE project_id = v_project_id;

    SELECT status INTO v_project_status FROM actual_bom WHERE actual_bom_id = v_actual_bom_id;
    IF v_project_status <> 'SUPERSEDED' THEN
        RAISE EXCEPTION 'FAIL: T7 - Actual BOM not superseded, status=%', v_project_status;
    END IF;
    RAISE NOTICE 'PASS: T7 - Actual BOM superseded';

    -- Test 2: Project current_actual_bom_id cleared
    SELECT current_actual_bom_id INTO v_current_bom FROM project WHERE project_id = v_project_id;
    IF v_current_bom IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: T7 - current_actual_bom_id not cleared';
    END IF;
    RAISE NOTICE 'PASS: T7 - current_actual_bom_id cleared';

    -- Test 3: Project status reset to CONFIGURED
    SELECT status INTO v_project_status FROM project WHERE project_id = v_project_id;
    IF v_project_status <> 'CONFIGURED' THEN
        RAISE EXCEPTION 'FAIL: T7 - Project status not CONFIGURED, got %', v_project_status;
    END IF;
    RAISE NOTICE 'PASS: T7 - Project status reset to CONFIGURED';

    -- Test 4: Second BOM also superseded on next measurement change
    INSERT INTO actual_bom (project_id, snapshot_id, configuration_id, status, engine_version, rule_set_id, input_hash)
    VALUES (v_project_id, v_snapshot_id, v_config_id, 'VALIDATED', '1.0.0', v_rule_set_id, 'input-hash-002')
    RETURNING actual_bom_id INTO v_actual_bom_id;

    UPDATE project_measurement
    SET wall_width_mm = 3500, measured_at = now()
    WHERE project_id = v_project_id;

    SELECT count(*) INTO v_bom_count FROM actual_bom
    WHERE project_id = v_project_id AND status = 'SUPERSEDED';
    IF v_bom_count < 2 THEN
        RAISE EXCEPTION 'FAIL: T7 - Second BOM not superseded, superseded count=%', v_bom_count;
    END IF;
    RAISE NOTICE 'PASS: T7 - Second BOM also superseded';

    -- Test 5: Idempotency of measurement updates
    UPDATE project_measurement SET wall_width_mm = 3600, measured_at = now() WHERE project_id = v_project_id;
    UPDATE project_measurement SET wall_width_mm = 3600, measured_at = now() WHERE project_id = v_project_id;

    SELECT status INTO v_project_status FROM project WHERE project_id = v_project_id;
    IF v_project_status <> 'CONFIGURED' THEN
        RAISE EXCEPTION 'FAIL: T7 - Idempotency broken, project status=%', v_project_status;
    END IF;
    SELECT current_actual_bom_id INTO v_current_bom FROM project WHERE project_id = v_project_id;
    IF v_current_bom IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: T7 - Idempotency broken, current_actual_bom_id not null';
    END IF;
    RAISE NOTICE 'PASS: T7 - Idempotent measurement updates confirmed';

    -- Cleanup T7
    DELETE FROM actual_bom WHERE project_id = v_project_id;
    DELETE FROM project_measurement WHERE project_id = v_project_id;
    DELETE FROM project_configuration WHERE project_id = v_project_id;
    DELETE FROM project_idempotency WHERE project_id = v_project_id;
    -- Must clear FKs before deleting snapshot
    UPDATE project SET snapshot_id = NULL, current_configuration_id = NULL, current_actual_bom_id = NULL WHERE project_id = v_project_id;
    DELETE FROM project_snapshot WHERE project_id = v_project_id;
    DELETE FROM project WHERE project_id = v_project_id;
    DELETE FROM master_bom WHERE master_bom_id = v_mb_id;
    DELETE FROM template_zone_sku WHERE zone_id = v_zone_id;
    DELETE FROM template_zone WHERE zone_id = v_zone_id;
    DELETE FROM template WHERE template_id = v_template_id;
    DELETE FROM design_subfamily_master WHERE design_family_id = v_design_fam_id;
    DELETE FROM design_family_master WHERE design_family_id = v_design_fam_id;
    DELETE FROM catalogue_entry WHERE sku_id = v_sku_id;
    DELETE FROM sku_master WHERE sku_id = v_sku_id;
    DELETE FROM category_master WHERE family_id = v_fam_id;
    DELETE FROM family_master WHERE family_id = v_fam_id;
END;
$$;

-- ============================================================================
-- Final summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'v1.1.5 Regression Test Harness COMPLETE.';
    RAISE NOTICE 'If no exceptions were raised, all tests (T1-T7) PASSED.';
    RAISE NOTICE 'v1.1.5 may be declared Execution-Verified.';
    RAISE NOTICE '=================================================================';
END;
$$;
