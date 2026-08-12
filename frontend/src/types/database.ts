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

export interface SkuMaster {
  id: string;
  sku_code: string;
  name: string;
  brand: string;
  category: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  image_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CatalogueEntry {
  id: string;
  sku_id: string;
  catalogue_id: string;
  position: number;
  created_at: string;
}
