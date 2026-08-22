/**
 * TypeScript interfaces matching the perfecity schema tables used by the frontend.
 * Based on baseline/v1.1.5_baseline.sql.
 */

// --- Enums ---

export enum CanvasMode {
  DESIGNER = 'DESIGNER',
  CONSULTANT = 'CONSULTANT',
}

export enum ZoneWidthStrategy {
  PROPORTIONAL = 'PROPORTIONAL',
  FIXED = 'FIXED',
  LOCKED = 'LOCKED',
}

export enum ZoneHeightStrategy {
  DERIVED_FROM_WALL = 'DERIVED_FROM_WALL',
  FIXED = 'FIXED',
  RESIZABLE = 'RESIZABLE',
}

export enum ZonePositionStrategy {
  FIXED = 'FIXED',
  FLOATING = 'FLOATING',
}

export enum TemplateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  CONFIGURED = 'CONFIGURED',
  VALIDATED = 'VALIDATED',
  FINALIZED = 'FINALIZED',
}

export enum AdaptationStrategy {
  PROPORTIONAL = 'PROPORTIONAL',
  PRIORITY_ZONE = 'PRIORITY_ZONE',
  EQUAL_DISTRIBUTION = 'EQUAL_DISTRIBUTION',
  FIXED = 'FIXED',
}

/**
 * Wall geometry type.
 * L_SHAPE is the canonical value; L_CORNER is the legacy value preserved in
 * frozen snapshots and pre-existing rows. Readers must accept both
 * (see engines/wallType.ts).
 */
export type WallGeometryType = 'STRAIGHT' | 'L_CORNER' | 'L_SHAPE';

export interface WallGeometry {
  type: WallGeometryType;
  base_width_mm: number;
  base_height_mm: number;
  segment_a_width_mm?: number;
  segment_b_width_mm?: number;
}

// --- Database Row Interfaces ---

