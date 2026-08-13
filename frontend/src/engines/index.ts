/**
 * Quantity Resolution Engines
 *
 * Pure TypeScript calculation modules for BOM quantity resolution.
 * No side effects, no DB calls, no external dependencies.
 */

export { calculateWallPanels } from './wallPanelEngine';
export { calculateLights } from './lightEngine';
export { calculateFurniture } from './furnitureEngine';
export { calculateHiddenComponent } from './hiddenComponentEngine';
export { adaptZonesToSite } from './siteAdaptationEngine';
export { generatePanelFrames } from './wallConfigEngine';
export { EngineError } from './types';
export type {
  WallPanelInput,
  WallPanelOutput,
  LightInput,
  LightOutput,
  LightEdge,
  MountingType,
  LightMode,
  FurnitureInput,
  FurnitureOutput,
  HiddenComponentInput,
  HiddenComponentOutput,
  HiddenComponentCondition,
  TriggerType,
  ConditionOperator,
  QuantityRule,
  SiteAdaptationStrategy,
  HeightMode,
  SiteAdaptationZoneInput,
  SiteAdaptationInput,
  SiteAdaptationZoneOutput,
  SiteAdaptationOutput,
  WallConfigInput,
  PanelFrame,
  WallType,
  FitAlgorithm,
  WallMountingType,
  ObstructionType,
  Obstruction,
  WallSegment,
} from './types';

// --- Error Catalogue ---
export {
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  ERROR_DEFINITIONS,
  createPipelineError,
} from './errorCatalogue';
export type { PipelineError } from './errorCatalogue';

// --- Validation Engine ---
export {
  validatePermissions,
  checkCompatibility,
  validateGeometry,
  validateConstruction,
  validateBom,
} from './validationEngine';
export type {
  ValidationResult,
  PermissionRule,
  ConsultantAction,
  SkuPair,
  CompatibilityRule,
  GeometryZone,
  WallDimensions,
  ConstructionLine,
  ConstructionRule,
  BomValidationLine,
} from './validationEngine';

// --- BOM Pipeline ---
export { runBomPipeline } from './bomPipeline';
export type {
  BomPipelineInput,
  BomPipelineOutput,
  BomPipelineStatus,
  BomOutputLine,
  SnapshotData,
  SnapshotZone,
  SnapshotLighting,
  SnapshotFurniture,
  SnapshotHiddenComponent,
  BomMeasurements,
  BomConfiguration,
  BomRuleSet,
} from './bomPipeline';
