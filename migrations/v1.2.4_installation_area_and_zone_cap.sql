-- ============================================================================
-- Migration: v1.2.4 - Installation area semantics + max 3 zones per wall
--
-- Additive only. The frozen baseline (v1.1.5, tag mvp-v1.0.1-hardened) and all
-- historical migrations are left untouched. Existing DB authority is reused:
--   * one SKU per zone      -> uq_zone_single_sku (unchanged)
--   * zone dimension ranges -> template_zone CHECK 200-3000 x 200-2700 (unchanged)
-- The only new rule is the per-wall zone cap (spec sections 11, 14).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Installation area (parent of zones). NULL coverage == FULL wall coverage,
--    so existing rows keep their current meaning without a data rewrite.
-- ----------------------------------------------------------------------------

ALTER TABLE perfecity.template_wall_configuration
  ADD COLUMN IF NOT EXISTS installation_coverage TEXT,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_x_mm INTEGER,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_y_mm INTEGER,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_height_mm INTEGER;

ALTER TABLE perfecity.template_wall_configuration
  DROP CONSTRAINT IF EXISTS template_wall_configuration_installation_coverage_check;
ALTER TABLE perfecity.template_wall_configuration
  ADD CONSTRAINT template_wall_configuration_installation_coverage_check
  CHECK (installation_coverage IS NULL OR installation_coverage IN ('FULL', 'PARTIAL'));

ALTER TABLE perfecity.project_wall_configuration
  ADD COLUMN IF NOT EXISTS installation_coverage TEXT,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_x_mm INTEGER,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_y_mm INTEGER,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS installation_outer_edge_height_mm INTEGER;

ALTER TABLE perfecity.project_wall_configuration
  DROP CONSTRAINT IF EXISTS project_wall_configuration_installation_coverage_check;
ALTER TABLE perfecity.project_wall_configuration
  ADD CONSTRAINT project_wall_configuration_installation_coverage_check
  CHECK (installation_coverage IS NULL OR installation_coverage IN ('FULL', 'PARTIAL'));

COMMENT ON COLUMN perfecity.template_wall_configuration.installation_coverage IS
  'FULL | PARTIAL installation area coverage. NULL is treated as FULL. The outer edge columns bound zones (zones are bounded by the installation area, not the full wall).';
COMMENT ON COLUMN perfecity.project_wall_configuration.installation_coverage IS
  'FULL | PARTIAL installation area coverage. NULL is treated as FULL.';

-- ----------------------------------------------------------------------------
-- 2. Max 3 zones per wall (template_zone). Enforced as a deferred-safe trigger
--    rather than a constraint because the rule spans rows of the same template.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION perfecity.enforce_max_zones_per_wall()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = perfecity, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM perfecity.template_zone
   WHERE template_id = NEW.template_id;

  IF v_count > 3 THEN
    RAISE EXCEPTION 'Number of zones exceeds the maximum allowed (3) for template %', NEW.template_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_template_zone_max_count ON perfecity.template_zone;
CREATE CONSTRAINT TRIGGER trg_template_zone_max_count
  AFTER INSERT OR UPDATE OF template_id ON perfecity.template_zone
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION perfecity.enforce_max_zones_per_wall();

COMMIT;
