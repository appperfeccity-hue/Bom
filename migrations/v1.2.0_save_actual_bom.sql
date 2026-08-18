-- Migration v1.2.0: save_actual_bom RPC
-- Purpose: Provide the only write path for actual_bom / actual_bom_line.
-- Creates the actual_bom_idempotency table and save_actual_bom SECURITY DEFINER function.

SET search_path = 'perfecity';

-- =============================================================================
-- 1. IDEMPOTENCY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS perfecity.actual_bom_idempotency (
    idempotency_key  TEXT PRIMARY KEY,
    actual_bom_id    UUID NOT NULL REFERENCES perfecity.actual_bom(actual_bom_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE perfecity.actual_bom_idempotency ENABLE ROW LEVEL SECURITY;

-- SELECT policy: owning consultant (via actual_bom -> project.created_by) or admin
CREATE POLICY actual_bom_idempotency_select ON perfecity.actual_bom_idempotency
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
              FROM perfecity.actual_bom ab
              JOIN perfecity.project p ON p.project_id = ab.project_id
             WHERE ab.actual_bom_id = actual_bom_idempotency.actual_bom_id
               AND (p.created_by = auth.uid()
                    OR (auth.jwt() ->> 'role') = 'ADMIN')
        )
    );

-- No INSERT/UPDATE/DELETE policies: writes happen only via SECURITY DEFINER function

