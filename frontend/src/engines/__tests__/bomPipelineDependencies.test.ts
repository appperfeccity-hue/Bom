import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '../bomPipeline';
import type { BomPipelineInput } from '../bomPipeline';
import type { SkuDependencyRule } from '../skuDependencyEngine';
import { ErrorCode } from '../errorCatalogue';
import { mapSkuDependencies } from '@/lib/snapshotMapper';

function createInput(skuDependencies?: SkuDependencyRule[], extra?: Partial<BomPipelineInput['snapshotData']>): BomPipelineInput {
  return {
    snapshotData: {
      zones: [
        {
          zoneId: 'zone-1',
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          skuId: 'sku-panel-1',
          panelWidth: 300,
          panelHeight: 400,
          gapHorizontal: 5,
          gapVertical: 5,
          wasteFactor: 0.05,
        },
      ],
      lighting: [
        {
          componentId: 'light-1',
          skuId: 'sku-light-1',
          edges: [{ length: 1000 }],
          mountingType: 'COVE',
          mode: 'LINEAR',
          unitLength: 0,
        },
      ],
      skuDependencies,
      ...extra,
    },
    measurements: { wallWidth: 3000, wallHeight: 2700, templateWallWidth: 3000 },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
  };
}

const CLIP: SkuDependencyRule = {
  dependencyId: 'dep-clip',
  parentSkuId: 'sku-panel-1',
  childSkuId: 'sku-clip',
  dependencyType: 'REQUIRED',
  quantityRule: 'PER_PARENT',
  quantityFactor: 4,
  unitOfMeasure: 'PCS',
  childProductType: 'HIDDEN_COMPONENT',
};

const SCREW: SkuDependencyRule = {
  dependencyId: 'dep-screw',
  parentSkuId: 'sku-clip',
  childSkuId: 'sku-screw',
  dependencyType: 'REQUIRED',
  quantityRule: 'PER_PARENT',
  quantityFactor: 2,
  unitOfMeasure: 'PCS',
  childProductType: 'HIDDEN_COMPONENT',
};

const COVE_STRUCTURE: SkuDependencyRule = {
  dependencyId: 'dep-cove',
  parentSkuId: 'sku-light-1',
  childSkuId: 'sku-cove-structure',
  dependencyType: 'CONDITIONAL',
  condition: { field: 'mountingType', operator: 'EQ', value: 'COVE' },
  quantityRule: 'PER_LENGTH',
  quantityFactor: 1,
  unitOfMeasure: 'M',
  childProductType: 'HIDDEN_COMPONENT',
};

