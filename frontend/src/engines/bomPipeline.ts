/**
 * BOM Pipeline Orchestration
 *
 * Executes the full BOM generation pipeline in 8 sequential steps.
 * If any step produces BLOCKING errors, the pipeline stops and returns BLOCKED.
 * Warnings accumulate across all steps.
 */

import { ErrorCode, PipelineError, createPipelineError } from './errorCatalogue';
import {
  PermissionRule,
  ConsultantAction,
  SkuPair,
  CompatibilityRule,
  GeometryZone,
  WallDimensions,
  ConstructionLine,
  ConstructionRule,
  BomValidationLine,
  validatePermissions,
  checkCompatibility,
  validateGeometry,
  validateConstruction,
  validateBom,
} from './validationEngine';
import { adaptZonesToSite } from './siteAdaptationEngine';
import { calculateWallPanels } from './wallPanelEngine';
import { calculateLights } from './lightEngine';
import { calculateFurniture } from './furnitureEngine';
import { calculateHiddenComponent } from './hiddenComponentEngine';
import type {
  SiteAdaptationInput,
  SiteAdaptationZoneInput,
  WallPanelInput,
  LightInput,
  FurnitureInput,
  HiddenComponentInput,
} from './types';

// --- Types ---

export interface BomOutputLine {
  lineId: string;
  componentId: string;
  skuId: string;
  quantity: number;
  requiredQuantity: number;
  wasteQuantity: number;
  unitOfMeasure: string;
  calculationRule: string;
}

export interface SnapshotZone {
  zoneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  skuId: string;
  panelWidth?: number;
  panelHeight?: number;
  gapHorizontal?: number;
  gapVertical?: number;
  wasteFactor?: number;
  widthStrategy?: 'LOCKED' | 'RESIZABLE';
  minWidth?: number;
  maxWidth?: number;
  heightMode?: 'DERIVED_FROM_WALL' | 'FIXED' | 'RESIZABLE';
  minHeight?: number;
  maxHeight?: number;
}

export interface SnapshotLighting {
  componentId: string;
  skuId: string;
  edges: Array<{ length: number }>;
  mountingType: 'DIRECT' | 'PROFILE' | 'COVE';
  mode: 'DISCRETE' | 'LINEAR';
  unitLength: number;
}

export interface SnapshotFurniture {
  componentId: string;
  skuId: string;
  quantity: number;
  min: number;
  max: number;
}

export interface SnapshotHiddenComponent {
  componentId: string;
  skuId: string;
  triggerType: 'ALWAYS' | 'CONDITION' | 'DEPENDENCY';
  condition?: {
    field: string;
    operator: 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE';
    value: number | string;
  };
  quantityRule: 'FIXED' | 'PER_ZONE' | 'PER_PANEL' | 'DERIVED_FROM_PARENT';
  fixedValue?: number;
  parentQuantity?: number;
  zoneCount?: number;
  panelCount?: number;
  parentPresent?: boolean;
  fieldValues?: Record<string, number | string>;
}

export interface SnapshotData {
  zones: SnapshotZone[];
  lighting?: SnapshotLighting[];
  furniture?: SnapshotFurniture[];
  hiddenComponents?: SnapshotHiddenComponent[];
  /** Generated panel frames from wallConfigEngine (Amendment 001). When present, these override zone dimensions for panel calculation. */
  generatedPanelFrames?: SnapshotPanelFrame[];
}

/**
 * A generated panel frame from the wall config engine, stored in the snapshot.
 * When present, each frame's width_mm/height_mm become the W/H for wall panel calculation.
 * Rule 63: panel_gap_mm is the structural gap between frames, independent from SKU gh_mm/gv_mm.
 */
export interface SnapshotPanelFrame {
  frameId: string;
  rowIndex: number;
  colIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  segment: string | null;
  isEdgePanel: boolean;
  /** SKU ID assigned to this frame (inherited from zone or directly assigned) */
  skuId?: string;
  /** Panel width from SKU */
  panelWidth?: number;
  /** Panel height from SKU */
  panelHeight?: number;
  /** Horizontal gap from SKU (gh_mm) - NOT the same as panel_gap_mm (Rule 63) */
  gapHorizontal?: number;
  /** Vertical gap from SKU (gv_mm) - NOT the same as panel_gap_mm (Rule 63) */
  gapVertical?: number;
  /** Waste factor */
  wasteFactor?: number;
}

