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
  FIXED = 'FIXED',
  FILL = 'FILL',
  PROPORTIONAL = 'PROPORTIONAL',
}

export enum ZoneHeightStrategy {
  FIXED = 'FIXED',
  FILL = 'FILL',
  PROPORTIONAL = 'PROPORTIONAL',
}

export enum ZonePositionStrategy {
  ABSOLUTE = 'ABSOLUTE',
  RELATIVE = 'RELATIVE',
  AUTO = 'AUTO',
}

export enum TemplateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

export enum AdaptationStrategy {
  SCALE = 'SCALE',
  REFLOW = 'REFLOW',
  CLIP = 'CLIP',
}

export type WallGeometry = 'STRAIGHT' | 'L_CORNER';

// --- Database Row Interfaces ---

export interface Template {
  id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  wall_geometry: WallGeometry;
  base_width_mm: number;
  base_height_mm: number;
  adaptation_strategy: AdaptationStrategy;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface TemplateZone {
  id: string;
  template_id: string;
  name: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  width_strategy: ZoneWidthStrategy;
  height_strategy: ZoneHeightStrategy;
  position_strategy: ZonePositionStrategy;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateZoneSku {
  id: string;
  zone_id: string;
  sku_id: string;
  created_at: string;
}

export interface TemplateLighting {
  id: string;
  template_id: string;
  name: string;
  type: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateFurniture {
  id: string;
  template_id: string;
  name: string;
  type: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  rotation_deg: number;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateTrim {
  id: string;
  template_id: string;
  name: string;
  type: string;
  path_mm: Array<{ x: number; y: number }>;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  template_id: string;
  status: ProjectStatus;
  client_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  template_id: string;
  snapshot_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  version: number;
}

export interface ProjectMeasurement {
  id: string;
  project_id: string;
  wall_width_mm: number;
  wall_height_mm: number;
  wall_geometry: WallGeometry;
  segment_a_width_mm: number | null;
  segment_b_width_mm: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectConfiguration {
  id: string;
  project_id: string;
  snapshot_id: string;
  zone_configurations: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  version: number;
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
