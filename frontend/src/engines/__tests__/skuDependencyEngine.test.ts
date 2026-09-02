import { describe, it, expect } from 'vitest';
import {
  resolveSkuDependencies,
  detectDependencyCycles,
  indexDependencyRules,
} from '../skuDependencyEngine';
import type { SkuDependencyRule, DependencyParentContext } from '../skuDependencyEngine';
import { ErrorCode } from '../errorCatalogue';

function rule(overrides: Partial<SkuDependencyRule> & Pick<SkuDependencyRule, 'dependencyId' | 'parentSkuId' | 'childSkuId'>): SkuDependencyRule {
  return {
    dependencyType: 'REQUIRED',
    quantityRule: 'PER_PARENT',
    quantityFactor: 1,
    unitOfMeasure: 'PCS',
    childProductType: 'HIDDEN_COMPONENT',
    ...overrides,
  };
}

function parent(overrides?: Partial<DependencyParentContext>): DependencyParentContext {
  return {
    componentId: 'zone-1',
    skuId: 'PANEL',
    quantity: 10,
    areaMm2: 2_500_000, // 2.5 m²
    edgeLengthMm: 6_400, // 6.4 m
    edgeCount: 4,
    fieldValues: { mountingType: 'COVE' },
    ...overrides,
  };
}