export interface BomMeasurements {
  wallWidth: number;
  wallHeight: number;
  templateWallWidth: number;
  templateWallHeight?: number;
}

export interface BomConfiguration {
  consultantActions?: ConsultantAction[];
  selectedSkuPairs?: SkuPair[];
  maxZoneCount?: number;
  minZoneDimension?: number;
  maxAspectRatio?: number;
  maxZoneDimension?: number;
  minGap?: number;
  maxGap?: number;
  minPanelDimension?: number;
  maxPanelDimension?: number;
  minRetainedWidth?: number;
  checkTotalDimensions?: boolean;
}

export interface BomRuleSet {
  constructionRules?: ConstructionRule[];
  constants?: Record<string, unknown>;
}

export interface BomPipelineInput {
  snapshotData: SnapshotData;
  measurements: BomMeasurements;
  configuration: BomConfiguration;
  ruleSet: BomRuleSet;
  permissions: PermissionRule[];
  compatibilityRules: CompatibilityRule[];
}

export type BomPipelineStatus = 'SUCCESS' | 'BLOCKED';

export interface BomPipelineOutput {
  actualBomLines: BomOutputLine[];
  errors: PipelineError[];
  warnings: PipelineError[];
  status: BomPipelineStatus;
}

// --- Pipeline ---

/**
 * Executes the full BOM pipeline in 8 sequential steps:
 * 1. Permission Validation
 * 2. Site Adaptation
 * 3. SKU Compatibility Check
 * 4. Geometry Validation
 * 5. Construction Validation
 * 6. Quantity Calculation
 * 7. BOM Reconciliation
 * 8. Final BOM Validation
 *
 * If any step returns BLOCKING errors, the pipeline stops immediately.
 */