describe('bomPipeline SKU dependency expansion', () => {
  it('is a no-op when no dependency graph is present (backward compatibility)', () => {
    const base = runBomPipeline(createInput(undefined));
    const empty = runBomPipeline(createInput([]));
    expect(base.status).toBe('SUCCESS');
    expect(base.actualBomLines.every((l) => l.dependency === undefined)).toBe(true);
    expect(empty.actualBomLines).toEqual(base.actualBomLines);
  });

  it('expands required children after the primary lines with level/parent metadata', () => {
    const output = runBomPipeline(createInput([CLIP, SCREW]));
    expect(output.status).toBe('SUCCESS');

    const panel = output.actualBomLines.find((l) => l.skuId === 'sku-panel-1');
    const clip = output.actualBomLines.find((l) => l.skuId === 'sku-clip');
    const screw = output.actualBomLines.find((l) => l.skuId === 'sku-screw');
    expect(panel).toBeDefined();
    expect(clip).toBeDefined();
    expect(screw).toBeDefined();

    expect(clip!.dependency).toEqual({
      parentSkuId: 'sku-panel-1',
      dependencyId: 'dep-clip',
      dependencyType: 'REQUIRED',
      quantityRule: 'PER_PARENT',
      level: 1,
    });
    expect(clip!.componentId).toBe(panel!.componentId);
    expect(clip!.calculationRule).toBe('SKU_DEPENDENCY_PER_PARENT');
    expect(clip!.requiredQuantity).toBe(panel!.requiredQuantity * 4);
    expect(clip!.productType).toBe('HIDDEN_COMPONENT');

    expect(screw!.dependency?.level).toBe(2);
    expect(screw!.dependency?.parentSkuId).toBe('sku-clip');
    expect(screw!.requiredQuantity).toBe(clip!.requiredQuantity * 2);

    // Primary lines come first, children afterwards
    const idx = (skuId: string) => output.actualBomLines.findIndex((l) => l.skuId === skuId);
    expect(idx('sku-panel-1')).toBeLessThan(idx('sku-clip'));
    expect(idx('sku-clip')).toBeLessThan(idx('sku-screw'));
  });

  it('evaluates conditional rules against the parent light context', () => {
    const cove = runBomPipeline(createInput([COVE_STRUCTURE]));
    expect(cove.status).toBe('SUCCESS');
    const structure = cove.actualBomLines.find((l) => l.skuId === 'sku-cove-structure');
    expect(structure).toBeDefined();
    expect(structure!.requiredQuantity).toBe(1); // ceil(1.0 m * 1)
    expect(structure!.unitOfMeasure).toBe('M');

    const direct = runBomPipeline(
      createInput([COVE_STRUCTURE], {
        lighting: [
          { componentId: 'light-1', skuId: 'sku-light-1', edges: [{ length: 1000 }], mountingType: 'DIRECT', mode: 'LINEAR', unitLength: 0 },
        ],
      }),
    );
    expect(direct.actualBomLines.find((l) => l.skuId === 'sku-cove-structure')).toBeUndefined();
  });

  it('includes optional children only when selected for the component', () => {
    const optional: SkuDependencyRule = { ...CLIP, dependencyId: 'dep-opt', childSkuId: 'sku-led', dependencyType: 'OPTIONAL' };
    const not = runBomPipeline(createInput([optional]));
    expect(not.actualBomLines.find((l) => l.skuId === 'sku-led')).toBeUndefined();

    const panelComponent = not.actualBomLines.find((l) => l.skuId === 'sku-panel-1')!.componentId;
    const selected = runBomPipeline(createInput([optional], { selectedOptionalSkus: { [panelComponent]: ['sku-led'] } }));
    expect(selected.actualBomLines.find((l) => l.skuId === 'sku-led')).toBeDefined();
  });

  it('blocks the BOM on a circular dependency', () => {
    const output = runBomPipeline(
      createInput([CLIP, { ...SCREW, childSkuId: 'sku-panel-1', dependencyId: 'dep-back' }]),
    );
    expect(output.status).toBe('BLOCKED');
    expect(output.actualBomLines).toHaveLength(0);
    expect(output.errors.some((e) => e.code === ErrorCode.DEP_CIRCULAR_DEPENDENCY)).toBe(true);
  });

  it('does not merge dependency lines across different parents', () => {
    const shared: SkuDependencyRule[] = [
      CLIP,
      { ...CLIP, dependencyId: 'dep-clip-light', parentSkuId: 'sku-light-1', quantityRule: 'FIXED', quantityFactor: 2 },
    ];
    const output = runBomPipeline(createInput(shared));
    const clips = output.actualBomLines.filter((l) => l.skuId === 'sku-clip');
    expect(clips.length).toBeGreaterThanOrEqual(2);
    expect(new Set(clips.map((l) => l.dependency?.parentSkuId))).toEqual(new Set(['sku-panel-1', 'sku-light-1']));
  });
});

describe('snapshotMapper.mapSkuDependencies', () => {
  it('maps frozen rows into engine rules and drops malformed rows', () => {
    const rules = mapSkuDependencies([
      {
        dependency_id: 'd1',
        parent_sku_id: 'p',
        child_sku_id: 'c',
        dependency_type: 'CONDITIONAL',
        condition: { field: 'mountingType', operator: 'EQ', value: 'COVE' },
        quantity_rule: 'PER_LENGTH',
        quantity_factor: '1.5',
        unit_of_measure: 'M',
        status: 'ACTIVE',
        child_sku: { sku_id: 'c', product_type: 'HIDDEN_COMPONENT' },
      },
      { dependency_id: 'bad', parent_sku_id: 'p', child_sku_id: 'c', dependency_type: 'NOPE', quantity_rule: 'PER_PARENT', child_sku: { product_type: 'LIGHT' } },
      { dependency_id: 'no-child-type', parent_sku_id: 'p', child_sku_id: 'c', dependency_type: 'REQUIRED', quantity_rule: 'PER_PARENT' },
      null,
    ]);
    expect(rules).toEqual([
      {
        dependencyId: 'd1',
        parentSkuId: 'p',
        childSkuId: 'c',
        dependencyType: 'CONDITIONAL',
        condition: { field: 'mountingType', operator: 'EQ', value: 'COVE' },
        quantityRule: 'PER_LENGTH',
        quantityFactor: 1.5,
        unitOfMeasure: 'M',
        childProductType: 'HIDDEN_COMPONENT',
      },
    ]);
  });

  it('returns [] for missing data', () => {
    expect(mapSkuDependencies(undefined)).toEqual([]);
  });
});