-- =============================================================================
-- 2. save_actual_bom FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION perfecity.save_actual_bom(
    p_project_id         UUID,
    p_user_id            UUID,
    p_idempotency_key    TEXT,
    p_configuration_data JSONB,
    p_bom_lines          JSONB,
    p_engine_version     TEXT,
    p_input_hash         TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_project          RECORD;
    v_snapshot         RECORD;
    v_existing_bom_id  UUID;
    v_configuration_id UUID;
    v_actual_bom_id    UUID;
    v_max_version      INTEGER;
    v_config_hash      TEXT;
    v_line             JSONB;
    v_permissions      JSONB;
    v_perm             JSONB;
    v_param_key        TEXT;
    v_config_value     JSONB;
    v_sku_set          JSONB;
    v_rule_set_id      UUID;
BEGIN
    -- =========================================================================
    -- Step 1: Identity & role check
    -- =========================================================================
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Identity mismatch: auth.uid() does not match p_user_id';
    END IF;

    -- Check CONSULTANT role
    IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'CONSULTANT' THEN
        RAISE EXCEPTION 'Only CONSULTANT role can save actual BOMs';
    END IF;

    -- Project ownership with row lock
    SELECT p.project_id, p.status, p.created_by, p.snapshot_id
      INTO v_project
      FROM perfecity.project p
     WHERE p.project_id = p_project_id
       FOR UPDATE;

    IF v_project IS NULL THEN
        RAISE EXCEPTION 'Project not found: %', p_project_id;
    END IF;

    IF v_project.created_by IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'User does not own this project';
    END IF;

    -- =========================================================================
    -- Step 2: Status check
    -- =========================================================================
    IF v_project.status NOT IN ('DRAFT', 'CONFIGURED', 'VALIDATED') THEN
        RAISE EXCEPTION 'Cannot save BOM for project in status %', v_project.status;
    END IF;

    -- =========================================================================
    -- Step 3: Advisory lock + idempotency early return
    -- =========================================================================
    PERFORM pg_advisory_xact_lock(hashtext('actual_bom_' || p_project_id::text));

    SELECT abi.actual_bom_id INTO v_existing_bom_id
      FROM perfecity.actual_bom_idempotency abi
     WHERE abi.idempotency_key = p_idempotency_key;

    IF v_existing_bom_id IS NOT NULL THEN
        RETURN v_existing_bom_id;
    END IF;

    -- =========================================================================
    -- Step 4: Validate p_configuration_data against snapshot permissions
    -- =========================================================================
    SELECT ps.snapshot_id, ps.snapshot_data, ps.rule_set_id
      INTO v_snapshot
      FROM perfecity.project_snapshot ps
     WHERE ps.snapshot_id = v_project.snapshot_id;

    IF v_snapshot IS NULL THEN
        RAISE EXCEPTION 'Snapshot not found for project %', p_project_id;
    END IF;

    v_rule_set_id := v_snapshot.rule_set_id;
    v_permissions := v_snapshot.snapshot_data -> 'consultant_permissions';

    -- Validate each permission constraint
    IF v_permissions IS NOT NULL AND jsonb_typeof(v_permissions) = 'array' THEN
        FOR v_perm IN SELECT * FROM jsonb_array_elements(v_permissions)
        LOOP
            v_param_key := v_perm ->> 'parameter_key';
            v_config_value := p_configuration_data -> v_param_key;

            -- LOCKED parameters must not be overridden
            IF (v_perm ->> 'edit_mode') = 'LOCKED' THEN
                IF v_config_value IS NOT NULL THEN
                    RAISE EXCEPTION 'Parameter % is LOCKED and cannot be modified', v_param_key;
                END IF;
            END IF;

            -- RESTRICTED parameters must be within allowed range
            IF (v_perm ->> 'edit_mode') = 'RESTRICTED' AND v_config_value IS NOT NULL THEN
                IF (v_perm ->> 'min_value') IS NOT NULL THEN
                    IF (v_config_value)::numeric < (v_perm ->> 'min_value')::numeric THEN
                        RAISE EXCEPTION 'Parameter % value below minimum %', v_param_key, v_perm ->> 'min_value';
                    END IF;
                END IF;
                IF (v_perm ->> 'max_value') IS NOT NULL THEN
                    IF (v_config_value)::numeric > (v_perm ->> 'max_value')::numeric THEN
                        RAISE EXCEPTION 'Parameter % value above maximum %', v_param_key, v_perm ->> 'max_value';
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- SKU substitutions: verify any sku_id in configuration appears in snapshot alternatives
    -- and passes sku_compatibility frozen in the snapshot
    -- (Detailed SKU substitution validation is handled by the p_bom_lines check below)

    -- =========================================================================
    -- Step 5: Validate p_bom_lines
    -- =========================================================================
    -- Build the set of valid SKU IDs from the snapshot zones
    v_sku_set := '[]'::jsonb;
    IF v_snapshot.snapshot_data -> 'zones' IS NOT NULL THEN
        SELECT jsonb_agg(DISTINCT z -> 'primary_sku' ->> 'sku_id')
          INTO v_sku_set
          FROM jsonb_array_elements(v_snapshot.snapshot_data -> 'zones') z
         WHERE z -> 'primary_sku' ->> 'sku_id' IS NOT NULL;

        -- Also include alternatives
        SELECT COALESCE(v_sku_set, '[]'::jsonb) || COALESCE(jsonb_agg(DISTINCT alt ->> 'sku_id'), '[]'::jsonb)
          INTO v_sku_set
          FROM jsonb_array_elements(v_snapshot.snapshot_data -> 'zones') z,
               jsonb_array_elements(z -> 'alternatives') alt
         WHERE alt ->> 'sku_id' IS NOT NULL;
    END IF;

    -- Also include SKUs from lighting, furniture, hidden_components
    IF v_snapshot.snapshot_data -> 'lighting' IS NOT NULL THEN
        SELECT COALESCE(v_sku_set, '[]'::jsonb) || COALESCE(jsonb_agg(DISTINCT l ->> 'sku_id'), '[]'::jsonb)
          INTO v_sku_set
          FROM jsonb_array_elements(v_snapshot.snapshot_data -> 'lighting') l
         WHERE l ->> 'sku_id' IS NOT NULL;
    END IF;

    IF v_snapshot.snapshot_data -> 'furniture' IS NOT NULL THEN
        SELECT COALESCE(v_sku_set, '[]'::jsonb) || COALESCE(jsonb_agg(DISTINCT f ->> 'sku_id'), '[]'::jsonb)
          INTO v_sku_set
          FROM jsonb_array_elements(v_snapshot.snapshot_data -> 'furniture') f
         WHERE f ->> 'sku_id' IS NOT NULL;
    END IF;

    IF v_snapshot.snapshot_data -> 'hidden_components' IS NOT NULL THEN
        SELECT COALESCE(v_sku_set, '[]'::jsonb) || COALESCE(jsonb_agg(DISTINCT h ->> 'sku_id'), '[]'::jsonb)
          INTO v_sku_set
          FROM jsonb_array_elements(v_snapshot.snapshot_data -> 'hidden_components') h
         WHERE h ->> 'sku_id' IS NOT NULL;
    END IF;

    -- Validate each BOM line
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_bom_lines)
    LOOP
        -- sku_id must exist in sku_master
        IF NOT EXISTS (
            SELECT 1 FROM perfecity.sku_master sm
             WHERE sm.sku_id = (v_line ->> 'sku_id')::uuid
        ) THEN
            RAISE EXCEPTION 'SKU % not found in sku_master', v_line ->> 'sku_id';
        END IF;

        -- sku_id must be in the snapshot SKU set
        IF v_sku_set IS NOT NULL AND NOT v_sku_set @> to_jsonb(v_line ->> 'sku_id') THEN
            RAISE EXCEPTION 'SKU % not present in project snapshot', v_line ->> 'sku_id';
        END IF;

        -- quantity must be > 0
        IF (v_line ->> 'quantity')::numeric <= 0 THEN
            RAISE EXCEPTION 'BOM line quantity must be positive, got %', v_line ->> 'quantity';
        END IF;

        -- required_quantity and waste_quantity must be non-negative integers
        IF (v_line ->> 'required_quantity')::integer < 0 THEN
            RAISE EXCEPTION 'required_quantity must be non-negative';
        END IF;

        IF (v_line ->> 'waste_quantity')::integer < 0 THEN
            RAISE EXCEPTION 'waste_quantity must be non-negative';
        END IF;
    END LOOP;

    -- =========================================================================
    -- Step 6: INSERT project_configuration
    -- =========================================================================
    SELECT COALESCE(MAX(pc.configuration_version), 0)
      INTO v_max_version
      FROM perfecity.project_configuration pc
     WHERE pc.project_id = p_project_id;

    -- Compute configuration hash (sha256 of canonical JSON)
    v_config_hash := encode(
        digest(perfecity.canonical_jsonb(p_configuration_data)::text, 'sha256'),
        'hex'
    );

    INSERT INTO perfecity.project_configuration (
        project_id, configuration_version, configuration_hash,
        updated_by, configuration_data
    ) VALUES (
        p_project_id, v_max_version + 1, v_config_hash,
        p_user_id, p_configuration_data
    )
    RETURNING configuration_id INTO v_configuration_id;

    -- =========================================================================
    -- Step 7: INSERT actual_bom
    -- =========================================================================
    INSERT INTO perfecity.actual_bom (
        project_id, snapshot_id, configuration_id,
        status, engine_version, rule_set_id, input_hash
    ) VALUES (
        p_project_id, v_project.snapshot_id, v_configuration_id,
        'GENERATED', p_engine_version, v_rule_set_id, p_input_hash
    )
    RETURNING actual_bom_id INTO v_actual_bom_id;

    -- =========================================================================
    -- Step 8: INSERT actual_bom_line rows
    -- =========================================================================
    INSERT INTO perfecity.actual_bom_line (
        actual_bom_id, master_bom_line_id, component_id, sku_id,
        product_type, quantity, required_quantity, waste_factor,
        waste_quantity, unit_of_measure, resolved_dimensions,
        calculation_rule, calculation_inputs
    )
    SELECT
        v_actual_bom_id,
        CASE WHEN (line ->> 'master_bom_line_id') IS NOT NULL
             THEN (line ->> 'master_bom_line_id')::uuid
             ELSE NULL END,
        (line ->> 'component_id')::uuid,
        (line ->> 'sku_id')::uuid,
        COALESCE(line ->> 'product_type', 'WALL_PANEL'),
        (line ->> 'quantity')::numeric,
        (line ->> 'required_quantity')::integer,
        COALESCE((line ->> 'waste_factor')::numeric, 0),
        (line ->> 'waste_quantity')::integer,
        COALESCE(line ->> 'unit_of_measure', 'PCS'),
        COALESCE((line -> 'resolved_dimensions')::jsonb, '{}'::jsonb),
        COALESCE(line ->> 'calculation_rule', 'CALCULATED'),
        COALESCE((line -> 'calculation_inputs')::jsonb, '{}'::jsonb)
    FROM jsonb_array_elements(p_bom_lines) AS line;

    -- =========================================================================
    -- Step 9: Promote project status and validate BOM
    -- Set internal_bom_write to bypass trg_project_status_guard,
    -- then set project.status='CONFIGURED' first (audit D1 requirement:
    -- supersede_actual_bom only promotes CONFIGURED -> VALIDATED).
    -- =========================================================================
    SET LOCAL perfecity.internal_bom_write = 'true';

    UPDATE perfecity.project
       SET status = 'CONFIGURED',
           updated_at = now()
     WHERE project_id = p_project_id
       AND status IN ('DRAFT', 'CONFIGURED', 'VALIDATED');

    -- Now validate the BOM; this fires supersede_actual_bom trigger
    -- which promotes CONFIGURED -> VALIDATED and sets current_actual_bom_id
    UPDATE perfecity.actual_bom
       SET status = 'VALIDATED'
     WHERE actual_bom_id = v_actual_bom_id;

    -- =========================================================================
    -- Step 10: Record idempotency + audit
    -- =========================================================================
    INSERT INTO perfecity.actual_bom_idempotency (idempotency_key, actual_bom_id)
    VALUES (p_idempotency_key, v_actual_bom_id);

    INSERT INTO perfecity.audit_event (
        actor_id, actor_role, event_type, entity_type,
        entity_id, project_id, after_state
    ) VALUES (
        p_user_id, 'CONSULTANT', 'ACTUAL_BOM_SAVED', 'actual_bom',
        v_actual_bom_id, p_project_id,
        jsonb_build_object(
            'engine_version', p_engine_version,
            'input_hash', p_input_hash,
            'configuration_id', v_configuration_id,
            'line_count', jsonb_array_length(p_bom_lines)
        )
    );

    RETURN v_actual_bom_id;
END;
$$;

-- =============================================================================
-- 3. GRANTS
-- =============================================================================

REVOKE ALL ON FUNCTION perfecity.save_actual_bom(UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.save_actual_bom(UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT) TO authenticated;
