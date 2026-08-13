/**
 * Shared realistic mock data factories for integration tests.
 * These fixtures simulate real project data as it flows through the BOM pipeline.
 */

import type { BomPipelineInput, SnapshotData } from '@/engines/bomPipeline';
import type { PermissionRule, CompatibilityRule } from '@/engines/validationEngine';

/**
 * Creates a straight wall snapshot with 2 zones, panels 600x1200, 3mm gaps, 5% waste.
 * Wall dimensions: 3000mm wide x 2400mm tall.
 */
export function createStraightWallSnapshot(): SnapshotData {
  return {
    zones: [
      {
        zoneId: 'zone-left',
        x: 0,
        y: 0,
        width: 1500,
        height: 2400,
        skuId: 'sku-panel-oak-001',
        panelWidth: 600,
        panelHeight: 1200,
        gapHorizontal: 3,
        gapVertical: 3,
        wasteFactor: 0.05,
      },
      {
        zoneId: 'zone-right',
        x: 1500,
        y: 0,
        width: 1500,
        height: 2400,
        skuId: 'sku-panel-oak-002',
        panelWidth: 600,
        panelHeight: 1200,
        gapHorizontal: 3,
        gapVertical: 3,
        wasteFactor: 0.05,
      },
    ],
    lighting: [
      {
        componentId: 'light-profile-strip',
        skuId: 'sku-led-profile-001',
        edges: [{ length: 3000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 600,
      },
    ],
    furniture: [
      {
        componentId: 'furn-shelf',
        skuId: 'sku-shelf-001',
        quantity: 2,
        min: 1,
        max: 4,
      },
    ],
    hiddenComponents: [
      {
        componentId: 'hidden-bracket',
        skuId: 'sku-bracket-001',
        triggerType: 'ALWAYS',
        quantityRule: 'FIXED',
        fixedValue: 4,
      },
    ],
  };
}

/**
 * Creates an L-corner wall snapshot with 3 zones across 2 segments.
 * Segment A: 2000mm, Segment B: 1500mm. Total wall width: 3500mm.
 * Corner at x=2000.
 */
export function createLCornerSnapshot(): SnapshotData {
  return {
    zones: [
      {
        zoneId: 'zone-seg-a-1',
        x: 0,
        y: 0,
        width: 1000,
        height: 2400,
        skuId: 'sku-panel-walnut-001',
        panelWidth: 500,
        panelHeight: 1200,
        gapHorizontal: 3,
        gapVertical: 3,
        wasteFactor: 0.05,
      },
      {
        zoneId: 'zone-seg-a-2',
        x: 1000,
        y: 0,
        width: 1000,
        height: 2400,
        skuId: 'sku-panel-walnut-001',
        panelWidth: 500,
        panelHeight: 1200,
        gapHorizontal: 3,
        gapVertical: 3,
        wasteFactor: 0.05,
      },
      {
        zoneId: 'zone-seg-b-1',
        x: 2000,
        y: 0,
        width: 1500,
        height: 2400,
        skuId: 'sku-panel-walnut-002',
        panelWidth: 600,
        panelHeight: 1200,
        gapHorizontal: 3,
        gapVertical: 3,
        wasteFactor: 0.05,
      },
    ],
    lighting: [
      {
        componentId: 'light-cove-a',
        skuId: 'sku-led-cove-001',
        edges: [{ length: 2000 }],
        mountingType: 'COVE',
        mode: 'LINEAR',
        unitLength: 500,
      },
      {
        componentId: 'light-direct-b',
        skuId: 'sku-led-direct-001',
        edges: [{ length: 1500 }],
        mountingType: 'DIRECT',
        mode: 'DISCRETE',
        unitLength: 300,
      },
    ],
    furniture: [
      {
        componentId: 'furn-mirror',
        skuId: 'sku-mirror-001',
        quantity: 1,
        min: 1,
        max: 2,
      },
    ],
  };
}

/**
 * Creates a multi-zone multi-SKU snapshot with 4 zones, different SKUs,
 * various panel sizes, mixed lighting (PROFILE and COVE), furniture, and hidden components.
 */
export function createMultiZoneMultiSkuSnapshot(): SnapshotData {
  return {
    zones: [
      {
        zoneId: 'zone-1',
        x: 0,
        y: 0,
        width: 800,
        height: 2400,
        skuId: 'sku-panel-marble-001',
        panelWidth: 400,
        panelHeight: 800,
        gapHorizontal: 2,
        gapVertical: 2,
        wasteFactor: 0.08,
      },
      {
        zoneId: 'zone-2',
        x: 800,
        y: 0,
        width: 700,
        height: 2400,
        skuId: 'sku-panel-wood-001',
        panelWidth: 350,
        panelHeight: 1200,
        gapHorizontal: 3,
        gapVertical: 3,
        wasteFactor: 0.05,
      },
      {
        zoneId: 'zone-3',
        x: 1500,
        y: 0,
        width: 800,
        height: 2400,
        skuId: 'sku-panel-glass-001',
        panelWidth: 400,
        panelHeight: 600,
        gapHorizontal: 4,
        gapVertical: 4,
        wasteFactor: 0.10,
      },
      {
        zoneId: 'zone-4',
        x: 2300,
        y: 0,
        width: 700,
        height: 2400,
        skuId: 'sku-panel-ceramic-001',
        panelWidth: 300,
        panelHeight: 600,
        gapHorizontal: 2,
        gapVertical: 2,
        wasteFactor: 0.06,
      },
    ],
    lighting: [
      {
        componentId: 'light-profile-main',
        skuId: 'sku-led-profile-002',
        edges: [{ length: 3000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 600,
      },
      {
        componentId: 'light-cove-accent',
        skuId: 'sku-led-cove-002',
        edges: [{ length: 1500 }, { length: 1500 }],
        mountingType: 'COVE',
        mode: 'LINEAR',
        unitLength: 500,
      },
    ],
    furniture: [
      {
        componentId: 'furn-table',
        skuId: 'sku-table-001',
        quantity: 1,
        min: 1,
        max: 2,
      },
      {
        componentId: 'furn-lamp',
        skuId: 'sku-lamp-001',
        quantity: 3,
        min: 1,
        max: 6,
      },
    ],
    hiddenComponents: [
      {
        componentId: 'hidden-rail',
        skuId: 'sku-rail-001',
        triggerType: 'ALWAYS',
        quantityRule: 'PER_ZONE',
        fixedValue: 2,
        zoneCount: 4,
      },
      {
        componentId: 'hidden-clip',
        skuId: 'sku-clip-001',
        triggerType: 'CONDITION',
        condition: { field: 'zone_count', operator: 'GTE', value: 3 },
        quantityRule: 'FIXED',
        fixedValue: 12,
        fieldValues: { zone_count: 4 },
      },
      {
        componentId: 'hidden-adhesive',
        skuId: 'sku-adhesive-002',
        triggerType: 'DEPENDENCY',
        quantityRule: 'DERIVED_FROM_PARENT',
        parentPresent: true,
        parentQuantity: 8,
      },
    ],
  };
}

/**
 * Creates consultant mode input with LOCKED/RESTRICTED/FREE permissions
 * and consultant actions that stay within bounds.
 */
export function createConsultantModeInput(): BomPipelineInput {
  const snapshotData = createStraightWallSnapshot();

  const permissions: PermissionRule[] = [
    { parameter: 'zone_width', locked: false, minValue: 500, maxValue: 2000 },
    { parameter: 'zone_height', locked: false, minValue: 1000, maxValue: 2700 },
    { parameter: 'sku_selection', locked: true },
    { parameter: 'panel_gap', locked: false, minValue: 1, maxValue: 10 },
  ];

  return {
    snapshotData,
    measurements: {
      wallWidth: 3000,
      wallHeight: 2400,
      templateWallWidth: 3000,
      templateWallHeight: 2400,
    },
    configuration: {
      consultantActions: [
        { parameter: 'zone_width', value: 1500, actionType: 'SET_VALUE' },
        { parameter: 'panel_gap', value: 3, actionType: 'SET_VALUE' },
      ],
    },
    ruleSet: {},
    permissions,
    compatibilityRules: [],
  };
}

/**
 * Creates a full pipeline input that passes all validation steps
 * and produces a final valid BOM. Used for finalisation testing.
 */
export function createFinalisationInput(): BomPipelineInput {
  return {
    snapshotData: createStraightWallSnapshot(),
    measurements: {
      wallWidth: 3000,
      wallHeight: 2400,
      templateWallWidth: 3000,
      templateWallHeight: 2400,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
  };
}

/**
 * Creates a standard BomPipelineInput for the straight wall scenario.
 */
export function createStraightWallPipelineInput(): BomPipelineInput {
  return {
    snapshotData: createStraightWallSnapshot(),
    measurements: {
      wallWidth: 3000,
      wallHeight: 2400,
      templateWallWidth: 3000,
      templateWallHeight: 2400,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
  };
}

/**
 * Creates a standard BomPipelineInput for the L-corner scenario.
 */
export function createLCornerPipelineInput(): BomPipelineInput {
  return {
    snapshotData: createLCornerSnapshot(),
    measurements: {
      wallWidth: 3500,
      wallHeight: 2400,
      templateWallWidth: 3500,
      templateWallHeight: 2400,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
  };
}

/**
 * Creates a standard BomPipelineInput for the multi-zone multi-SKU scenario.
 */
export function createMultiZoneMultiSkuPipelineInput(): BomPipelineInput {
  return {
    snapshotData: createMultiZoneMultiSkuSnapshot(),
    measurements: {
      wallWidth: 3000,
      wallHeight: 2400,
      templateWallWidth: 3000,
      templateWallHeight: 2400,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
  };
}
