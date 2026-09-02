-- ============================================================================
-- Migration v1.2.6 — SKU dependency graph
--
-- Additive only. baseline/v1.1.5_baseline.sql is IMMUTABLE and is never edited.
--
-- Spec (2D Canvas, "Dependent SKU Rules"): a primary SKU may declare child SKUs
-- that the BOM must resolve recursively and deterministically:
--   dependency_type  REQUIRED | CONDITIONAL | OPTIONAL
--   quantity_rule    PER_PARENT | PER_AREA | PER_LENGTH | PER_EDGE | FIXED
--
-- sku_compatibility (REQUIRES / COMPATIBLE_WITH / ALTERNATIVE_TO) remains a
-- validation-only relationship; it is not changed. sku_dependency is the
-- generation relationship: it is what makes child lines appear in a BOM.
--
-- The transitive dependency closure of every SKU referenced by a template is
-- frozen into the v2 snapshot under `sku_dependencies` (each row carries the
-- full child sku_master record) so BOM generation stays traceable to the frozen
-- SKU Master, exactly like sku_compatibility today.
-- ============================================================================

SET search_path = perfecity, public;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. sku_dependency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfecity.sku_dependency (
    dependency_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_sku_id     UUID NOT NULL REFERENCES perfecity.sku_master(sku_id),
    child_sku_id      UUID NOT NULL REFERENCES perfecity.sku_master(sku_id),
    dependency_type   TEXT NOT NULL
                      CHECK (dependency_type IN ('REQUIRED','CONDITIONAL','OPTIONAL')),
    -- { field, operator EQ|NEQ|GT|LT|GTE|LTE, value } evaluated against the
    -- parent's zone context (mountingType, zoneCount, wallType, ...).
    condition         JSONB,
    quantity_rule     TEXT NOT NULL
                      CHECK (quantity_rule IN ('PER_PARENT','PER_AREA','PER_LENGTH','PER_EDGE','FIXED')),
    -- PER_PARENT: child qty = parent qty * factor
    -- PER_AREA:   child qty = ceil(zone area m2 * factor)
    -- PER_LENGTH: child qty = ceil(edge length m * factor)
    -- PER_EDGE:   child qty = edge count * factor
    -- FIXED:      child qty = factor
    quantity_factor   NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (quantity_factor > 0),
    unit_of_measure   TEXT NOT NULL DEFAULT 'PCS' CHECK (unit_of_measure IN ('PCS','M','M2')),
    status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_sku_id <> child_sku_id),
    CHECK (dependency_type <> 'CONDITIONAL' OR condition IS NOT NULL),
    CONSTRAINT uq_sku_dependency_edge UNIQUE (parent_sku_id, child_sku_id)
);