export function runBomPipeline(input: BomPipelineInput): BomPipelineOutput {
  const accumulatedWarnings: PipelineError[] = [];
  const bomLines: BomOutputLine[] = [];

  // --- Step 1: Permission Validation ---
  if (input.configuration.consultantActions && input.configuration.consultantActions.length > 0) {
    const permResult = validatePermissions(
      input.permissions,
      input.configuration.consultantActions
    );
    accumulatedWarnings.push(...permResult.warnings);
    if (!permResult.passed) {
      return {
        actualBomLines: [],
        errors: permResult.errors,
        warnings: accumulatedWarnings,
        status: 'BLOCKED',
      };
    }
  }

  // --- Step 2: Site Adaptation ---
  let adaptedZones: AdaptedZone[];
  try {
    adaptedZones = runSiteAdaptation(input);
  } catch {
    // If adaptation fails (e.g., invalid wall dimensions), produce a BLOCKED result
    return {
      actualBomLines: [],
      errors: [
        createPipelineError(ErrorCode.GEO_WALL_DIMENSION_INVALID, {
          wallWidth: input.measurements.wallWidth,
          wallHeight: input.measurements.wallHeight,
        }),
      ],
      warnings: accumulatedWarnings,
      status: 'BLOCKED',
    };
  }

  // --- Step 3: SKU Compatibility Check ---
  if (
    input.configuration.selectedSkuPairs &&
    input.configuration.selectedSkuPairs.length > 0
  ) {
    const compatResult = checkCompatibility(
      input.configuration.selectedSkuPairs,
      input.compatibilityRules
    );
    accumulatedWarnings.push(...compatResult.warnings);
    if (!compatResult.passed) {
      return {
        actualBomLines: [],
        errors: compatResult.errors,
        warnings: accumulatedWarnings,
        status: 'BLOCKED',
      };
    }
  }

  // --- Step 4: Geometry Validation ---
  const geometryZones: GeometryZone[] = adaptedZones.map((z) => ({
    zoneId: z.zoneId,
    x: z.x,
    y: z.y,
    width: z.width,
    height: z.height,
    panelWidth: z.panelWidth,
    panelHeight: z.panelHeight,
    gapHorizontal: z.gapHorizontal,
    gapVertical: z.gapVertical,
  }));

  const wallDimensions: WallDimensions = {
    width: input.measurements.wallWidth,
    height: input.measurements.wallHeight,
    maxZoneCount: input.configuration.maxZoneCount,
    minZoneDimension: input.configuration.minZoneDimension,
    maxAspectRatio: input.configuration.maxAspectRatio,
    maxZoneDimension: input.configuration.maxZoneDimension,
    minGap: input.configuration.minGap,
    maxGap: input.configuration.maxGap,
    minPanelDimension: input.configuration.minPanelDimension,
    maxPanelDimension: input.configuration.maxPanelDimension,
    minRetainedWidth: input.configuration.minRetainedWidth,
    checkTotalDimensions: input.configuration.checkTotalDimensions,
  };

  const geoResult = validateGeometry(geometryZones, wallDimensions);
  accumulatedWarnings.push(...geoResult.warnings);
  if (!geoResult.passed) {
    return {
      actualBomLines: [],
      errors: geoResult.errors,
      warnings: accumulatedWarnings,
      status: 'BLOCKED',
    };
  }

  // --- Step 5: Construction Validation ---
  const constructionLines: ConstructionLine[] = buildConstructionLines(input, adaptedZones);
  const constructionRules = input.ruleSet.constructionRules ?? [];

  if (constructionRules.length > 0) {
    const constResult = validateConstruction(constructionLines, constructionRules);
    accumulatedWarnings.push(...constResult.warnings);
    if (!constResult.passed) {
      return {
        actualBomLines: [],
        errors: constResult.errors,
        warnings: accumulatedWarnings,
        status: 'BLOCKED',
      };
    }
  }

  // --- Step 6: Quantity Calculation ---
  const quantityResult = runQuantityCalculation(input, adaptedZones);
  if (quantityResult.errors.length > 0) {
    return {
      actualBomLines: [],
      errors: quantityResult.errors,
      warnings: [...accumulatedWarnings, ...quantityResult.warnings],
      status: 'BLOCKED',
    };
  }
  accumulatedWarnings.push(...quantityResult.warnings);
  bomLines.push(...quantityResult.lines);

  // --- Step 7: BOM Reconciliation ---
  const reconciledLines = reconcileBomLines(bomLines);

  // --- Step 8: Final BOM Validation ---
  const validationLines: BomValidationLine[] = reconciledLines.map((l) => ({
    lineId: l.lineId,
    skuId: l.skuId,
    quantity: l.quantity,
    requiredQuantity: l.requiredQuantity,
  }));

  const finalResult = validateBom(validationLines);
  accumulatedWarnings.push(...finalResult.warnings);
  if (!finalResult.passed) {
    return {
      actualBomLines: [],
      errors: finalResult.errors,
      warnings: accumulatedWarnings,
      status: 'BLOCKED',
    };
  }

  return {
    actualBomLines: reconciledLines,
    errors: [],
    warnings: accumulatedWarnings,
    status: 'SUCCESS',
  };
}

// --- Internal Helpers ---

interface AdaptedZone {
  zoneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  skuId: string;
  panelWidth?: number;
  panelHeight?: number;
  gapHorizontal?: number;
  gapVertical?: number;
  wasteFactor?: number;
}

