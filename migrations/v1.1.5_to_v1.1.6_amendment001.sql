-- Migration: v1.1.5 -> v1.1.6 (Amendment 001 - Wall Configuration & Spacing)
-- Creates 4 new tables for wall configuration, obstructions, and generated panel frames.

BEGIN;

-- =============================================================================
-- Table: template_wall_configuration
-- Designer-defined wall configuration stored at template level.
-- =============================================================================
CREATE TABLE IF NOT EXISTS perfecity.template_wall_configuration (
  wall_config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES perfecity.template(template_id) ON DELETE CASCADE,
  wall_type TEXT NOT NULL CHECK (wall_type IN ('STRAIGHT', 'L_CORNER')),
  total_width_mm INT NOT NULL CHECK (total_width_mm > 0),
  total_height_mm INT NOT NULL CHECK (total_height_mm > 0),
  rows INT NOT NULL DEFAULT 1 CHECK (rows > 0),
  columns INT NOT NULL DEFAULT 1 CHECK (columns > 0),
  panel_gap_mm INT NOT NULL DEFAULT 0 CHECK (panel_gap_mm >= 0),
  fit_algorithm TEXT NOT NULL DEFAULT 'EQUAL' CHECK (fit_algorithm IN (
    'EQUAL', 'ADJUST_END_PANELS', 'SPREAD_LEFT', 'SPREAD_RIGHT',
    'SPREAD_BOTH_ENDS', 'CENTRE_FOCUS', 'OUTER_FOCUS', 'ALTERNATING'
  )),
  fit_intensity_percent INT NOT NULL DEFAULT 0 CHECK (fit_intensity_percent BETWEEN 0 AND 100),
  mounting_type TEXT NOT NULL DEFAULT 'DIRECT' CHECK (mounting_type IN ('DIRECT', 'PROFILE', 'RAIL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One wall config per template (unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_wall_config_template
  ON perfecity.template_wall_configuration(template_id);

-- =============================================================================
-- Table: project_wall_configuration
-- Project-level wall configuration, may include consultant overrides.
-- =============================================================================
CREATE TABLE IF NOT EXISTS perfecity.project_wall_configuration (
  project_wall_config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES perfecity.project(project_id) ON DELETE CASCADE,
  wall_type TEXT NOT NULL CHECK (wall_type IN ('STRAIGHT', 'L_CORNER')),
  total_width_mm INT NOT NULL CHECK (total_width_mm > 0),
  total_height_mm INT NOT NULL CHECK (total_height_mm > 0),
  rows INT NOT NULL DEFAULT 1 CHECK (rows > 0),
  columns INT NOT NULL DEFAULT 1 CHECK (columns > 0),
  panel_gap_mm INT NOT NULL DEFAULT 0 CHECK (panel_gap_mm >= 0),
  fit_algorithm TEXT NOT NULL DEFAULT 'EQUAL' CHECK (fit_algorithm IN (
    'EQUAL', 'ADJUST_END_PANELS', 'SPREAD_LEFT', 'SPREAD_RIGHT',
    'SPREAD_BOTH_ENDS', 'CENTRE_FOCUS', 'OUTER_FOCUS', 'ALTERNATING'
  )),
  fit_intensity_percent INT NOT NULL DEFAULT 0 CHECK (fit_intensity_percent BETWEEN 0 AND 100),
  mounting_type TEXT NOT NULL DEFAULT 'DIRECT' CHECK (mounting_type IN ('DIRECT', 'PROFILE', 'RAIL')),
  consultant_overrides JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One wall config per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_wall_config_project
  ON perfecity.project_wall_configuration(project_id);

-- =============================================================================
-- Table: project_obstruction
-- Protected areas on the wall that panels cannot overlap.
-- =============================================================================
CREATE TABLE IF NOT EXISTS perfecity.project_obstruction (
  obstruction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES perfecity.project(project_id) ON DELETE CASCADE,
  x_mm INT NOT NULL CHECK (x_mm >= 0),
  y_mm INT NOT NULL CHECK (y_mm >= 0),
  width_mm INT NOT NULL CHECK (width_mm > 0),
  height_mm INT NOT NULL CHECK (height_mm > 0),
  obstruction_type TEXT NOT NULL CHECK (obstruction_type IN ('WINDOW', 'DOOR', 'PILLAR', 'CUSTOM')),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_obstruction_project
  ON perfecity.project_obstruction(project_id);

-- =============================================================================
-- Table: generated_panel_frame
-- System-generated panel frames from the wall configuration engine.
-- Immutable once generated (Rule 64, Rule 65).
-- =============================================================================
CREATE TABLE IF NOT EXISTS perfecity.generated_panel_frame (
  frame_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES perfecity.project(project_id) ON DELETE CASCADE,
  row_index INT NOT NULL CHECK (row_index >= 0),
  col_index INT NOT NULL CHECK (col_index >= 0),
  x_mm INT NOT NULL CHECK (x_mm >= 0),
  y_mm INT NOT NULL CHECK (y_mm >= 0),
  width_mm INT NOT NULL CHECK (width_mm >= 50),   -- Rule 69: minimum 50mm
  height_mm INT NOT NULL CHECK (height_mm >= 50),  -- Rule 69: minimum 50mm
  segment TEXT CHECK (segment IN ('SEGMENT_A', 'SEGMENT_B') OR segment IS NULL),
  is_edge_panel BOOLEAN NOT NULL DEFAULT false,
  generation_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_panel_frame_project
  ON perfecity.generated_panel_frame(project_id);

-- Unique per project + position
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_panel_frame_position
  ON perfecity.generated_panel_frame(project_id, row_index, col_index);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE perfecity.template_wall_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project_wall_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project_obstruction ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.generated_panel_frame ENABLE ROW LEVEL SECURITY;

-- template_wall_configuration: authenticated users can read; creators can write
CREATE POLICY "template_wall_config_select"
  ON perfecity.template_wall_configuration FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "template_wall_config_insert"
  ON perfecity.template_wall_configuration FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_wall_configuration.template_id
        AND t.created_by = auth.uid()::text
    )
  );

CREATE POLICY "template_wall_config_update"
  ON perfecity.template_wall_configuration FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_wall_configuration.template_id
        AND t.created_by = auth.uid()::text
    )
  );

CREATE POLICY "template_wall_config_delete"
  ON perfecity.template_wall_configuration FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_wall_configuration.template_id
        AND t.created_by = auth.uid()::text
    )
  );