describe('skuDependencyEngine', () => {
  describe('indexDependencyRules', () => {
    it('groups by parent and orders children deterministically', () => {
      const idx = indexDependencyRules([
        rule({ dependencyId: 'd2', parentSkuId: 'P', childSkuId: 'B' }),
        rule({ dependencyId: 'd1', parentSkuId: 'P', childSkuId: 'A' }),
        rule({ dependencyId: 'd3', parentSkuId: 'Q', childSkuId: 'C' }),
      ]);
      expect(idx.get('P')?.map((r) => r.childSkuId)).toEqual(['A', 'B']);
      expect(idx.get('Q')?.map((r) => r.childSkuId)).toEqual(['C']);
    });
  });

  describe('REQUIRED', () => {
    it('expands a direct required child PER_PARENT', () => {
      const out = resolveSkuDependencies(
        [parent()],
        [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'CLIP', quantityFactor: 4 })],
      );
      expect(out.errors).toHaveLength(0);
      expect(out.lines).toHaveLength(1);
      expect(out.lines[0]).toMatchObject({
        skuId: 'CLIP',
        parentSkuId: 'PANEL',
        dependencyId: 'd1',
        level: 1,
        quantity: 40,
        componentId: 'zone-1',
        productType: 'HIDDEN_COMPONENT',
      });
    });

    it('expands nested dependencies with increasing level and parent quantity', () => {
      const out = resolveSkuDependencies(
        [parent({ quantity: 3 })],
        [
          rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'RAIL', quantityFactor: 2 }),
          rule({ dependencyId: 'd2', parentSkuId: 'RAIL', childSkuId: 'SCREW', quantityFactor: 5 }),
        ],
      );
      expect(out.lines.map((l) => [l.skuId, l.level, l.quantity, l.parentSkuId])).toEqual([
        ['RAIL', 1, 6, 'PANEL'],
        ['SCREW', 2, 30, 'RAIL'],
      ]);
    });

    it('skips parents with no quantity or no sku', () => {
      const rules = [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'CLIP' })];
      expect(resolveSkuDependencies([parent({ quantity: 0 })], rules).lines).toHaveLength(0);
      expect(resolveSkuDependencies([parent({ skuId: '' })], rules).lines).toHaveLength(0);
    });

    it('returns nothing when there are no rules', () => {
      const out = resolveSkuDependencies([parent()], []);
      expect(out).toEqual({ lines: [], errors: [], warnings: [] });
    });
  });

  describe('quantity rules', () => {
    it('PER_AREA uses root area in m² and rounds up', () => {
      const out = resolveSkuDependencies(
        [parent()],
        [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'ADHESIVE', quantityRule: 'PER_AREA', quantityFactor: 1.5, unitOfMeasure: 'M2' })],
      );
      expect(out.lines[0].quantity).toBe(4); // ceil(2.5 * 1.5) = 4
      expect(out.lines[0].unitOfMeasure).toBe('M2');
    });

    it('PER_LENGTH uses root edge length in metres and rounds up', () => {
      const out = resolveSkuDependencies(
        [parent()],
        [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'TRIM', quantityRule: 'PER_LENGTH', quantityFactor: 1 })],
      );
      expect(out.lines[0].quantity).toBe(7); // ceil(6.4)
    });

    it('PER_EDGE uses root edge count', () => {
      const out = resolveSkuDependencies(
        [parent()],
        [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'CORNER', quantityRule: 'PER_EDGE', quantityFactor: 2 })],
      );
      expect(out.lines[0].quantity).toBe(8);
    });

    it('FIXED ignores parent quantity', () => {
      const out = resolveSkuDependencies(
        [parent({ quantity: 99 })],
        [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'KIT', quantityRule: 'FIXED', quantityFactor: 1 })],
      );
      expect(out.lines[0].quantity).toBe(1);
    });

    it('nested children inherit root geometry for PER_AREA', () => {
      const out = resolveSkuDependencies(
        [parent()],
        [
          rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'RAIL' }),
          rule({ dependencyId: 'd2', parentSkuId: 'RAIL', childSkuId: 'GLUE', quantityRule: 'PER_AREA', quantityFactor: 2 }),
        ],
      );
      expect(out.lines.find((l) => l.skuId === 'GLUE')?.quantity).toBe(5);
    });

    it.each([
      ['PER_AREA', 'areaMm2'],
      ['PER_LENGTH', 'edgeLengthMm'],
      ['PER_EDGE', 'edgeCount'],
    ] as const)('%s without context is a blocking DEP_CONTEXT_MISSING error', (quantityRule, missing) => {
      const out = resolveSkuDependencies(
        [parent({ areaMm2: undefined, edgeLengthMm: undefined, edgeCount: undefined })],
        [rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'X', quantityRule })],
      );
      expect(out.lines).toHaveLength(0);
      expect(out.errors).toHaveLength(1);
      expect(out.errors[0].code).toBe(ErrorCode.DEP_CONTEXT_MISSING);
      expect(out.errors[0].context).toMatchObject({ missing, quantityRule });
    });
  });

  describe('CONDITIONAL', () => {
    const condRule = rule({
      dependencyId: 'd1',
      parentSkuId: 'PANEL',
      childSkuId: 'COVE_STRUCT',
      dependencyType: 'CONDITIONAL',
      condition: { field: 'mountingType', operator: 'EQ', value: 'COVE' },
    });

    it('includes the child when the condition holds', () => {
      const out = resolveSkuDependencies([parent()], [condRule]);
      expect(out.lines).toHaveLength(1);
      expect(out.warnings).toHaveLength(0);
    });

    it('excludes the child when the condition fails', () => {
      const out = resolveSkuDependencies([parent({ fieldValues: { mountingType: 'DIRECT' } })], [condRule]);
      expect(out.lines).toHaveLength(0);
      expect(out.warnings).toHaveLength(0);
    });

    it('warns (non-blocking) when the condition field is unresolved', () => {
      const out = resolveSkuDependencies([parent({ fieldValues: {} })], [condRule]);
      expect(out.lines).toHaveLength(0);
      expect(out.errors).toHaveLength(0);
      expect(out.warnings).toHaveLength(1);
      expect(out.warnings[0].code).toBe(ErrorCode.DEP_CONDITION_UNRESOLVED);
    });

    it('supports numeric comparisons', () => {
      const gt = rule({
        dependencyId: 'd2',
        parentSkuId: 'PANEL',
        childSkuId: 'BRACE',
        dependencyType: 'CONDITIONAL',
        condition: { field: 'wallHeight', operator: 'GT', value: 2400 },
      });
      expect(resolveSkuDependencies([parent({ fieldValues: { wallHeight: 2700 } })], [gt]).lines).toHaveLength(1);
      expect(resolveSkuDependencies([parent({ fieldValues: { wallHeight: 2400 } })], [gt]).lines).toHaveLength(0);
    });
  });

  describe('OPTIONAL', () => {
    const optRule = rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'LED', dependencyType: 'OPTIONAL' });

    it('is excluded unless selected', () => {
      expect(resolveSkuDependencies([parent()], [optRule]).lines).toHaveLength(0);
    });

    it('is included when selected for the parent component', () => {
      const out = resolveSkuDependencies([parent({ selectedOptionalSkuIds: ['LED'] })], [optRule]);
      expect(out.lines).toHaveLength(1);
      expect(out.lines[0].dependencyType).toBe('OPTIONAL');
    });
  });

  describe('determinism', () => {
    it('produces identical output regardless of rule order', () => {
      const rules = [
        rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'B' }),
        rule({ dependencyId: 'd2', parentSkuId: 'PANEL', childSkuId: 'A' }),
        rule({ dependencyId: 'd3', parentSkuId: 'A', childSkuId: 'C' }),
      ];
      const a = resolveSkuDependencies([parent()], rules);
      const b = resolveSkuDependencies([parent()], [...rules].reverse());
      expect(a).toEqual(b);
      expect(a.lines.map((l) => l.skuId)).toEqual(['A', 'C', 'B']);
    });

    it('gives unique line ids when a rule is reached via two paths', () => {
      const rules = [
        rule({ dependencyId: 'd1', parentSkuId: 'PANEL', childSkuId: 'A' }),
        rule({ dependencyId: 'd2', parentSkuId: 'PANEL', childSkuId: 'B' }),
        rule({ dependencyId: 'd3', parentSkuId: 'A', childSkuId: 'D' }),
        rule({ dependencyId: 'd4', parentSkuId: 'B', childSkuId: 'D' }),
        rule({ dependencyId: 'd5', parentSkuId: 'D', childSkuId: 'E' }),
      ];
      const out = resolveSkuDependencies([parent()], rules);
      expect(out.errors).toHaveLength(0);
      const ids = out.lines.map((l) => l.lineId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(out.lines.filter((l) => l.skuId === 'E')).toHaveLength(2);
    });
  });

  describe('cycles', () => {
    it('detectDependencyCycles reports the cycle path', () => {
      const errors = detectDependencyCycles([
        rule({ dependencyId: 'd1', parentSkuId: 'A', childSkuId: 'B' }),
        rule({ dependencyId: 'd2', parentSkuId: 'B', childSkuId: 'C' }),
        rule({ dependencyId: 'd3', parentSkuId: 'C', childSkuId: 'A' }),
      ]);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ErrorCode.DEP_CIRCULAR_DEPENDENCY);
      expect(errors[0].context?.path).toEqual(['A', 'B', 'C', 'A']);
    });

    it('acyclic graphs produce no cycle errors', () => {
      expect(
        detectDependencyCycles([
          rule({ dependencyId: 'd1', parentSkuId: 'A', childSkuId: 'B' }),
          rule({ dependencyId: 'd2', parentSkuId: 'A', childSkuId: 'C' }),
          rule({ dependencyId: 'd3', parentSkuId: 'B', childSkuId: 'C' }),
        ]),
      ).toHaveLength(0);
    });

    it('resolve reports a blocking error and does not recurse forever', () => {
      const out = resolveSkuDependencies(
        [parent({ skuId: 'A' })],
        [
          rule({ dependencyId: 'd1', parentSkuId: 'A', childSkuId: 'B' }),
          rule({ dependencyId: 'd2', parentSkuId: 'B', childSkuId: 'A' }),
        ],
      );
      expect(out.errors.some((e) => e.code === ErrorCode.DEP_CIRCULAR_DEPENDENCY)).toBe(true);
      expect(out.lines.map((l) => l.skuId)).toEqual(['B']);
    });
  });
});
