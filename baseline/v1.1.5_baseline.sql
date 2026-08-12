-- ============================================================================
-- PERFECCITY MVP Database Baseline v1.1.5 (Patch Candidate / Execution‑Ready)
-- PostgreSQL 16.4+
-- Architecture: FROZEN   |   Specification: FROZEN   |   P0/P1: CLOSED
-- ============================================================================
-- This is the single authoritative source for the PERFECCITY database contract.
-- It incorporates v1.1.4 (the frozen specification‑aligned baseline) plus the
-- minimal v1.1.5 corrective patch that closes the final identified P1 invariant
-- gap (Zone SKU 1:1 enforcement).
--
-- Lifecycle:
--   v1.1.4 – Execution‑Verified & Specification‑Frozen
--            (one identified invariant gap: Zone SKU 1:1)
--   v1.1.5 – Patch Candidate / Execution‑Ready
--            (gap closed; pending execution verification)
--
-- Once the full regression suite passes on a live PostgreSQL 16.4+ instance,
-- v1.1.5 becomes the Execution‑Verified, Specification‑Aligned, Frozen Baseline.
-- ============================================================================

-- 0. SCHEMA & EXTENSIONS
CREATE SCHEMA IF NOT EXISTS perfecity;
SET search_path = perfecity;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ============================================================================
-- 1. PRODUCT MASTER & FAMILIES
-- ============================================================================
CREATE TABLE product_master (
    product_type    TEXT PRIMARY KEY CHECK (product_type IN ('WALL_PANEL','LIGHT','FURNITURE'))
);

CREATE TABLE family_master (
    family_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE category_master (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID NOT NULL REFERENCES family_master(family_id),
    name        TEXT NOT NULL,
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, category_id)
);