function runSiteAdaptation(input: BomPipelineInput): AdaptedZone[] {
  const { snapshotData, measurements } = input;

  // If template and actual wall are the same, no adaptation needed
  if (measurements.wallWidth === measurements.templateWallWidth) {
    return snapshotData.zones.map((z) => ({
      zoneId: z.zoneId,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      skuId: z.skuId,
      panelWidth: z.panelWidth,
      panelHeight: z.panelHeight,
      gapHorizontal: z.gapHorizontal,
      gapVertical: z.gapVertical,
      wasteFactor: z.wasteFactor,
    }));
  }

  const adaptationZones: SiteAdaptationZoneInput[] = snapshotData.zones.map(
    (z, idx) => ({
      zone_id: idx + 1,
      width_mm: z.width,
      width_strategy: z.widthStrategy ?? 'RESIZABLE',
      min_width: z.minWidth,
      max_width: z.maxWidth,
      height_mm: z.height,
      height_mode: z.heightMode,
      min_height: z.minHeight,
      max_height: z.maxHeight,
    })
  );

  const adaptationInput: SiteAdaptationInput = {
    template_wall_width: measurements.templateWallWidth,
    actual_wall_width: measurements.wallWidth,
    zones: adaptationZones,
    strategy: 'PROPORTIONAL',
    template_wall_height: measurements.templateWallHeight,
    actual_wall_height: measurements.wallHeight,
  };

  const adaptationOutput = adaptZonesToSite(adaptationInput);

  return snapshotData.zones.map((z, idx) => {
    const adapted = adaptationOutput.adapted_zones.find(
      (az) => az.zone_id === idx + 1
    );
    return {
      zoneId: z.zoneId,
      x: z.x,
      y: z.y,
      width: adapted?.adapted_width_mm ?? z.width,
      height: adapted?.adapted_height_mm ?? z.height,
      skuId: z.skuId,
      panelWidth: z.panelWidth,
      panelHeight: z.panelHeight,
      gapHorizontal: z.gapHorizontal,
      gapVertical: z.gapVertical,
      wasteFactor: z.wasteFactor,
    };
  });
}

function buildConstructionLines(
  input: BomPipelineInput,
  _adaptedZones: AdaptedZone[]
): ConstructionLine[] {
  const lines: ConstructionLine[] = [];

  // Build construction lines from zones
  for (const zone of input.snapshotData.zones) {
    lines.push({
      componentId: zone.zoneId,
      skuId: zone.skuId,
      isPresent: true,
      isMandatory: true,
    });
  }

  return lines;
}

interface QuantityCalculationResult {
  lines: BomOutputLine[];
  errors: PipelineError[];
  warnings: PipelineError[];
}

