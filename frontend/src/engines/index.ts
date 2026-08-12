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
} from './types';