-- project_wall_configuration: authenticated users can read; project owner can write
CREATE POLICY "project_wall_config_select"
  ON perfecity.project_wall_configuration FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "project_wall_config_insert"
  ON perfecity.project_wall_configuration FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_wall_configuration.project_id
        AND p.created_by = auth.uid()::text
    )
  );

CREATE POLICY "project_wall_config_update"
  ON perfecity.project_wall_configuration FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_wall_configuration.project_id
        AND p.created_by = auth.uid()::text
    )
  );

CREATE POLICY "project_wall_config_delete"
  ON perfecity.project_wall_configuration FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_wall_configuration.project_id
        AND p.created_by = auth.uid()::text
    )
  );

-- project_obstruction: same pattern as project_wall_configuration
CREATE POLICY "project_obstruction_select"
  ON perfecity.project_obstruction FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "project_obstruction_insert"
  ON perfecity.project_obstruction FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_obstruction.project_id
        AND p.created_by = auth.uid()::text
    )
  );

CREATE POLICY "project_obstruction_update"
  ON perfecity.project_obstruction FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_obstruction.project_id
        AND p.created_by = auth.uid()::text
    )
  );

CREATE POLICY "project_obstruction_delete"
  ON perfecity.project_obstruction FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_obstruction.project_id
        AND p.created_by = auth.uid()::text
    )
  );

-- generated_panel_frame: read-only for all authenticated; insert/delete by project owner
CREATE POLICY "generated_panel_frame_select"
  ON perfecity.generated_panel_frame FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "generated_panel_frame_insert"
  ON perfecity.generated_panel_frame FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = generated_panel_frame.project_id
        AND p.created_by = auth.uid()::text
    )
  );

CREATE POLICY "generated_panel_frame_delete"
  ON perfecity.generated_panel_frame FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = generated_panel_frame.project_id
        AND p.created_by = auth.uid()::text
    )
  );

COMMIT;