CREATE TABLE design_family_master (
    design_family_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL UNIQUE,
    created_by       UUID NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE design_subfamily_master (
    design_subfamily_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_family_id    UUID NOT NULL REFERENCES design_family_master(design_family_id),
    name                TEXT NOT NULL,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (design_family_id, design_subfamily_id)
);


-- ============================================================================
-- 2. SKU MASTER & VARIANTS
-- ============================================================================
CREATE TABLE sku_master (
    sku_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_code        VARCHAR(50) NOT NULL UNIQUE,
    product_type    TEXT NOT NULL REFERENCES product_master(product_type),
    family_id       UUID NOT NULL,
    category_id     UUID NOT NULL,
    width_mm        INTEGER CHECK (width_mm > 0),
    height_mm       INTEGER CHECK (height_mm > 0),
    thickness_mm    INTEGER CHECK (thickness_mm >= 0),
    depth_mm        INTEGER CHECK (depth_mm >= 0),
    unit_length_mm  INTEGER CHECK (unit_length_mm > 0),
    material        TEXT NOT NULL DEFAULT '',
    colour          TEXT NOT NULL DEFAULT '',
    finish          TEXT NOT NULL DEFAULT '',
    pattern_identity TEXT,
    gh_mm           INTEGER NOT NULL DEFAULT 0 CHECK (gh_mm BETWEEN 0 AND 10),
    gv_mm           INTEGER NOT NULL DEFAULT 0 CHECK (gv_mm BETWEEN 0 AND 10),
    quantity_mode   TEXT CHECK (quantity_mode IN ('DISCRETE','LINEAR')),
    commercial_attributes JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (family_id, category_id) REFERENCES category_master(family_id, category_id),
    -- P1-01: accurate LIGHT rule, null-safe
    CONSTRAINT chk_sku_dims CHECK (
        CASE product_type
            WHEN 'WALL_PANEL' THEN width_mm IS NOT NULL
                                 AND height_mm IS NOT NULL
                                 AND thickness_mm IS NOT NULL
                                 AND depth_mm = 0
                                 AND unit_length_mm IS NULL
                                 AND quantity_mode IS NULL
            WHEN 'LIGHT' THEN thickness_mm IS NOT NULL
                            AND depth_mm = 0
                            AND quantity_mode IS NOT NULL
                            AND (quantity_mode <> 'DISCRETE' OR unit_length_mm IS NOT NULL)
            WHEN 'FURNITURE' THEN width_mm IS NOT NULL
                                AND height_mm IS NOT NULL
                                AND depth_mm > 0
                                AND thickness_mm = 0
                                AND unit_length_mm IS NULL
                                AND quantity_mode IS NULL
        END
    )
);

CREATE TABLE sku_variant (
    variant_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_code  VARCHAR(50) NOT NULL UNIQUE,
    sku_id        UUID NOT NULL REFERENCES sku_master(sku_id),
    display_group VARCHAR(100),
    display_order INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sku_compatibility (
    compatibility_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_sku_id     UUID NOT NULL REFERENCES sku_master(sku_id),
    target_sku_id     UUID NOT NULL REFERENCES sku_master(sku_id),
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('REQUIRES','COMPATIBLE_WITH','ALTERNATIVE_TO')),
    directionality    TEXT NOT NULL CHECK (directionality IN ('UNIDIRECTIONAL','BIDIRECTIONAL')),
    is_mandatory      BOOLEAN NOT NULL DEFAULT false,
    status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (source_sku_id <> target_sku_id)
);


-- ============================================================================
-- 3. PRODUCT CATALOGUE
-- ============================================================================
CREATE TABLE catalogue_entry (
    catalogue_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id             UUID NOT NULL UNIQUE REFERENCES sku_master(sku_id),
    status             TEXT NOT NULL DEFAULT 'INCOMPLETE' CHECK (status IN ('INCOMPLETE','READY')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE catalogue_asset (
    asset_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalogue_entry_id  UUID NOT NULL REFERENCES catalogue_entry(catalogue_entry_id),
    asset_type          TEXT NOT NULL CHECK (asset_type IN ('GEOMETRY','PATTERN','RENDER')),
    version             INTEGER NOT NULL,
    content_hash        TEXT NOT NULL,
    file_reference      TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'UPLOADING' CHECK (status IN ('UPLOADING','VALIDATING','VALID','INVALID')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_current          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_current_asset EXCLUDE USING btree (catalogue_entry_id WITH =, asset_type WITH =) WHERE (is_current)
);

CREATE TABLE catalogue_asset_metadata (
    metadata_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id            UUID NOT NULL UNIQUE REFERENCES catalogue_asset(asset_id),
    validated_width_mm  NUMERIC(8,2),
    validated_height_mm NUMERIC(8,2),
    validated_depth_mm  NUMERIC(8,2),
    validated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 4. RULE SET
-- ============================================================================
CREATE TABLE rule_set (
    rule_set_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_code   TEXT NOT NULL UNIQUE,
    version         TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','SUPERSEDED')),
    effective_from  TIMESTAMPTZ NOT NULL,
    effective_to    TIMESTAMPTZ,
    constants       JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_only_one_active_rule_set ON rule_set (status) WHERE status = 'ACTIVE';


-- ============================================================================
-- 5. TEMPLATE & DESIGN
-- ============================================================================
CREATE TABLE template (
    template_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    description         TEXT,
    design_family_id    UUID NOT NULL,
    design_subfamily_id UUID,
    wall_application    TEXT NOT NULL,
    wall_geometry       JSONB NOT NULL,
    adaptation_strategy TEXT NOT NULL CHECK (adaptation_strategy IN ('PROPORTIONAL','PRIORITY_ZONE','EQUAL_DISTRIBUTION','FIXED')),
    priority_zone_id    UUID,
    waste_factor        NUMERIC(3,2) NOT NULL CHECK (waste_factor IN (0.00,0.03,0.05,0.08,0.10,0.12,0.15)),
    metadata            JSONB NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (design_family_id, design_subfamily_id)
        REFERENCES design_subfamily_master(design_family_id, design_subfamily_id)
);

CREATE TABLE template_zone (
    zone_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id       UUID NOT NULL REFERENCES template(template_id),
    segment           TEXT CHECK (segment IN ('SEGMENT_A','SEGMENT_B')),
    x_mm              INTEGER NOT NULL,
    y_mm              INTEGER NOT NULL,
    width_mm          INTEGER NOT NULL CHECK (width_mm BETWEEN 200 AND 3000),
    height_mm         INTEGER NOT NULL CHECK (height_mm BETWEEN 200 AND 2700),
    width_strategy    TEXT NOT NULL CHECK (width_strategy IN ('PROPORTIONAL','FIXED','LOCKED')),
    height_strategy   TEXT NOT NULL CHECK (height_strategy IN ('DERIVED_FROM_WALL','FIXED','RESIZABLE')),
    position_strategy TEXT NOT NULL CHECK (position_strategy IN ('FIXED','FLOATING')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_zone_sku (
    zone_sku_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id     UUID NOT NULL REFERENCES template_zone(zone_id),
    sku_id      UUID NOT NULL REFERENCES sku_master(sku_id),
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (zone_id, sku_id),
    -- v1.1.5: enforce strict 1:1 zone-to-SKU invariant per S47, S112.9
    CONSTRAINT uq_zone_single_sku UNIQUE (zone_id)
);
CREATE UNIQUE INDEX idx_one_primary_per_zone ON template_zone_sku (zone_id) WHERE is_primary;

CREATE TABLE template_zone_alternative (
    alternative_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_zone_id  UUID NOT NULL REFERENCES template_zone(zone_id),
    alternative_sku_id UUID NOT NULL REFERENCES sku_master(sku_id),
    display_order     INTEGER NOT NULL DEFAULT 0,
    reason            TEXT,
    status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_lighting (
    lighting_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id    UUID NOT NULL REFERENCES template(template_id),
    sku_id         UUID NOT NULL REFERENCES sku_master(sku_id),
    edge_selection TEXT NOT NULL,
    mounting_type  TEXT NOT NULL CHECK (mounting_type IN ('DIRECT','PROFILE','COVE')),
    quantity_rule  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_furniture (
    furniture_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id  UUID NOT NULL REFERENCES template(template_id),
    sku_id       UUID NOT NULL REFERENCES sku_master(sku_id),
    position_x_mm INTEGER,
    position_y_mm INTEGER,
    orientation  TEXT CHECK (orientation IN ('HORIZONTAL','VERTICAL')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_trim (
    trim_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id   UUID NOT NULL REFERENCES template(template_id),
    sku_id        UUID REFERENCES sku_master(sku_id),
    trim_type     TEXT NOT NULL CHECK (trim_type IN ('GEOMETRY','PHYSICAL')),
    quantity_rule TEXT NOT NULL CHECK (quantity_rule IN ('TRIM_BY_ZONE_PERIMETER','TRIM_BY_PANEL_EDGE','TRIM_BY_LENGTH','TRIM_FIXED')),
    fixed_quantity INTEGER CHECK (fixed_quantity >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_hidden_component (
    hidden_component_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES template(template_id),
    sku_id              UUID NOT NULL REFERENCES sku_master(sku_id),
    classification      TEXT NOT NULL CHECK (classification IN ('STRUCTURAL','INSTALLATION_HARDWARE','LIGHTING_SUPPORT','TRIM','OTHER')),
    trigger_type        TEXT NOT NULL CHECK (trigger_type IN ('CONDITION','ALWAYS','DEPENDENCY')),
    trigger_condition   JSONB,
    quantity_rule       TEXT NOT NULL CHECK (quantity_rule IN ('FIXED','PER_ZONE','PER_PANEL','DERIVED_FROM_PARENT')),
    quantity_parameters JSONB,
    parent_component_id UUID REFERENCES template_hidden_component(hidden_component_id),
    mandatory           BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_consultant_permission (
    permission_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id        UUID NOT NULL REFERENCES template(template_id),
    parameter_key      TEXT NOT NULL CHECK (parameter_key IN (
        'WALL_WIDTH','WALL_HEIGHT','SEGMENT_A_WIDTH','SEGMENT_B_WIDTH',
        'ZONE_WIDTH','ZONE_HEIGHT','ZONE_POSITION_X','ZONE_POSITION_Y','ZONE_PRIMARY_SKU',
        'LIGHT_SKU','LIGHT_QUANTITY','LIGHT_MOUNTING_TYPE',
        'FURNITURE_SKU','FURNITURE_QUANTITY','FURNITURE_POSITION_X','FURNITURE_POSITION_Y','FURNITURE_ORIENTATION',
        'TRIM_SKU'
    )),
    parameter_type      TEXT NOT NULL CHECK (parameter_type IN ('DIMENSION','SKU_SELECTION','OPTION','BOOLEAN')),
    edit_mode           TEXT NOT NULL CHECK (edit_mode IN ('LOCKED','RESTRICTED','FREE')),
    min_value           DECIMAL,
    max_value           DECIMAL,
    allowed_values      JSONB,
    source_component_id UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 6. MASTER BOM
-- ============================================================================
CREATE TABLE master_bom (
    master_bom_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES template(template_id),
    status          TEXT NOT NULL CHECK (status IN ('GENERATED','VALIDATED','APPROVED','INVALIDATED')),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    engine_version  TEXT NOT NULL,
    rule_set_id     UUID NOT NULL REFERENCES rule_set(rule_set_id),
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_one_approved_master_bom ON master_bom (template_id) WHERE status = 'APPROVED';

CREATE TABLE master_bom_line (
    master_bom_line_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_bom_id         UUID NOT NULL REFERENCES master_bom(master_bom_id),
    template_component_id UUID NOT NULL,
    sku_id                UUID NOT NULL REFERENCES sku_master(sku_id),
    product_type          TEXT NOT NULL REFERENCES product_master(product_type),
    source_zone_id        UUID REFERENCES template_zone(zone_id),
    source_relationship_id UUID,
    quantity_rule         TEXT NOT NULL,
    default_quantity      DECIMAL(10,2) NOT NULL,
    unit_of_measure       TEXT NOT NULL DEFAULT 'PIECE',
    mandatory             BOOLEAN NOT NULL DEFAULT true,
    hidden                BOOLEAN NOT NULL DEFAULT false,
    calculation_parameters JSONB NOT NULL DEFAULT '{}',
    parent_bom_line_id    UUID REFERENCES master_bom_line(master_bom_line_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 7. PROJECT & SNAPSHOT
-- ============================================================================
CREATE TABLE project (
    project_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_reference     TEXT,
    site_reference         TEXT,
    template_id            UUID NOT NULL REFERENCES template(template_id),
    snapshot_id            UUID,
    current_configuration_id UUID,
    current_actual_bom_id  UUID,
    created_by             UUID NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIGURED','VALIDATED','FINALIZED')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at           TIMESTAMPTZ
);

CREATE TABLE project_snapshot (
    snapshot_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES project(project_id),
    template_id         UUID NOT NULL,
    snapshot_data       JSONB NOT NULL,
    snapshot_hash       TEXT NOT NULL,
    rule_set_id         UUID NOT NULL REFERENCES rule_set(rule_set_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 8. PROJECT CONFIGURATION & MEASUREMENTS
-- ============================================================================
CREATE TABLE project_configuration (
    configuration_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES project(project_id),
    configuration_version INTEGER NOT NULL,
    configuration_hash  TEXT NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          UUID NOT NULL,
    configuration_data  JSONB NOT NULL,
    UNIQUE (project_id, configuration_version)
);

CREATE TABLE project_measurement (
    measurement_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL UNIQUE REFERENCES project(project_id),
    wall_width_mm         INTEGER NOT NULL CHECK (wall_width_mm BETWEEN 600 AND 12000),
    wall_height_mm        INTEGER NOT NULL CHECK (wall_height_mm BETWEEN 300 AND 6000),
    segment_a_width_mm    INTEGER,
    segment_b_width_mm    INTEGER,
    measured_by           UUID NOT NULL,
    measured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    measurement_source    TEXT NOT NULL CHECK (measurement_source IN ('MANUAL','LASER','TAPE')),
    measurement_status    TEXT NOT NULL DEFAULT 'DRAFT' CHECK (measurement_status IN ('DRAFT','CONFIRMED')),
    notes                 TEXT
);


-- ============================================================================
-- 9. ACTUAL BOM
-- ============================================================================
CREATE TABLE actual_bom (
    actual_bom_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES project(project_id),
    snapshot_id         UUID NOT NULL REFERENCES project_snapshot(snapshot_id),
    configuration_id    UUID NOT NULL REFERENCES project_configuration(configuration_id),
    status              TEXT NOT NULL CHECK (status IN ('GENERATED','VALIDATED','SUPERSEDED')),
    engine_version      TEXT NOT NULL,
    rule_set_id         UUID NOT NULL REFERENCES rule_set(rule_set_id),
    input_hash          TEXT NOT NULL,
    calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE actual_bom_line (
    actual_bom_line_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actual_bom_id       UUID NOT NULL REFERENCES actual_bom(actual_bom_id),
    master_bom_line_id  UUID REFERENCES master_bom_line(master_bom_line_id),
    component_id        UUID NOT NULL,
    sku_id              UUID NOT NULL REFERENCES sku_master(sku_id),
    product_type        TEXT NOT NULL REFERENCES product_master(product_type),
    quantity            DECIMAL(10,2) NOT NULL,
    required_quantity   INTEGER NOT NULL,
    waste_factor        NUMERIC(3,2) NOT NULL,
    waste_quantity      INTEGER NOT NULL,
    unit_of_measure     TEXT NOT NULL,
    resolved_dimensions JSONB NOT NULL DEFAULT '{}',
    calculation_rule    TEXT NOT NULL,
    calculation_inputs  JSONB NOT NULL DEFAULT '{}'
);


-- ============================================================================
-- 10. FINAL BOM
-- ============================================================================
CREATE TABLE final_bom (
    final_bom_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL UNIQUE REFERENCES project(project_id),
    actual_bom_id   UUID NOT NULL REFERENCES actual_bom(actual_bom_id),
    final_bom_hash  TEXT NOT NULL,
    engine_version  TEXT NOT NULL,
    rule_set_id     UUID NOT NULL REFERENCES rule_set(rule_set_id),
    input_hash      TEXT NOT NULL,
    finalized_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_by    UUID NOT NULL
);

CREATE TABLE final_bom_line (
    final_bom_line_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_bom_id        UUID NOT NULL REFERENCES final_bom(final_bom_id),
    actual_bom_line_id  UUID NOT NULL REFERENCES actual_bom_line(actual_bom_line_id),
    sku_id              UUID NOT NULL,
    sku_code            VARCHAR(50) NOT NULL,
    product_type        TEXT NOT NULL,
    sku_material        TEXT,
    sku_colour          TEXT,
    sku_finish          TEXT,
    sku_dimensions_json JSONB,
    source_zone_id      UUID,
    source_component_id UUID,
    quantity            DECIMAL(10,2) NOT NULL,
    required_quantity   INTEGER NOT NULL,
    waste_quantity      INTEGER NOT NULL,
    unit_of_measure     TEXT NOT NULL,
    resolved_dimensions JSONB NOT NULL,
    source_trace        JSONB NOT NULL
);


-- ============================================================================
-- 11. AUDIT & IDEMPOTENCY
-- ============================================================================
CREATE TABLE audit_event (
    audit_event_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id            UUID NOT NULL,
    actor_role          TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type          TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    entity_id           UUID NOT NULL,
    project_id          UUID,
    snapshot_id         UUID,
    before_state        JSONB,
    after_state         JSONB,
    reason              TEXT,
    correlation_id      TEXT,
    diagnostic_context  JSONB,
    event_schema_version TEXT NOT NULL DEFAULT '1.0'
);

CREATE TABLE project_idempotency (
    idempotency_key TEXT PRIMARY KEY,
    project_id      UUID NOT NULL UNIQUE REFERENCES project(project_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finalization_idempotency (
    finalization_key TEXT PRIMARY KEY,
    project_id       UUID NOT NULL UNIQUE REFERENCES project(project_id),
    final_bom_id     UUID REFERENCES final_bom(final_bom_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 12. FORWARD-REFERENCE FOREIGN KEYS
-- ============================================================================
ALTER TABLE project ADD CONSTRAINT fk_project_snapshot
    FOREIGN KEY (snapshot_id) REFERENCES project_snapshot(snapshot_id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE project ADD CONSTRAINT fk_project_current_configuration
    FOREIGN KEY (current_configuration_id) REFERENCES project_configuration(configuration_id);

ALTER TABLE project ADD CONSTRAINT fk_project_current_actual_bom
    FOREIGN KEY (current_actual_bom_id) REFERENCES actual_bom(actual_bom_id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE template ADD CONSTRAINT fk_template_priority_zone
    FOREIGN KEY (priority_zone_id) REFERENCES template_zone(zone_id)
    DEFERRABLE INITIALLY DEFERRED;


-- ============================================================================
-- 13. INDEXES
-- ============================================================================
CREATE INDEX idx_sku_master_status ON sku_master(status) WHERE status = 'ACTIVE';
CREATE INDEX idx_sku_master_product_type ON sku_master(product_type);

CREATE INDEX idx_catalogue_entry_status ON catalogue_entry(status) WHERE status = 'READY';
CREATE INDEX idx_catalogue_asset_current ON catalogue_asset(catalogue_entry_id, asset_type) WHERE is_current;

CREATE INDEX idx_template_status ON template(status) WHERE status = 'ACTIVE';
CREATE INDEX idx_template_designer ON template(created_by);
CREATE INDEX idx_template_zone_template ON template_zone(template_id);

CREATE INDEX idx_project_consultant ON project(created_by);
CREATE INDEX idx_project_status ON project(status);

CREATE INDEX idx_actual_bom_project ON actual_bom(project_id);

CREATE INDEX idx_project_snapshot_hash ON project_snapshot(snapshot_hash);
CREATE INDEX idx_final_bom_hash ON final_bom(final_bom_hash);

CREATE UNIQUE INDEX idx_one_validated_actual_bom ON actual_bom (project_id) WHERE status = 'VALIDATED';


-- ============================================================================
-- 14. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Helper: set internal revalidation flag
CREATE OR REPLACE FUNCTION set_internal_revalidation() RETURNS void AS $$
BEGIN
    PERFORM set_config('perfecity.internal_revalidation', 'true', true);
END;
$$ LANGUAGE plpgsql;


-- Catalogue READY Recalculation
CREATE OR REPLACE FUNCTION revalidate_catalogue_entry(entry_id UUID)
RETURNS void AS $$
DECLARE
    sku_status TEXT;
    geom_ok    boolean;
    pat_ok     boolean := true;
    render_ok  boolean;
    dim_ok     boolean := true;
    sku        record;
    current_status TEXT;
BEGIN
    SELECT s.status, s.width_mm, s.height_mm, s.pattern_identity
    INTO sku
    FROM catalogue_entry ce
    JOIN sku_master s ON s.sku_id = ce.sku_id
    WHERE ce.catalogue_entry_id = entry_id;

    IF sku.status <> 'ACTIVE' THEN
        current_status := 'INCOMPLETE';
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM catalogue_asset
            WHERE catalogue_entry_id = entry_id AND asset_type = 'GEOMETRY'
              AND is_current AND status = 'VALID' AND content_hash IS NOT NULL
        ) INTO geom_ok;
        SELECT EXISTS (
            SELECT 1 FROM catalogue_asset
            WHERE catalogue_entry_id = entry_id AND asset_type = 'RENDER'
              AND is_current AND status = 'VALID' AND content_hash IS NOT NULL
        ) INTO render_ok;
        IF sku.pattern_identity IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM catalogue_asset
                WHERE catalogue_entry_id = entry_id AND asset_type = 'PATTERN'
                  AND is_current AND status = 'VALID' AND content_hash IS NOT NULL
            ) INTO pat_ok;
        END IF;

        IF geom_ok AND render_ok AND pat_ok THEN
            IF sku.width_mm IS NOT NULL AND sku.height_mm IS NOT NULL THEN
                SELECT (m.validated_width_mm IS NOT NULL AND m.validated_height_mm IS NOT NULL
                        AND ABS(m.validated_width_mm - sku.width_mm) <= 0.5
                        AND ABS(m.validated_height_mm - sku.height_mm) <= 0.5)
                INTO dim_ok
                FROM catalogue_asset a
                JOIN catalogue_asset_metadata m ON m.asset_id = a.asset_id
                WHERE a.catalogue_entry_id = entry_id AND a.asset_type = 'GEOMETRY' AND a.is_current;
                IF dim_ok IS NULL THEN dim_ok := false; END IF;
            END IF;
        END IF;

        IF geom_ok AND render_ok AND pat_ok AND dim_ok THEN
            current_status := 'READY';
        ELSE
            current_status := 'INCOMPLETE';
        END IF;
    END IF;

    PERFORM set_internal_revalidation();
    UPDATE catalogue_entry
    SET status = current_status, updated_at = now()
    WHERE catalogue_entry_id = entry_id AND status <> current_status;
END;
$$ LANGUAGE plpgsql;


-- Asset changes -> revalidate
CREATE OR REPLACE FUNCTION trg_asset_changed()
RETURNS trigger AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    v_entry_id := COALESCE(NEW.catalogue_entry_id, OLD.catalogue_entry_id);
    PERFORM revalidate_catalogue_entry(v_entry_id);

    IF TG_OP = 'UPDATE' AND OLD.catalogue_entry_id IS DISTINCT FROM NEW.catalogue_entry_id THEN
        PERFORM revalidate_catalogue_entry(OLD.catalogue_entry_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_after_change
    AFTER INSERT OR UPDATE OR DELETE ON catalogue_asset
    FOR EACH ROW EXECUTE FUNCTION trg_asset_changed();


-- Metadata changes -> revalidate
CREATE OR REPLACE FUNCTION trg_asset_metadata_changed()
RETURNS trigger AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    SELECT ca.catalogue_entry_id INTO v_entry_id
    FROM catalogue_asset ca WHERE ca.asset_id = COALESCE(NEW.asset_id, OLD.asset_id);
    PERFORM revalidate_catalogue_entry(v_entry_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_metadata_after_change
    AFTER INSERT OR UPDATE OR DELETE ON catalogue_asset_metadata
    FOR EACH ROW EXECUTE FUNCTION trg_asset_metadata_changed();


-- SKU master changes -> revalidate catalogue
CREATE OR REPLACE FUNCTION trg_sku_master_catalogue_revalidate()
RETURNS trigger AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.width_mm IS DISTINCT FROM NEW.width_mm
       OR OLD.height_mm IS DISTINCT FROM NEW.height_mm
       OR OLD.pattern_identity IS DISTINCT FROM NEW.pattern_identity
    THEN
        PERFORM revalidate_catalogue_entry(
            (SELECT catalogue_entry_id FROM catalogue_entry WHERE sku_id = NEW.sku_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sku_master_after_update
    AFTER UPDATE ON sku_master
    FOR EACH ROW EXECUTE FUNCTION trg_sku_master_catalogue_revalidate();


-- Catalogue entry status guard (database-owned)
CREATE OR REPLACE FUNCTION trg_catalogue_entry_status_guard()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF current_setting('perfecity.internal_revalidation', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Direct modification of catalogue_entry.status is not allowed';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_catalogue_entry_status_immutable
    BEFORE UPDATE OF status ON catalogue_entry
    FOR EACH ROW EXECUTE FUNCTION trg_catalogue_entry_status_guard();


-- Asset metadata geometry validation
CREATE OR REPLACE FUNCTION validate_asset_metadata()
RETURNS trigger AS $$
DECLARE
    v_asset_type TEXT;
BEGIN
    SELECT asset_type INTO v_asset_type FROM catalogue_asset WHERE asset_id = NEW.asset_id;
    IF v_asset_type = 'GEOMETRY' AND (NEW.validated_width_mm IS NULL OR NEW.validated_height_mm IS NULL) THEN
        RAISE EXCEPTION 'Geometry asset % requires validated width and height', NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_asset_metadata
    BEFORE INSERT OR UPDATE ON catalogue_asset_metadata
    FOR EACH ROW EXECUTE FUNCTION validate_asset_metadata();


-- ============================================================================
-- 15. TEMPLATE LIFECYCLE TRIGGERS
-- ============================================================================

-- Demote ACTIVE template on any structural child change
CREATE OR REPLACE FUNCTION demote_active_template_on_child_change()
RETURNS trigger AS $$
DECLARE
    v_old_template UUID;
    v_new_template UUID;
    v_status       TEXT;
BEGIN
    IF TG_TABLE_NAME IN ('template_zone','template_lighting','template_furniture','template_trim','template_hidden_component','template_consultant_permission') THEN
        IF TG_OP = 'DELETE' THEN
            v_old_template := OLD.template_id;
        ELSIF TG_OP = 'UPDATE' THEN
            v_old_template := OLD.template_id;
            v_new_template := NEW.template_id;
        ELSE
            v_new_template := NEW.template_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'template_zone_sku' THEN
        IF TG_OP IN ('DELETE','UPDATE') THEN
            SELECT tz.template_id INTO v_old_template FROM template_zone tz WHERE tz.zone_id = OLD.zone_id;
        END IF;
        IF TG_OP IN ('INSERT','UPDATE') THEN
            SELECT tz.template_id INTO v_new_template FROM template_zone tz WHERE tz.zone_id = NEW.zone_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'template_zone_alternative' THEN
        IF TG_OP IN ('DELETE','UPDATE') THEN
            SELECT tz.template_id INTO v_old_template FROM template_zone tz WHERE tz.zone_id = OLD.template_zone_id;
        END IF;
        IF TG_OP IN ('INSERT','UPDATE') THEN
            SELECT tz.template_id INTO v_new_template FROM template_zone tz WHERE tz.zone_id = NEW.template_zone_id;
        END IF;
    END IF;

    IF v_old_template IS NOT NULL THEN
        SELECT status INTO v_status FROM template WHERE template_id = v_old_template FOR UPDATE;
        IF v_status = 'ACTIVE' THEN
            UPDATE template SET status = 'DRAFT', updated_at = now() WHERE template_id = v_old_template;
        END IF;
    END IF;

    IF v_new_template IS NOT NULL AND v_new_template IS DISTINCT FROM v_old_template THEN
        SELECT status INTO v_status FROM template WHERE template_id = v_new_template FOR UPDATE;
        IF v_status = 'ACTIVE' THEN
            UPDATE template SET status = 'DRAFT', updated_at = now() WHERE template_id = v_new_template;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_zone_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_zone
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_zone_sku_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_zone_sku
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_alternative_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_zone_alternative
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_lighting_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_lighting
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_furniture_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_furniture
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_trim_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_trim
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_hidden_component_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_hidden_component
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();

CREATE TRIGGER trg_permission_demote
    BEFORE INSERT OR UPDATE OR DELETE ON template_consultant_permission
    FOR EACH ROW EXECUTE FUNCTION demote_active_template_on_child_change();


-- Demote when template's own structural columns change
CREATE OR REPLACE FUNCTION trg_template_structural_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.status = 'ACTIVE' THEN
        IF NEW.design_family_id IS DISTINCT FROM OLD.design_family_id
           OR NEW.design_subfamily_id IS DISTINCT FROM OLD.design_subfamily_id
           OR NEW.wall_application IS DISTINCT FROM OLD.wall_application
           OR NEW.wall_geometry IS DISTINCT FROM OLD.wall_geometry
           OR NEW.adaptation_strategy IS DISTINCT FROM OLD.adaptation_strategy
           OR NEW.priority_zone_id IS DISTINCT FROM OLD.priority_zone_id
           OR NEW.waste_factor IS DISTINCT FROM OLD.waste_factor
           OR NEW.metadata IS DISTINCT FROM OLD.metadata
        THEN
            NEW.status := 'DRAFT';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_template_struct_demote
    BEFORE UPDATE ON template
    FOR EACH ROW EXECUTE FUNCTION trg_template_structural_change();


-- Activation eligibility check
CREATE OR REPLACE FUNCTION check_template_eligible(tmpl_id UUID)
RETURNS boolean AS $$
DECLARE
    ineligible_skus integer;
BEGIN
    SELECT count(*) INTO ineligible_skus
    FROM template_zone tz
    JOIN template_zone_sku tzs ON tzs.zone_id = tz.zone_id AND tzs.is_primary
    LEFT JOIN sku_master s ON s.sku_id = tzs.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tz.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_zone tz
    JOIN template_zone_alternative tza ON tza.template_zone_id = tz.zone_id
    LEFT JOIN sku_master s ON s.sku_id = tza.alternative_sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tz.template_id = tmpl_id AND tza.status = 'ACTIVE'
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_lighting tl
    LEFT JOIN sku_master s ON s.sku_id = tl.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tl.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_furniture tf
    LEFT JOIN sku_master s ON s.sku_id = tf.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tf.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_trim tt
    LEFT JOIN sku_master s ON s.sku_id = tt.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tt.template_id = tmpl_id AND tt.sku_id IS NOT NULL
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_hidden_component thc
    LEFT JOIN sku_master s ON s.sku_id = thc.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE thc.template_id = tmpl_id AND thc.mandatory
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    IF NOT EXISTS (SELECT 1 FROM master_bom WHERE template_id = tmpl_id AND status = 'APPROVED') THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_template_activate()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        IF NOT check_template_eligible(NEW.template_id) THEN
            RAISE EXCEPTION 'Template % does not meet activation criteria', NEW.template_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_template_before_activate
    BEFORE UPDATE OF status ON template
    FOR EACH ROW EXECUTE FUNCTION trg_template_activate();


-- ============================================================================
-- 16. ACTUAL BOM SUPERSESSION & CONSISTENCY
-- ============================================================================

CREATE OR REPLACE FUNCTION supersede_actual_bom()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'VALIDATED' THEN
        PERFORM 1 FROM project WHERE project_id = NEW.project_id FOR UPDATE;

        UPDATE actual_bom
        SET status = 'SUPERSEDED'
        WHERE project_id = NEW.project_id
          AND status = 'VALIDATED'
          AND actual_bom_id <> NEW.actual_bom_id;

        UPDATE project
        SET current_actual_bom_id = NEW.actual_bom_id,
            status = CASE WHEN status = 'CONFIGURED' THEN 'VALIDATED' ELSE status END,
            updated_at = now()
        WHERE project_id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actual_bom_supersede
    BEFORE INSERT OR UPDATE OF status ON actual_bom
    FOR EACH ROW
    WHEN (NEW.status = 'VALIDATED')
    EXECUTE FUNCTION supersede_actual_bom();


CREATE OR REPLACE FUNCTION trg_actual_bom_project_consistency()
RETURNS trigger AS $$
DECLARE
    snap_project UUID;
    conf_project UUID;
BEGIN
    SELECT project_id INTO snap_project FROM project_snapshot WHERE snapshot_id = NEW.snapshot_id;
    IF snap_project IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Actual BOM snapshot must belong to the same project';
    END IF;
    SELECT project_id INTO conf_project FROM project_configuration WHERE configuration_id = NEW.configuration_id;
    IF conf_project IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Actual BOM configuration must belong to the same project';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actual_bom_ownership
    BEFORE INSERT OR UPDATE ON actual_bom
    FOR EACH ROW EXECUTE FUNCTION trg_actual_bom_project_consistency();


CREATE OR REPLACE FUNCTION trg_snapshot_template_match()
RETURNS trigger AS $$
DECLARE
    proj_template UUID;
BEGIN
    SELECT template_id INTO proj_template FROM project WHERE project_id = NEW.project_id;
    IF proj_template IS NOT NULL AND NEW.template_id <> proj_template THEN
        RAISE EXCEPTION 'Snapshot template_id must match project.template_id';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_template_check
    BEFORE INSERT ON project_snapshot
    FOR EACH ROW EXECUTE FUNCTION trg_snapshot_template_match();


-- ============================================================================
-- 17. IMMUTABILITY TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_snapshot_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Project snapshot is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_snapshot_immutable
    BEFORE UPDATE OR DELETE ON project_snapshot
    FOR EACH ROW EXECUTE FUNCTION prevent_snapshot_modification();

CREATE OR REPLACE FUNCTION prevent_final_bom_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Final BOM is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_final_bom_immutable
    BEFORE UPDATE OR DELETE ON final_bom
    FOR EACH ROW EXECUTE FUNCTION prevent_final_bom_modification();

CREATE OR REPLACE FUNCTION prevent_final_bom_line_modification()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF current_setting('perfecity.internal_finalization', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Cannot insert into final_bom_line outside finalization transaction';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Final BOM line is immutable';
    END IF;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_final_bom_line_immutable
    BEFORE INSERT OR UPDATE OR DELETE ON final_bom_line
    FOR EACH ROW EXECUTE FUNCTION prevent_final_bom_line_modification();

CREATE OR REPLACE FUNCTION prevent_actual_bom_modification_after_final()
RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM final_bom WHERE actual_bom_id = OLD.actual_bom_id) THEN
        RAISE EXCEPTION 'Actual BOM is frozen because a Final BOM references it';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_actual_bom_frozen
    BEFORE UPDATE OR DELETE ON actual_bom
    FOR EACH ROW EXECUTE FUNCTION prevent_actual_bom_modification_after_final();

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_event
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();


-- ============================================================================
-- 18. IDEMPOTENT PROJECT CREATION
-- ============================================================================
CREATE OR REPLACE FUNCTION create_project(
    p_template_id UUID,
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_snapshot_data JSONB,
    p_snapshot_hash TEXT,
    p_rule_set_id UUID
) RETURNS UUID AS $$
DECLARE
    v_lock_key bigint;
    v_project_id UUID;
    v_snapshot_id UUID;
    existing_id UUID;
BEGIN
    v_lock_key := hashtext(p_idempotency_key);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT project_id INTO existing_id FROM project_idempotency WHERE idempotency_key = p_idempotency_key;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;

    INSERT INTO project (template_id, created_by, status)
    VALUES (p_template_id, p_user_id, 'DRAFT')
    RETURNING project_id INTO v_project_id;

    INSERT INTO project_snapshot (project_id, template_id, snapshot_data, snapshot_hash, rule_set_id)
    VALUES (v_project_id, p_template_id, p_snapshot_data, p_snapshot_hash, p_rule_set_id)
    RETURNING snapshot_id INTO v_snapshot_id;

    UPDATE project SET snapshot_id = v_snapshot_id WHERE project_id = v_project_id;

    INSERT INTO project_idempotency (idempotency_key, project_id) VALUES (p_idempotency_key, v_project_id);

    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 19. FINALIZATION PROCEDURE
-- ============================================================================
CREATE OR REPLACE FUNCTION finalize_project(
    p_project_id UUID,
    p_user_id UUID,
    p_finalization_key TEXT,
    p_computed_final_hash TEXT
) RETURNS UUID AS $$
DECLARE
    v_actual_bom_id UUID;
    v_final_bom_id UUID;
    v_lock_key bigint;
    v_existing_final UUID;
BEGIN
    v_lock_key := hashtext('finalize_' || p_project_id);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT fb.final_bom_id INTO v_existing_final
    FROM final_bom fb WHERE fb.project_id = p_project_id;
    IF v_existing_final IS NOT NULL THEN
        RETURN v_existing_final;
    END IF;

    SELECT final_bom_id INTO v_existing_final
    FROM finalization_idempotency WHERE finalization_key = p_finalization_key;
    IF v_existing_final IS NOT NULL THEN
        RETURN v_existing_final;
    END IF;

    SELECT current_actual_bom_id INTO v_actual_bom_id
    FROM project WHERE project_id = p_project_id AND status = 'VALIDATED'
    FOR UPDATE;
    IF v_actual_bom_id IS NULL THEN
        RAISE EXCEPTION 'Project is not in a valid state for finalization';
    END IF;

    INSERT INTO final_bom (project_id, actual_bom_id, final_bom_hash, engine_version, rule_set_id, input_hash, finalized_by)
    SELECT p_project_id, v_actual_bom_id, p_computed_final_hash, ab.engine_version, ab.rule_set_id, ab.input_hash, p_user_id
    FROM actual_bom ab WHERE ab.actual_bom_id = v_actual_bom_id
    RETURNING final_bom_id INTO v_final_bom_id;

    PERFORM set_config('perfecity.internal_finalization', 'true', true);
    INSERT INTO final_bom_line (
        final_bom_id, actual_bom_line_id, sku_id, sku_code, product_type,
        sku_material, sku_colour, sku_finish, sku_dimensions_json,
        source_zone_id, source_component_id, quantity, required_quantity,
        waste_quantity, unit_of_measure, resolved_dimensions, source_trace
    )
    SELECT
        v_final_bom_id, abl.actual_bom_line_id, abl.sku_id, sm.sku_code, abl.product_type,
        sm.material, sm.colour, sm.finish,
        jsonb_build_object(
            'width_mm', sm.width_mm,
            'height_mm', sm.height_mm,
            'thickness_mm', sm.thickness_mm,
            'depth_mm', sm.depth_mm
        ),
        abl.component_id, NULL,
        abl.quantity, abl.required_quantity, abl.waste_quantity,
        abl.unit_of_measure, abl.resolved_dimensions, '{}'::jsonb
    FROM actual_bom_line abl
    JOIN sku_master sm ON sm.sku_id = abl.sku_id
    WHERE abl.actual_bom_id = v_actual_bom_id;
    PERFORM set_config('perfecity.internal_finalization', 'false', true);

    UPDATE project SET status = 'FINALIZED', finalized_at = now()
    WHERE project_id = p_project_id;

    IF p_finalization_key IS NOT NULL THEN
        INSERT INTO finalization_idempotency (finalization_key, project_id, final_bom_id)
        VALUES (p_finalization_key, p_project_id, v_final_bom_id);
    END IF;

    RETURN v_final_bom_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 20. P1-02 - MEASUREMENT-CHANGE INVALIDATION TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION invalidate_bom_on_measurement_change()
RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM project WHERE project_id = NEW.project_id FOR UPDATE;

  UPDATE actual_bom
     SET status = 'SUPERSEDED'
   WHERE project_id = NEW.project_id
     AND status = 'VALIDATED';

  UPDATE project
     SET current_actual_bom_id = NULL,
         status = 'CONFIGURED',
         updated_at = now()
   WHERE project_id = NEW.project_id
     AND status = 'VALIDATED';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_measurement_invalidate_bom ON project_measurement;
CREATE TRIGGER trg_measurement_invalidate_bom
  AFTER INSERT OR UPDATE ON project_measurement
  FOR EACH ROW EXECUTE FUNCTION invalidate_bom_on_measurement_change();


-- ============================================================================
-- 21. SEED DATA
-- ============================================================================
INSERT INTO product_master (product_type) VALUES ('WALL_PANEL'), ('LIGHT'), ('FURNITURE');

INSERT INTO design_family_master (name, created_by) VALUES
('Modern', '00000000-0000-0000-0000-000000000001'),
('Minimalist', '00000000-0000-0000-0000-000000000001'),
('Luxury', '00000000-0000-0000-0000-000000000001'),
('Contemporary', '00000000-0000-0000-0000-000000000001');

INSERT INTO rule_set (rule_set_code, version, status, effective_from, constants, created_by) VALUES
('RS-2026-001', '1.0.0', 'ACTIVE', now(),
 '{
    "WALL_WIDTH_MIN": 600, "WALL_WIDTH_MAX": 12000,
    "WALL_HEIGHT_MIN": 300, "WALL_HEIGHT_MAX": 6000,
    "L_CORNER_SEGMENT_MIN": 300, "L_CORNER_SEGMENT_MAX": 12000,
    "MIN_RETAINED_MM": 50,
    "LED_PER_DRIVER_MM": 5000, "WIRE_EXTRA_MM": 2000,
    "VALID_WASTE_FACTORS": [0.00,0.03,0.05,0.08,0.10,0.12,0.15],
    "ZONE_MIN_WIDTH": 200, "ZONE_MAX_WIDTH": 3000,
    "ZONE_MIN_HEIGHT": 200, "ZONE_MAX_HEIGHT": 2700,
    "MAX_ZONES_PER_WALL": 12
  }'::jsonb,
 '00000000-0000-0000-0000-000000000001');


-- ============================================================================
-- 22. FINAL DECLARATION
-- ============================================================================
-- DECLARATION OF STATUS: P1 CORRECTION CANDIDATE / EXECUTION-READY
-- Baseline: PERFECCITY MVP Database DDL v1.1.5
-- Date: 2026-08-12
-- Target Platform: PostgreSQL 16.4+
-- ============================================================================