function runQuantityCalculation(
  input: BomPipelineInput,
  adaptedZones: AdaptedZone[]
): QuantityCalculationResult {
  const lines: BomOutputLine[] = [];
  const errors: PipelineError[] = [];
  const warnings: PipelineError[] = [];

  // When generated panel frames are present (Amendment 001), use frame dimensions
  // as W and H for wall panel calculation instead of zone dimensions.
  // Rule 63: panel_gap_mm is structural gap between frames; SKU gh_mm/gv_mm are joint gaps.
  const panelFrames = input.snapshotData.generatedPanelFrames;

  if (panelFrames && panelFrames.length > 0) {
    // Use panel frames for wall panel calculations
    for (const frame of panelFrames) {
      if (!frame.panelWidth || !frame.panelHeight) continue;

      const panelInput: WallPanelInput = {
        W: frame.width,
        H: frame.height,
        w: frame.panelWidth,
        h: frame.panelHeight,
        gh: frame.gapHorizontal ?? 0,
        gv: frame.gapVertical ?? 0,
        wasteFactor: frame.wasteFactor ?? 0.05,
      };

      try {
        const panelOutput = calculateWallPanels(panelInput);
        lines.push({
          lineId: `panel-${frame.frameId}`,
          componentId: frame.frameId,
          skuId: frame.skuId ?? '',
          quantity: panelOutput.procurementQuantity,
          requiredQuantity: panelOutput.requiredQuantity,
          wasteQuantity: panelOutput.wasteQuantity,
          unitOfMeasure: 'PCS',
          calculationRule: 'WALL_PANEL',
        });
      } catch {
        errors.push(
          createPipelineError(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT, {
            frameId: frame.frameId,
            width: frame.width,
            height: frame.height,
            panelWidth: frame.panelWidth,
            panelHeight: frame.panelHeight,
          })
        );
      }
    }
  } else {
    // Fallback: use adapted zones for wall panel calculations (legacy path)
    for (const zone of adaptedZones) {
      if (!zone.panelWidth || !zone.panelHeight) continue;

      const panelInput: WallPanelInput = {
        W: zone.width,
        H: zone.height,
        w: zone.panelWidth,
        h: zone.panelHeight,
        gh: zone.gapHorizontal ?? 0,
        gv: zone.gapVertical ?? 0,
        wasteFactor: zone.wasteFactor ?? 0.05,
      };

      try {
        const panelOutput = calculateWallPanels(panelInput);
        lines.push({
          lineId: `panel-${zone.zoneId}`,
          componentId: zone.zoneId,
          skuId: zone.skuId,
          quantity: panelOutput.procurementQuantity,
          requiredQuantity: panelOutput.requiredQuantity,
          wasteQuantity: panelOutput.wasteQuantity,
          unitOfMeasure: 'PCS',
          calculationRule: 'WALL_PANEL',
        });
      } catch {
        errors.push(
          createPipelineError(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT, {
            zoneId: zone.zoneId,
            width: zone.width,
            height: zone.height,
            panelWidth: zone.panelWidth,
            panelHeight: zone.panelHeight,
          })
        );
      }
    }
  }

  // Lighting calculations
  if (input.snapshotData.lighting) {
    for (const light of input.snapshotData.lighting) {
      const lightInput: LightInput = {
        edges: light.edges,
        mountingType: light.mountingType,
        mode: light.mode,
        unitLength: light.unitLength,
      };

      try {
        const lightOutput = calculateLights(lightInput);
        lines.push({
          lineId: `light-${light.componentId}`,
          componentId: light.componentId,
          skuId: light.skuId,
          quantity: lightOutput.quantity,
          requiredQuantity: lightOutput.quantity,
          wasteQuantity: 0,
          unitOfMeasure: light.mode === 'LINEAR' ? 'MM' : 'PCS',
          calculationRule: 'LIGHT',
        });
      } catch {
        // Light calculation failure is a warning, not blocking
        warnings.push(
          createPipelineError(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT, {
            componentId: light.componentId,
            type: 'LIGHT',
          })
        );
      }
    }
  }

  // Furniture calculations
  if (input.snapshotData.furniture) {
    for (const item of input.snapshotData.furniture) {
      const furnitureInput: FurnitureInput = {
        quantity: item.quantity,
        min: item.min,
        max: item.max,
        skuId: item.skuId,
      };

      const furnitureOutput = calculateFurniture(furnitureInput);
      if (!furnitureOutput.omitted) {
        lines.push({
          lineId: `furniture-${item.componentId}`,
          componentId: item.componentId,
          skuId: item.skuId,
          quantity: furnitureOutput.quantity,
          requiredQuantity: furnitureOutput.quantity,
          wasteQuantity: 0,
          unitOfMeasure: 'PCS',
          calculationRule: 'FURNITURE',
        });
      }
    }
  }

  // Hidden component calculations
  if (input.snapshotData.hiddenComponents) {
    for (const comp of input.snapshotData.hiddenComponents) {
      const hiddenInput: HiddenComponentInput = {
        triggerType: comp.triggerType,
        condition: comp.condition,
        quantityRule: comp.quantityRule,
        fixedValue: comp.fixedValue,
        parentQuantity: comp.parentQuantity,
        zoneCount: comp.zoneCount,
        panelCount: comp.panelCount,
        parentPresent: comp.parentPresent,
        fieldValues: comp.fieldValues,
      };

      const hiddenOutput = calculateHiddenComponent(hiddenInput);
      if (hiddenOutput.included) {
        lines.push({
          lineId: `hidden-${comp.componentId}`,
          componentId: comp.componentId,
          skuId: comp.skuId,
          quantity: hiddenOutput.quantity,
          requiredQuantity: hiddenOutput.quantity,
          wasteQuantity: 0,
          unitOfMeasure: 'PCS',
          calculationRule: 'HIDDEN_COMPONENT',
        });
      }
    }
  }

  return { lines, errors, warnings };
}

function reconcileBomLines(lines: BomOutputLine[]): BomOutputLine[] {
  // Group lines by skuId, calculationRule, AND componentId to preserve per-zone traceability
  const mergedMap = new Map<string, BomOutputLine>();

  for (const line of lines) {
    const key = `${line.skuId}-${line.calculationRule}-${line.componentId}`;
    const existing = mergedMap.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      existing.requiredQuantity += line.requiredQuantity;
      existing.wasteQuantity += line.wasteQuantity;
    } else {
      mergedMap.set(key, { ...line });
    }
  }

  return Array.from(mergedMap.values());
}