export interface Template {
  template_id: string;
  name: string;
  description: string | null;
  design_family_id: string | null;
  design_subfamily_id: string | null;
  wall_application: string | null;
  wall_geometry: WallGeometry;
  adaptation_strategy: AdaptationStrategy;
  priority_zone_id: string | null;
  waste_factor: number | null;
  metadata: Record<string, unknown> | null;
  status: TemplateStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateZone {
  zone_id: string;
  template_id: string;
  segment: 'SEGMENT_A' | 'SEGMENT_B' | null;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  width_strategy: ZoneWidthStrategy;
  height_strategy: ZoneHeightStrategy;
  position_strategy: ZonePositionStrategy;
  created_at: string;
}

/**
 * Installation-area coverage frozen with the wall configuration.
 * FULL spans the whole wall; PARTIAL uses the authored outer edge.
 */
export type InstallationAreaCoverage = 'FULL' | 'PARTIAL';

/**
 * Installation area authored on a wall configuration. The outer edge is the
 * parent boundary for zones (zones are bounded by it, not by the full wall).
 */
export interface InstallationAreaConfig {
  coverage: InstallationAreaCoverage;
  outer_edge_x_mm: number;
  outer_edge_y_mm: number;
  outer_edge_width_mm: number;
  outer_edge_height_mm: number;
}

export interface TemplateZoneSku {
  zone_sku_id: string;
  zone_id: string;
  sku_id: string;
  is_primary: boolean;
}

export interface TemplateLighting {
  lighting_id: string;
  template_id: string;
  sku_id: string;
  edge_selection: string | null;
  mounting_type: 'DIRECT' | 'PROFILE' | 'COVE';
  quantity_rule: string | null;
  created_at: string;
}

export interface TemplateFurniture {
  furniture_id: string;
  template_id: string;
  sku_id: string;
  position_x_mm: number;
  position_y_mm: number;
  orientation: 'HORIZONTAL' | 'VERTICAL';
  created_at: string;
}

export interface TemplateTrim {
  trim_id: string;
  template_id: string;
  sku_id: string;
  trim_type: 'GEOMETRY' | 'PHYSICAL';
  quantity_rule: 'TRIM_BY_ZONE_PERIMETER' | 'TRIM_BY_PANEL_EDGE' | 'TRIM_BY_LENGTH' | 'TRIM_FIXED';
  fixed_quantity: number | null;
  created_at: string;
}

export interface Project {
  project_id: string;
  customer_reference: string | null;
  site_reference: string | null;
  template_id: string;
  snapshot_id: string | null;
  current_configuration_id: string | null;
  current_actual_bom_id: string | null;
  created_by: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}

export interface ProjectSnapshot {
  snapshot_id: string;
  project_id: string;
  template_id: string;
  snapshot_data: Record<string, unknown>;
  snapshot_hash: string;
  rule_set_id: string;
  created_at: string;
}

export interface ProjectMeasurement {
  measurement_id: string;
  project_id: string;
  wall_width_mm: number;
  wall_height_mm: number;
  segment_a_width_mm: number | null;
  segment_b_width_mm: number | null;
  measured_by: string;
  measured_at: string;
  measurement_source: 'MANUAL' | 'LASER' | 'TAPE';
  measurement_status: 'DRAFT' | 'CONFIRMED';
  notes: string | null;
}

/**
 * Derived projection of one adaptable measurement.
 *
 * This is NOT a source of truth and is never persisted: `default` comes from the
 * designer geometry frozen in the project snapshot (wall_geometry), `minimum`/
 * `maximum` come from the frozen consultant permission for the canonical
 * parameter_key, and `actual` is the only value authored at the project layer
 * (project_measurement). Derived quantities such as segment length or area do
 * NOT receive this bundle.
 */
export interface PermanentMeasurement {
  default: number | null;
  actual: number;
  minimum: number | null;
  maximum: number | null;
}

export interface ProjectConfiguration {
  configuration_id: string;
  project_id: string;
  configuration_version: number;
  configuration_hash: string;
  updated_at: string;
  updated_by: string;
  configuration_data: Record<string, unknown>;
}

// --- SKU & Catalogue Enums ---

export enum ProductType {
  WALL_PANEL = 'WALL_PANEL',
  LIGHT = 'LIGHT',
  FURNITURE = 'FURNITURE',
}

export enum SkuStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum CatalogueStatus {
  INCOMPLETE = 'INCOMPLETE',
  READY = 'READY',
}

export enum AssetType {
  GEOMETRY = 'GEOMETRY',
  PATTERN = 'PATTERN',
  RENDER = 'RENDER',
}

export enum AssetStatus {
  UPLOADING = 'UPLOADING',
  VALIDATING = 'VALIDATING',
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export enum CompatibilityRelationship {
  REQUIRES = 'REQUIRES',
  COMPATIBLE_WITH = 'COMPATIBLE_WITH',
  ALTERNATIVE_TO = 'ALTERNATIVE_TO',
}

export enum Directionality {
  UNIDIRECTIONAL = 'UNIDIRECTIONAL',
  BIDIRECTIONAL = 'BIDIRECTIONAL',
}

export enum QuantityMode {
  DISCRETE = 'DISCRETE',
  LINEAR = 'LINEAR',
}

// --- SKU & Catalogue Interfaces ---

export interface SkuMaster {
  sku_id: string;
  sku_code: string;
  product_type: ProductType;
  family_id: string;
  category_id: string;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  depth_mm: number | null;
  unit_length_mm: number | null;
  material: string;
  colour: string;
  finish: string;
  pattern_identity: string | null;
  gh_mm: number;
  gv_mm: number;
  quantity_mode: QuantityMode | null;
  commercial_attributes: Record<string, unknown>;
  status: SkuStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CatalogueEntry {
  catalogue_entry_id: string;
  sku_id: string;
  status: CatalogueStatus;
  created_at: string;
  updated_at: string;
}

export interface CatalogueAsset {
  asset_id: string;
  catalogue_entry_id: string;
  asset_type: AssetType;
  version: number;
  content_hash: string;
  file_reference: string;
  status: AssetStatus;
  created_at: string;
  is_current: boolean;
}

export interface FamilyMaster {
  family_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface CategoryMaster {
  category_id: string;
  family_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface SkuCompatibility {
  compatibility_id: string;
  source_sku_id: string;
  target_sku_id: string;
  relationship_type: CompatibilityRelationship;
  directionality: Directionality;
  is_mandatory: boolean;
  status: SkuStatus;
  created_at: string;
}

export interface DesignFamilyMaster {
  design_family_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface DesignSubfamilyMaster {
  design_subfamily_id: string;
  design_family_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export enum RuleSetStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}

export interface RuleSet {
  rule_set_id: string;
  rule_set_code: string;
  version: number;
  status: RuleSetStatus;
  effective_from: string | null;
  effective_to: string | null;
  constants: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

/**
 * Joined type: SKU with its catalogue entry and RENDER asset thumbnail URL.
 * Used for SKU browser display.
 */
export interface SkuWithCatalogue {
  sku: SkuMaster;
  catalogueEntry: CatalogueEntry | null;
  thumbnailUrl: string | null;
}

// --- BOM Enums ---

export enum MasterBomStatus {
  GENERATED = 'GENERATED',
  VALIDATED = 'VALIDATED',
  APPROVED = 'APPROVED',
  INVALIDATED = 'INVALIDATED',
}

export enum ActualBomStatus {
  GENERATED = 'GENERATED',
  VALIDATED = 'VALIDATED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum ReconciliationResultType {
  UNCHANGED = 'UNCHANGED',
  QUANTITY_CHANGED = 'QUANTITY_CHANGED',
  SKU_CHANGED = 'SKU_CHANGED',
  REMOVED = 'REMOVED',
  ADDED_BY_TRIGGER = 'ADDED_BY_TRIGGER',
  UNEXPECTED = 'UNEXPECTED',
}

// --- BOM Interfaces ---

export interface MasterBom {
  master_bom_id: string;
  template_id: string;
  status: MasterBomStatus;
  generated_at: string;
  engine_version: string;
  rule_set_id: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface MasterBomLine {
  master_bom_line_id: string;
  master_bom_id: string;
  template_component_id: string;
  sku_id: string;
  product_type: ProductType;
  source_zone_id: string | null;
  source_relationship_id: string | null;
  quantity_rule: string;
  default_quantity: number;
  unit_of_measure: string;
  mandatory: boolean;
  hidden: boolean;
  calculation_parameters: Record<string, unknown>;
  parent_bom_line_id: string | null;
  created_at: string;
}

export interface ActualBom {
  actual_bom_id: string;
  project_id: string;
  snapshot_id: string;
  configuration_id: string;
  status: ActualBomStatus;
  engine_version: string;
  rule_set_id: string;
  input_hash: string;
  calculation_timestamp: string;
}

export interface ActualBomLine {
  actual_bom_line_id: string;
  actual_bom_id: string;
  master_bom_line_id: string | null;
  component_id: string;
  sku_id: string;
  product_type: ProductType;
  quantity: number;
  required_quantity: number;
  waste_factor: number;
  waste_quantity: number;
  unit_of_measure: string;
  resolved_dimensions: Record<string, unknown>;
  calculation_rule: string;
  calculation_inputs: Record<string, unknown>;
}

export interface FinalBom {
  final_bom_id: string;
  project_id: string;
  actual_bom_id: string;
  final_bom_hash: string;
  engine_version: string;
  rule_set_id: string;
  input_hash: string;
  finalized_at: string;
  finalized_by: string;
}

export interface FinalBomLine {
  final_bom_line_id: string;
  final_bom_id: string;
  actual_bom_line_id: string;
  sku_id: string;
  sku_code: string;
  product_type: ProductType;
  sku_material: string | null;
  sku_colour: string | null;
  sku_finish: string | null;
  sku_dimensions_json: Record<string, unknown> | null;
  source_zone_id: string | null;
  source_component_id: string | null;
  quantity: number;
  required_quantity: number;
  waste_quantity: number;
  unit_of_measure: string;
  resolved_dimensions: Record<string, unknown>;
  source_trace: Record<string, unknown>;
}

export interface ReconciliationLine {
  master_line: MasterBomLine | null;
  actual_line: ActualBomLine | null;
  result_type: ReconciliationResultType;
}

// --- Wall Configuration Permission Types (Amendment 001) ---

/**
 * Permission mode for consultant wall configuration parameters.
 * Rule 72: Consultant can only change parameters explicitly marked ALLOWED.
 * Rule 73: Consultant cannot manually edit panel frames.
 */
export type WallParamPermissionMode = 'LOCKED' | 'ALLOWED';

/**
 * A single consultant wall permission record stored in the database.
 */
export interface ConsultantWallPermission {
  permission_id: string;
  template_id: string;
  parameter_key: string;
  permission_mode: WallParamPermissionMode;
  created_at: string;
  updated_at: string;
}

/**
 * Template consultant permission record (v1.1.8 snapshot shape).
 */
export interface TemplateConsultantPermission {
  permission_id: string;
  template_id: string;
  parameter_key: string;
  parameter_type: string;
  edit_mode: string;
  min_value: number | null;
  max_value: number | null;
  allowed_values: unknown[] | null;
  source_component_id: string | null;
  created_at: string;
}

// --- Wall Configuration Tables (Amendment 001) ---

/**
 * Template-level wall configuration (designer-defined).
 */
export interface TemplateWallConfiguration {
  wall_config_id: string;
  template_id: string;
  wall_type: WallGeometryType;
  total_width_mm: number;
  total_height_mm: number;
  rows: number;
  columns: number;
  panel_gap_mm: number;
  fit_algorithm: string;
  fit_intensity_percent: number;
  mounting_type: string;
  /** Installation area (nullable; absent means FULL wall coverage). */
  installation_coverage?: InstallationAreaCoverage | null;
  installation_outer_edge_x_mm?: number | null;
  installation_outer_edge_y_mm?: number | null;
  installation_outer_edge_width_mm?: number | null;
  installation_outer_edge_height_mm?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Project-level wall configuration (may include consultant overrides).
 */
export interface ProjectWallConfiguration {
  project_wall_config_id: string;
  project_id: string;
  wall_type: WallGeometryType;
  total_width_mm: number;
  total_height_mm: number;
  rows: number;
  columns: number;
  panel_gap_mm: number;
  fit_algorithm: string;
  fit_intensity_percent: number;
  mounting_type: string;
  /** Installation area (nullable; absent means FULL wall coverage). */
  installation_coverage?: InstallationAreaCoverage | null;
  installation_outer_edge_x_mm?: number | null;
  installation_outer_edge_y_mm?: number | null;
  installation_outer_edge_width_mm?: number | null;
  installation_outer_edge_height_mm?: number | null;
  consultant_overrides: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * A project obstruction (protected area on wall).
 */
export interface ProjectObstruction {
  obstruction_id: string;
  project_id: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  obstruction_type: 'WINDOW' | 'DOOR' | 'PILLAR' | 'CUSTOM';
  label: string | null;
  created_at: string;
}

/**
 * A generated panel frame stored in the database.
 */
export interface GeneratedPanelFrame {
  frame_id: string;
  project_id: string;
  row_index: number;
  col_index: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  segment: string | null;
  is_edge_panel: boolean;
  generation_hash: string;
  created_at: string;
}
