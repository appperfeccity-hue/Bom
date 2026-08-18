-- Migration v1.1.8: Server-side snapshot + rule-set resolution
-- Creates canonical_jsonb, build_template_snapshot, and new 5-arg create_project.
-- Drops the old 6-arg create_project signature.
-- All functions are SECURITY DEFINER with search_path='perfecity'.

SET search_path = 'perfecity';

-- =============================================================================
-- 1. canonical_jsonb: deterministic key ordering (mirrors frontend sortKeysDeep)
-- =============================================================================

CREATE OR REPLACE FUNCTION perfecity.canonical_jsonb(p JSONB)
RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = 'perfecity'
AS $$
  SELECT CASE jsonb_typeof(p)
    WHEN 'object' THEN (
      SELECT COALESCE(
        jsonb_object_agg(key, perfecity.canonical_jsonb(value) ORDER BY key),
        '{}'::jsonb
      )
      FROM jsonb_each(p)
    )
    WHEN 'array' THEN (
      SELECT COALESCE(
        jsonb_agg(perfecity.canonical_jsonb(elem) ORDER BY idx),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(p) WITH ORDINALITY AS t(elem, idx)
    )
    ELSE p
  END;
$$;

COMMENT ON FUNCTION perfecity.canonical_jsonb(JSONB) IS
  'Recursively sorts object keys for deterministic hashing. Arrays preserve order.';

-- =============================================================================
-- 2. build_template_snapshot: assembles v2 snapshot JSON from template data
-- =============================================================================

CREATE OR REPLACE FUNCTION perfecity.build_template_snapshot(
    p_template_id UUID,
    p_rule_set_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'perfecity'
AS $$
DECLARE
  v_template       RECORD;
  v_zones          JSONB;
  v_lighting       JSONB;
  v_furniture      JSONB;
  v_trims          JSONB;
  v_hidden         JSONB;
  v_permissions    JSONB;
  v_wall_config    JSONB;
  v_sku_compat     JSONB;
  v_rule_set       JSONB;
  v_sku_ids        UUID[];
  v_result         JSONB;
BEGIN
  -- Fetch the template row
  SELECT template_id, name, wall_application, adaptation_strategy,
         priority_zone_id, waste_factor, metadata, wall_geometry
    INTO v_template
    FROM template
   WHERE template_id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % not found', p_template_id;
  END IF;

  -- Build zones with joined SKU and alternatives
  SELECT COALESCE(jsonb_agg(zone_row ORDER BY tz.zone_id), '[]'::jsonb)
    INTO v_zones
    FROM template_zone tz
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'zone_id', tz.zone_id,
        'x_mm', tz.x_mm,
        'y_mm', tz.y_mm,
        'width_mm', tz.width_mm,
        'height_mm', tz.height_mm,
        'width_strategy', tz.width_strategy,
        'height_strategy', tz.height_strategy,
        'position_strategy', tz.position_strategy,
        'primary_sku', (
          SELECT to_jsonb(sm.*)
            FROM template_zone_sku tzs
            JOIN sku_master sm ON sm.sku_id = tzs.sku_id
           WHERE tzs.zone_id = tz.zone_id
             AND tzs.is_primary = TRUE
           LIMIT 1
        ),
        'alternatives', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'alternative_id', tza.alternative_id,
              'display_order', tza.display_order,
              'reason', tza.reason,
              'sku', to_jsonb(sm.*)
            ) ORDER BY tza.display_order
          ), '[]'::jsonb)
            FROM template_zone_alternative tza
            JOIN sku_master sm ON sm.sku_id = tza.alternative_sku_id
           WHERE tza.template_zone_id = tz.zone_id
             AND tza.status = 'ACTIVE'
        )
      ) AS zone_row
    ) sub
   WHERE tz.template_id = p_template_id;

  -- Build lighting with joined SKU
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'lighting_id', tl.lighting_id,
      'sku_id', tl.sku_id,
      'edge_selection', tl.edge_selection,
      'mounting_type', tl.mounting_type,
      'quantity_rule', tl.quantity_rule,
      'sku', to_jsonb(sm.*)
    )
  ), '[]'::jsonb)
    INTO v_lighting
    FROM template_lighting tl
    JOIN sku_master sm ON sm.sku_id = tl.sku_id
   WHERE tl.template_id = p_template_id;

  -- Build furniture with joined SKU
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'furniture_id', tf.furniture_id,
      'sku_id', tf.sku_id,
      'position_x_mm', tf.position_x_mm,
      'position_y_mm', tf.position_y_mm,
      'orientation', tf.orientation,
      'sku', to_jsonb(sm.*)
    )
  ), '[]'::jsonb)
    INTO v_furniture
    FROM template_furniture tf
    JOIN sku_master sm ON sm.sku_id = tf.sku_id
   WHERE tf.template_id = p_template_id;

  -- Build trims with joined SKU
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'trim_id', tt.trim_id,
      'sku_id', tt.sku_id,
      'trim_type', tt.trim_type,
      'quantity_rule', tt.quantity_rule,
      'fixed_quantity', tt.fixed_quantity,
      'sku', to_jsonb(sm.*)
    )
  ), '[]'::jsonb)
    INTO v_trims
    FROM template_trim tt
    JOIN sku_master sm ON sm.sku_id = tt.sku_id
   WHERE tt.template_id = p_template_id;

  -- Build hidden components with joined SKU
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'hidden_component_id', thc.hidden_component_id,
      'sku_id', thc.sku_id,
      'classification', thc.classification,
      'trigger_type', thc.trigger_type,
      'trigger_condition', thc.trigger_condition,
      'quantity_rule', thc.quantity_rule,
      'quantity_parameters', thc.quantity_parameters,
      'parent_component_id', thc.parent_component_id,
      'mandatory', thc.mandatory,
      'sku', to_jsonb(sm.*)
    )
  ), '[]'::jsonb)
    INTO v_hidden
    FROM template_hidden_component thc
    JOIN sku_master sm ON sm.sku_id = thc.sku_id
   WHERE thc.template_id = p_template_id;

  -- Build consultant permissions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'permission_id', tcp.permission_id,
      'parameter_key', tcp.parameter_key,
      'parameter_type', tcp.parameter_type,
      'edit_mode', tcp.edit_mode,
      'min_value', tcp.min_value,
      'max_value', tcp.max_value,
      'allowed_values', tcp.allowed_values,
      'source_component_id', tcp.source_component_id
    )
  ), '[]'::jsonb)
    INTO v_permissions
    FROM template_consultant_permission tcp
   WHERE tcp.template_id = p_template_id;

  -- Build template wall configuration (single row or null)
  SELECT to_jsonb(twc.*)
    INTO v_wall_config
    FROM template_wall_configuration twc
   WHERE twc.template_id = p_template_id
   LIMIT 1;

  -- Collect all referenced SKU IDs for compatibility filtering
  SELECT array_agg(DISTINCT sku_id) INTO v_sku_ids FROM (
    SELECT tzs.sku_id FROM template_zone_sku tzs
      JOIN template_zone tz ON tz.zone_id = tzs.zone_id
     WHERE tz.template_id = p_template_id
    UNION ALL
    SELECT tza.alternative_sku_id FROM template_zone_alternative tza
      JOIN template_zone tz ON tz.zone_id = tza.template_zone_id
     WHERE tz.template_id = p_template_id AND tza.status = 'ACTIVE'
    UNION ALL
    SELECT tl.sku_id FROM template_lighting tl WHERE tl.template_id = p_template_id
    UNION ALL
    SELECT tf.sku_id FROM template_furniture tf WHERE tf.template_id = p_template_id
    UNION ALL
    SELECT tt.sku_id FROM template_trim tt WHERE tt.template_id = p_template_id
    UNION ALL
    SELECT thc.sku_id FROM template_hidden_component thc WHERE thc.template_id = p_template_id
  ) all_skus;

  -- Build SKU compatibility restricted to template SKU set
  IF v_sku_ids IS NOT NULL AND array_length(v_sku_ids, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(sc.*)), '[]'::jsonb)
      INTO v_sku_compat
      FROM sku_compatibility sc
     WHERE sc.source_sku_id = ANY(v_sku_ids)
        OR sc.target_sku_id = ANY(v_sku_ids);
  ELSE
    v_sku_compat := '[]'::jsonb;
  END IF;

  -- Build rule set subset
  SELECT jsonb_build_object(
    'rule_set_id', rs.rule_set_id,
    'rule_set_code', rs.rule_set_code,
    'version', rs.version,
    'constants', rs.constants
  ) INTO v_rule_set
    FROM rule_set rs
   WHERE rs.rule_set_id = p_rule_set_id;

  -- Assemble final snapshot
  v_result := jsonb_build_object(
    'snapshot_version', 2,
    'template', jsonb_build_object(
      'template_id', v_template.template_id,
      'name', v_template.name,
      'wall_application', v_template.wall_application,
      'adaptation_strategy', v_template.adaptation_strategy,
      'priority_zone_id', v_template.priority_zone_id,
      'waste_factor', v_template.waste_factor,
      'metadata', v_template.metadata
    ),
    'wall_geometry', v_template.wall_geometry,
    'base_dimensions', jsonb_build_object(
      'width_mm', (v_template.wall_geometry->>'base_width_mm')::int,
      'height_mm', (v_template.wall_geometry->>'base_height_mm')::int
    ),
    'zones', v_zones,
    'lighting', v_lighting,
    'furniture', v_furniture,
    'trims', v_trims,
    'hidden_components', v_hidden,
    'consultant_permissions', v_permissions,
    'template_wall_configuration', v_wall_config,
    'sku_compatibility', v_sku_compat,
    'rule_set', v_rule_set,
    'calculation_parameters', jsonb_build_object(
      'waste_factor', v_template.waste_factor,
      'engine_version', '1.1.8'
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION perfecity.build_template_snapshot(UUID, UUID) IS
  'Assembles the v2 snapshot JSON from template and related data, frozen at creation time.';

-- =============================================================================
-- 3. New 5-arg create_project (server-side snapshot + rule-set resolution)
-- =============================================================================

CREATE OR REPLACE FUNCTION perfecity.create_project(
    p_template_id        UUID,
    p_user_id            UUID,
    p_idempotency_key    TEXT,
    p_customer_reference TEXT DEFAULT NULL,
    p_site_reference     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'perfecity'
AS $$
DECLARE
  v_project_id    UUID;
  v_snapshot_id   UUID;
  v_rule_set_id   UUID;
  v_snapshot      JSONB;
  v_hash          TEXT;
  v_existing_id   UUID;
BEGIN
  -- 1. Auth check: caller must be authenticated and match p_user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch or not authenticated';
  END IF;

  -- 2. Role check: must be CONSULTANT
  IF perfecity.current_user_role() != 'CONSULTANT' THEN
    RAISE EXCEPTION 'Forbidden: only CONSULTANT role can create projects';
  END IF;

  -- 3. Advisory lock on idempotency key to serialize concurrent attempts
  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));

  -- 4. Idempotency lookup: return existing project if key was already used
  SELECT project_id INTO v_existing_id
    FROM project_idempotency
   WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  -- 5. Template must exist and be ACTIVE (lock it to prevent demotion during snapshot build)
  PERFORM 1
    FROM template
   WHERE template_id = p_template_id
     AND status = 'ACTIVE'
     FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template is not active or does not exist';
  END IF;

  -- 6. Eligibility check
  PERFORM perfecity.check_template_eligible(p_template_id);

  -- 7. Resolve ACTIVE rule set (guaranteed unique by idx_only_one_active_rule_set)
  SELECT rule_set_id INTO v_rule_set_id
    FROM rule_set
   WHERE status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No ACTIVE rule set';
  END IF;

  -- 8. Build the template snapshot
  v_snapshot := perfecity.build_template_snapshot(p_template_id, v_rule_set_id);

  -- 9. Compute SHA-256 hash of the canonical snapshot
  v_hash := encode(
    pg_catalog.sha256(convert_to(perfecity.canonical_jsonb(v_snapshot)::text, 'UTF8')),
    'hex'
  );

  -- 10. Insert project, snapshot, update project, insert idempotency
  v_project_id := gen_random_uuid();
  v_snapshot_id := gen_random_uuid();

  INSERT INTO project (
    project_id, template_id, status,
    customer_reference, site_reference,
    created_by, created_at, updated_at
  ) VALUES (
    v_project_id, p_template_id, 'DRAFT',
    p_customer_reference, p_site_reference,
    p_user_id, now(), now()
  );

  INSERT INTO project_snapshot (
    snapshot_id, project_id, template_id,
    snapshot_data, snapshot_hash, rule_set_id,
    created_at
  ) VALUES (
    v_snapshot_id, v_project_id, p_template_id,
    v_snapshot, v_hash, v_rule_set_id,
    now()
  );

  UPDATE project
     SET snapshot_id = v_snapshot_id,
         updated_at = now()
   WHERE project_id = v_project_id;

  INSERT INTO project_idempotency (
    idempotency_key, project_id, created_at
  ) VALUES (
    p_idempotency_key, v_project_id, now()
  );

  -- 11. Audit event
  INSERT INTO audit_event (
    event_id, actor_id, actor_role, event_type,
    entity_type, entity_id, project_id, snapshot_id,
    created_at
  ) VALUES (
    gen_random_uuid(), p_user_id, 'CONSULTANT', 'PROJECT_CREATED',
    'PROJECT', v_project_id, v_project_id, v_snapshot_id,
    now()
  );

  RETURN v_project_id;
END;
$$;

COMMENT ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, TEXT, TEXT) IS
  'Creates a project with server-side snapshot and rule-set resolution. 5-arg version (v1.1.8).';

-- =============================================================================
-- 4. Drop old 6-arg signature
-- =============================================================================

DROP FUNCTION IF EXISTS perfecity.create_project(UUID, UUID, TEXT, JSONB, TEXT, UUID);

-- =============================================================================
-- 5. Grants
-- =============================================================================

REVOKE ALL ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION perfecity.canonical_jsonb(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION perfecity.canonical_jsonb(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION perfecity.build_template_snapshot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION perfecity.build_template_snapshot(UUID, UUID) TO authenticated;
