-- Migration v1.2.1: generate_master_bom RPC
-- Purpose: Server-side Master BOM generation that resolves rule_set_id server-side,
-- enforces auth/role/ownership/status checks, and populates master_bom + master_bom_line.
-- Also strengthens check_template_eligible to require master_bom_line coverage.

SET search_path = 'perfecity';

-- =============================================================================
-- 1. generate_master_bom FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION perfecity.generate_master_bom(
    p_template_id UUID,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_template       RECORD;
    v_role           TEXT;
    v_rule_set_id    UUID;
    v_master_bom_id  UUID;
    v_zone           RECORD;
    v_lighting       RECORD;
    v_furniture      RECORD;
    v_trim           RECORD;
    v_hidden         RECORD;
    v_parent_line_id UUID;
BEGIN
    -- =========================================================================
    -- Step 1: Identity & role check
    -- =========================================================================
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller identity mismatch';
    END IF;

    v_role := perfecity.current_user_role();
    IF v_role NOT IN ('DESIGNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Authorization failed: only DESIGNER or ADMIN can generate master BOM';
    END IF;

    -- =========================================================================
    -- Step 2: Template ownership + status check
    -- =========================================================================
    SELECT template_id, created_by, status
      INTO v_template
      FROM perfecity.template
     WHERE template_id = p_template_id
       FOR UPDATE;

    IF v_template IS NULL THEN
        RAISE EXCEPTION 'Template does not exist: %', p_template_id;
    END IF;

    -- ADMIN can generate for any template; DESIGNER must own it
    IF v_role = 'DESIGNER' AND v_template.created_by IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller does not own this template';
    END IF;

    IF v_template.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Template must be in DRAFT status to generate master BOM (current: %)', v_template.status;
    END IF;

    -- =========================================================================
    -- Step 3: Resolve ACTIVE rule_set server-side
    -- =========================================================================
    SELECT rs.rule_set_id INTO v_rule_set_id
      FROM perfecity.rule_set rs
     WHERE rs.status = 'ACTIVE'
     LIMIT 1;

    IF v_rule_set_id IS NULL THEN
        RAISE EXCEPTION 'No ACTIVE rule_set found; cannot generate master BOM';
    END IF;

    -- =========================================================================
    -- Step 4: Supersede previous APPROVED master_bom for this template
    -- =========================================================================
    UPDATE perfecity.master_bom
       SET status = 'INVALIDATED'
     WHERE template_id = p_template_id
       AND status = 'APPROVED';

    -- =========================================================================
    -- Step 5: INSERT master_bom header
    -- =========================================================================
    INSERT INTO perfecity.master_bom (
        template_id, status, generated_at, engine_version,
        rule_set_id, approved_by, approved_at
    ) VALUES (
        p_template_id, 'APPROVED', now(), '1.0',
        v_rule_set_id, p_user_id, now()
    )
    RETURNING master_bom_id INTO v_master_bom_id;

    -- =========================================================================
    -- Step 6: INSERT master_bom_line for each zone (primary SKU)
    -- =========================================================================
    FOR v_zone IN
        SELECT tz.zone_id, tzs.sku_id, sm.product_type
          FROM perfecity.template_zone tz
          JOIN perfecity.template_zone_sku tzs ON tzs.zone_id = tz.zone_id AND tzs.is_primary
          JOIN perfecity.sku_master sm ON sm.sku_id = tzs.sku_id
         WHERE tz.template_id = p_template_id
    LOOP
        INSERT INTO perfecity.master_bom_line (
            master_bom_id, template_component_id, sku_id, product_type,
            source_zone_id, quantity_rule, default_quantity,
            unit_of_measure, mandatory, hidden, calculation_parameters
        ) VALUES (
            v_master_bom_id, v_zone.zone_id, v_zone.sku_id, v_zone.product_type,
            v_zone.zone_id, 'CALCULATED', 1,
            'PIECE', true, false, '{}'::jsonb
        );
    END LOOP;

    -- =========================================================================
    -- Step 7: INSERT master_bom_line for each lighting component
    -- =========================================================================
    FOR v_lighting IN
        SELECT tl.lighting_id, tl.sku_id, sm.product_type,
               COALESCE(tl.quantity_rule, 'FIXED') AS quantity_rule
          FROM perfecity.template_lighting tl
          JOIN perfecity.sku_master sm ON sm.sku_id = tl.sku_id
         WHERE tl.template_id = p_template_id
    LOOP
        INSERT INTO perfecity.master_bom_line (
            master_bom_id, template_component_id, sku_id, product_type,
            quantity_rule, default_quantity,
            unit_of_measure, mandatory, hidden, calculation_parameters
        ) VALUES (
            v_master_bom_id, v_lighting.lighting_id, v_lighting.sku_id, v_lighting.product_type,
            v_lighting.quantity_rule, 1,
            'PIECE', true, false, '{}'::jsonb
        );
    END LOOP;

    -- =========================================================================
    -- Step 8: INSERT master_bom_line for each furniture component
    -- =========================================================================
    FOR v_furniture IN
        SELECT tf.furniture_id, tf.sku_id, sm.product_type
          FROM perfecity.template_furniture tf
          JOIN perfecity.sku_master sm ON sm.sku_id = tf.sku_id
         WHERE tf.template_id = p_template_id
    LOOP
        INSERT INTO perfecity.master_bom_line (
            master_bom_id, template_component_id, sku_id, product_type,
            quantity_rule, default_quantity,
            unit_of_measure, mandatory, hidden, calculation_parameters
        ) VALUES (
            v_master_bom_id, v_furniture.furniture_id, v_furniture.sku_id, v_furniture.product_type,
            'FIXED', 1,
            'PIECE', true, false, '{}'::jsonb
        );
    END LOOP;

    -- =========================================================================
    -- Step 9: INSERT master_bom_line for each trim component (non-null sku_id)
    -- =========================================================================
    FOR v_trim IN
        SELECT tt.trim_id, tt.sku_id, sm.product_type, tt.quantity_rule,
               tt.fixed_quantity
          FROM perfecity.template_trim tt
          JOIN perfecity.sku_master sm ON sm.sku_id = tt.sku_id
         WHERE tt.template_id = p_template_id
           AND tt.sku_id IS NOT NULL
    LOOP
        INSERT INTO perfecity.master_bom_line (
            master_bom_id, template_component_id, sku_id, product_type,
            quantity_rule, default_quantity,
            unit_of_measure, mandatory, hidden, calculation_parameters
        ) VALUES (
            v_master_bom_id, v_trim.trim_id, v_trim.sku_id, v_trim.product_type,
            v_trim.quantity_rule, COALESCE(v_trim.fixed_quantity, 1),
            'PIECE', true, false, '{}'::jsonb
        );
    END LOOP;

    -- =========================================================================
    -- Step 10: INSERT master_bom_line for mandatory hidden components
    -- =========================================================================
    FOR v_hidden IN
        SELECT thc.hidden_component_id, thc.sku_id, sm.product_type,
               thc.quantity_rule, thc.quantity_parameters,
               thc.parent_component_id, thc.mandatory
          FROM perfecity.template_hidden_component thc
          JOIN perfecity.sku_master sm ON sm.sku_id = thc.sku_id
         WHERE thc.template_id = p_template_id
           AND thc.mandatory = true
    LOOP
        -- Resolve parent_bom_line_id for DERIVED_FROM_PARENT components
        v_parent_line_id := NULL;
        IF v_hidden.quantity_rule = 'DERIVED_FROM_PARENT' AND v_hidden.parent_component_id IS NOT NULL THEN
            SELECT mbl.master_bom_line_id INTO v_parent_line_id
              FROM perfecity.master_bom_line mbl
             WHERE mbl.master_bom_id = v_master_bom_id
               AND mbl.template_component_id = v_hidden.parent_component_id
             LIMIT 1;
        END IF;

        INSERT INTO perfecity.master_bom_line (
            master_bom_id, template_component_id, sku_id, product_type,
            quantity_rule, default_quantity,
            unit_of_measure, mandatory, hidden,
            calculation_parameters, parent_bom_line_id
        ) VALUES (
            v_master_bom_id, v_hidden.hidden_component_id, v_hidden.sku_id, v_hidden.product_type,
            v_hidden.quantity_rule, 1,
            'PIECE', true, true,
            COALESCE(v_hidden.quantity_parameters, '{}'::jsonb), v_parent_line_id
        );
    END LOOP;

    -- =========================================================================
    -- Step 11: Audit event
    -- =========================================================================
    INSERT INTO perfecity.audit_event (
        actor_id, actor_role, event_type, entity_type,
        entity_id, after_state
    ) VALUES (
        p_user_id, v_role, 'MASTER_BOM_GENERATED', 'master_bom',
        v_master_bom_id,
        jsonb_build_object(
            'template_id', p_template_id,
            'engine_version', '1.0',
            'rule_set_id', v_rule_set_id,
            'line_count', (SELECT count(*) FROM perfecity.master_bom_line WHERE master_bom_id = v_master_bom_id)
        )
    );

    RETURN v_master_bom_id;
END;
$$;

-- =============================================================================
-- 2. GRANTS
-- =============================================================================

REVOKE ALL ON FUNCTION perfecity.generate_master_bom(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.generate_master_bom(UUID, UUID) TO authenticated;

-- =============================================================================
-- 3. STRENGTHEN check_template_eligible
-- =============================================================================
-- Add coverage check: the APPROVED master_bom must have >= 1 master_bom_line
-- and must cover every zone/lighting/furniture/trim/mandatory-hidden-component.

CREATE OR REPLACE FUNCTION perfecity.check_template_eligible(tmpl_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    ineligible_skus integer;
    v_master_bom_id UUID;
    v_bom_line_count integer;
    v_missing_components integer;
BEGIN
    -- Gate 1: All zone primary SKUs are ACTIVE with catalogue READY
    SELECT count(*) INTO ineligible_skus
    FROM template_zone tz
    JOIN template_zone_sku tzs ON tzs.zone_id = tz.zone_id AND tzs.is_primary
    LEFT JOIN sku_master s ON s.sku_id = tzs.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tz.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    -- Gate 2: All zone alternatives are ACTIVE with catalogue READY
    SELECT count(*) INTO ineligible_skus
    FROM template_zone tz
    JOIN template_zone_alternative tza ON tza.template_zone_id = tz.zone_id
    LEFT JOIN sku_master s ON s.sku_id = tza.alternative_sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tz.template_id = tmpl_id AND tza.status = 'ACTIVE'
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    -- Gate 3: All lighting SKUs are ACTIVE with catalogue READY
    SELECT count(*) INTO ineligible_skus
    FROM template_lighting tl
    LEFT JOIN sku_master s ON s.sku_id = tl.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tl.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    -- Gate 4: All furniture SKUs are ACTIVE with catalogue READY
    SELECT count(*) INTO ineligible_skus
    FROM template_furniture tf
    LEFT JOIN sku_master s ON s.sku_id = tf.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tf.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    -- Gate 5: All trim SKUs (non-null) are ACTIVE with catalogue READY
    SELECT count(*) INTO ineligible_skus
    FROM template_trim tt
    LEFT JOIN sku_master s ON s.sku_id = tt.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tt.template_id = tmpl_id AND tt.sku_id IS NOT NULL
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    -- Gate 6: All mandatory hidden component SKUs are ACTIVE with catalogue READY
    SELECT count(*) INTO ineligible_skus
    FROM template_hidden_component thc
    LEFT JOIN sku_master s ON s.sku_id = thc.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE thc.template_id = tmpl_id AND thc.mandatory
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    -- Gate 7: An APPROVED master_bom must exist
    SELECT master_bom_id INTO v_master_bom_id
      FROM master_bom
     WHERE template_id = tmpl_id AND status = 'APPROVED';
    IF v_master_bom_id IS NULL THEN
        RETURN false;
    END IF;

    -- Gate 8: The APPROVED master_bom must have >= 1 master_bom_line
    SELECT count(*) INTO v_bom_line_count
      FROM master_bom_line
     WHERE master_bom_id = v_master_bom_id;
    IF v_bom_line_count < 1 THEN
        RETURN false;
    END IF;

    -- Gate 9: The master_bom must cover every zone component
    SELECT count(*) INTO v_missing_components
      FROM template_zone tz
      JOIN template_zone_sku tzs ON tzs.zone_id = tz.zone_id AND tzs.is_primary
     WHERE tz.template_id = tmpl_id
       AND NOT EXISTS (
           SELECT 1 FROM master_bom_line mbl
            WHERE mbl.master_bom_id = v_master_bom_id
              AND mbl.template_component_id = tz.zone_id
       );
    IF v_missing_components > 0 THEN RETURN false; END IF;

    -- Gate 10: The master_bom must cover every lighting component
    SELECT count(*) INTO v_missing_components
      FROM template_lighting tl
     WHERE tl.template_id = tmpl_id
       AND NOT EXISTS (
           SELECT 1 FROM master_bom_line mbl
            WHERE mbl.master_bom_id = v_master_bom_id
              AND mbl.template_component_id = tl.lighting_id
       );
    IF v_missing_components > 0 THEN RETURN false; END IF;

    -- Gate 11: The master_bom must cover every furniture component
    SELECT count(*) INTO v_missing_components
      FROM template_furniture tf
     WHERE tf.template_id = tmpl_id
       AND NOT EXISTS (
           SELECT 1 FROM master_bom_line mbl
            WHERE mbl.master_bom_id = v_master_bom_id
              AND mbl.template_component_id = tf.furniture_id
       );
    IF v_missing_components > 0 THEN RETURN false; END IF;

    -- Gate 12: The master_bom must cover every trim component (non-null sku)
    SELECT count(*) INTO v_missing_components
      FROM template_trim tt
     WHERE tt.template_id = tmpl_id
       AND tt.sku_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM master_bom_line mbl
            WHERE mbl.master_bom_id = v_master_bom_id
              AND mbl.template_component_id = tt.trim_id
       );
    IF v_missing_components > 0 THEN RETURN false; END IF;

    -- Gate 13: The master_bom must cover every mandatory hidden component
    SELECT count(*) INTO v_missing_components
      FROM template_hidden_component thc
     WHERE thc.template_id = tmpl_id
       AND thc.mandatory = true
       AND NOT EXISTS (
           SELECT 1 FROM master_bom_line mbl
            WHERE mbl.master_bom_id = v_master_bom_id
              AND mbl.template_component_id = thc.hidden_component_id
       );
    IF v_missing_components > 0 THEN RETURN false; END IF;

    RETURN true;
END;
$$;
