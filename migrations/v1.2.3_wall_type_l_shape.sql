-- ============================================================================
-- Migration: v1.2.3 - Wall type L_SHAPE (canonical) alongside L_CORNER (legacy)
--
-- L_SHAPE becomes the canonical wall type value for NEW writes. L_CORNER stays
-- accepted so existing rows and frozen snapshots remain valid; no data is
-- rewritten. The frozen baseline and earlier migrations are never modified.
-- ============================================================================

BEGIN;

ALTER TABLE perfecity.template_wall_configuration
  DROP CONSTRAINT IF EXISTS template_wall_configuration_wall_type_check;

ALTER TABLE perfecity.template_wall_configuration
  ADD CONSTRAINT template_wall_configuration_wall_type_check
  CHECK (wall_type IN ('STRAIGHT', 'L_CORNER', 'L_SHAPE'));

ALTER TABLE perfecity.project_wall_configuration
  DROP CONSTRAINT IF EXISTS project_wall_configuration_wall_type_check;

ALTER TABLE perfecity.project_wall_configuration
  ADD CONSTRAINT project_wall_configuration_wall_type_check
  CHECK (wall_type IN ('STRAIGHT', 'L_CORNER', 'L_SHAPE'));

COMMENT ON COLUMN perfecity.template_wall_configuration.wall_type IS
  'STRAIGHT | L_SHAPE (canonical) | L_CORNER (legacy alias of L_SHAPE, read-only compatibility)';

COMMENT ON COLUMN perfecity.project_wall_configuration.wall_type IS
  'STRAIGHT | L_SHAPE (canonical) | L_CORNER (legacy alias of L_SHAPE, read-only compatibility)';

COMMIT;