CREATE INDEX IF NOT EXISTS idx_sku_dependency_parent ON perfecity.sku_dependency(parent_sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_dependency_child  ON perfecity.sku_dependency(child_sku_id);

COMMENT ON TABLE perfecity.sku_dependency IS
  'Parent -> child SKU generation graph. Children are resolved recursively into the BOM.';

-- ---------------------------------------------------------------------------
-- 2. Cycle guard (DEPENDENCY_004 circular dependency)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.enforce_sku_dependency_acyclic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = perfecity, pg_temp
AS $$
DECLARE
  v_cycle BOOLEAN;
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  WITH RECURSIVE walk(sku_id, depth) AS (
    SELECT NEW.child_sku_id, 1
    UNION ALL
    SELECT d.child_sku_id, w.depth + 1
      FROM perfecity.sku_dependency d
      JOIN walk w ON w.sku_id = d.parent_sku_id
     WHERE d.status = 'ACTIVE'
       AND d.dependency_id IS DISTINCT FROM NEW.dependency_id
       AND w.depth < 64
  )
  SELECT EXISTS (SELECT 1 FROM walk WHERE sku_id = NEW.parent_sku_id) INTO v_cycle;

  IF v_cycle THEN
    RAISE EXCEPTION
      'sku_dependency % -> % would create a circular dependency',
      NEW.parent_sku_id, NEW.child_sku_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sku_dependency_acyclic ON perfecity.sku_dependency;
CREATE TRIGGER trg_sku_dependency_acyclic
  BEFORE INSERT OR UPDATE OF parent_sku_id, child_sku_id, status ON perfecity.sku_dependency
  FOR EACH ROW EXECUTE FUNCTION perfecity.enforce_sku_dependency_acyclic();

-- ---------------------------------------------------------------------------
-- 3. RLS + grants (same policy shape as sku_compatibility)
-- ---------------------------------------------------------------------------
ALTER TABLE perfecity.sku_dependency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sku_dependency_select_authenticated ON perfecity.sku_dependency;
DROP POLICY IF EXISTS sku_dependency_insert_admin ON perfecity.sku_dependency;
DROP POLICY IF EXISTS sku_dependency_update_admin ON perfecity.sku_dependency;
DROP POLICY IF EXISTS sku_dependency_delete_admin ON perfecity.sku_dependency;

CREATE POLICY sku_dependency_select_authenticated ON perfecity.sku_dependency
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sku_dependency_insert_admin ON perfecity.sku_dependency
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_dependency_update_admin ON perfecity.sku_dependency
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_dependency_delete_admin ON perfecity.sku_dependency
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

GRANT SELECT ON perfecity.sku_dependency TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.sku_dependency TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Transitive closure helper used by the snapshot builder
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.build_sku_dependency_closure(p_root_sku_ids UUID[])
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'perfecity'
AS $$
  WITH RECURSIVE reach(sku_id, depth) AS (
    SELECT DISTINCT r, 0 FROM unnest(p_root_sku_ids) AS r
    UNION
    SELECT d.child_sku_id, reach.depth + 1
      FROM perfecity.sku_dependency d
      JOIN reach ON reach.sku_id = d.parent_sku_id
     WHERE d.status = 'ACTIVE' AND reach.depth < 64
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'dependency_id',   d.dependency_id,
      'parent_sku_id',   d.parent_sku_id,
      'child_sku_id',    d.child_sku_id,
      'dependency_type', d.dependency_type,
      'condition',       d.condition,
      'quantity_rule',   d.quantity_rule,
      'quantity_factor', d.quantity_factor,
      'unit_of_measure', d.unit_of_measure,
      'child_sku',       to_jsonb(sm.*)
    ) ORDER BY d.parent_sku_id, d.child_sku_id
  ), '[]'::jsonb)
    FROM perfecity.sku_dependency d
    JOIN perfecity.sku_master sm ON sm.sku_id = d.child_sku_id
   WHERE d.status = 'ACTIVE'
     AND d.parent_sku_id IN (SELECT sku_id FROM reach);
$$;

-- ---------------------------------------------------------------------------
-- 5. build_template_snapshot: freeze `sku_dependencies` alongside
--    `sku_compatibility`. Body is v1.1.8 with the closure added; snapshot
--    stays version 2 (consumers treat a missing key as an empty graph).
-- ---------------------------------------------------------------------------
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
  v_sku_deps       JSONB;
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

  -- Freeze the transitive SKU dependency closure of the template SKU set
  IF v_sku_ids IS NOT NULL AND array_length(v_sku_ids, 1) > 0 THEN
    v_sku_deps := perfecity.build_sku_dependency_closure(v_sku_ids);
  ELSE
    v_sku_deps := '[]'::jsonb;
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
    'sku_dependencies', v_sku_deps,
    'rule_set', v_rule_set,
    'calculation_parameters', jsonb_build_object(
      'waste_factor', v_template.waste_factor,
      'engine_version', '1.2.6'
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION perfecity.build_template_snapshot(UUID, UUID) IS
  'Assembles the v2 snapshot JSON from template and related data, frozen at creation time. v1.2.6 adds sku_dependencies.';

COMMIT;
