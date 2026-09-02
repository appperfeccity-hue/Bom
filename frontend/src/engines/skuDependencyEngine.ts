/**
 * SKU Dependency Resolution Engine
 *
 * Expands a parent SKU into its child SKUs using the frozen `sku_dependency`
 * graph. Resolution is recursive (a child may itself have children),
 * deterministic (stable ordering, integer quantities) and traceable (every
 * output line carries its parent SKU, root component, level and rule id).
 *
 * Dependency types:
 *   REQUIRED     always included
 *   CONDITIONAL  included when `condition` holds against the parent context
 *   OPTIONAL     included only when explicitly selected for the parent
 *
 * Quantity rules (factor = quantity_factor from SKU Master):
 *   PER_PARENT   ceil(parentQuantity * factor)
 *   PER_AREA     ceil(areaMm2 / 1e6 * factor)
 *   PER_LENGTH   ceil(edgeLengthMm / 1000 * factor)
 *   PER_EDGE     ceil(edgeCount * factor)
 *   FIXED        ceil(factor)
 *
 * Geometry (area / edge length / edge count) is always taken from the root
 * parent context; nested children inherit it.
 */

import { ErrorCode, PipelineError, createPipelineError } from './errorCatalogue';
import type { ConditionOperator, HiddenComponentCondition } from './types';

export type SkuDependencyType = 'REQUIRED' | 'CONDITIONAL' | 'OPTIONAL';
export type SkuDependencyQuantityRule =
  | 'PER_PARENT'
  | 'PER_AREA'
  | 'PER_LENGTH'
  | 'PER_EDGE'
  | 'FIXED';
export type SkuDependencyUnit = 'PCS' | 'M' | 'M2';
export type SkuPhysicalProductType =
  | 'WALL_PANEL'
  | 'LIGHT'
  | 'FURNITURE'
  | 'HIDDEN_COMPONENT';

export interface SkuDependencyRule {
  dependencyId: string;
  parentSkuId: string;
  childSkuId: string;
  dependencyType: SkuDependencyType;
  condition?: HiddenComponentCondition;
  quantityRule: SkuDependencyQuantityRule;
  quantityFactor: number;
  unitOfMeasure: SkuDependencyUnit;
  /** Physical product_type of the child SKU, frozen with the snapshot. */
  childProductType: SkuPhysicalProductType;
}

/** A BOM line that may spawn dependent SKUs. */
export interface DependencyParentContext {
  componentId: string;
  skuId: string;
  quantity: number;
  /** Covered area of the parent (zone / frame) in mm². */
  areaMm2?: number;
  /** Total edge length driving PER_LENGTH children, in mm. */
  edgeLengthMm?: number;
  /** Number of edges driving PER_EDGE children. */
  edgeCount?: number;
  /** Values CONDITIONAL rules are evaluated against (e.g. mountingType, wallType). */
  fieldValues?: Record<string, number | string>;
  /** OPTIONAL child SKUs explicitly selected for this parent. */
  selectedOptionalSkuIds?: string[];
}

export interface ResolvedDependencyLine {
  lineId: string;
  /** Root component (zone / frame / light) this line traces back to. */
  componentId: string;
  skuId: string;
  parentSkuId: string;
  dependencyId: string;
  dependencyType: SkuDependencyType;
  quantityRule: SkuDependencyQuantityRule;
  /** 1 = direct child of a primary line, 2 = grandchild, ... */
  level: number;
  quantity: number;
  unitOfMeasure: SkuDependencyUnit;
  productType: SkuPhysicalProductType;
}

export interface ResolveDependenciesOutput {
  lines: ResolvedDependencyLine[];
  errors: PipelineError[];
  warnings: PipelineError[];
}

export const MAX_DEPENDENCY_DEPTH = 32;

function compareValues(
  fieldValue: number | string,
  operator: ConditionOperator,
  target: number | string,
): boolean {
  switch (operator) {
    case 'EQ':
      return fieldValue === target;
    case 'NEQ':
      return fieldValue !== target;
    case 'GT':
      return Number(fieldValue) > Number(target);
    case 'LT':
      return Number(fieldValue) < Number(target);
    case 'GTE':
      return Number(fieldValue) >= Number(target);
    case 'LTE':
      return Number(fieldValue) <= Number(target);
    default:
      return false;
  }
}

/**
 * Builds a parent → rules index with deterministic ordering (child SKU id, then
 * dependency id) so output never depends on snapshot array order.
 */
export function indexDependencyRules(
  rules: SkuDependencyRule[],
): Map<string, SkuDependencyRule[]> {
  const index = new Map<string, SkuDependencyRule[]>();
  for (const rule of rules) {
    const list = index.get(rule.parentSkuId) ?? [];
    list.push(rule);
    index.set(rule.parentSkuId, list);
  }
  for (const list of index.values()) {
    list.sort(
      (a, b) =>
        a.childSkuId.localeCompare(b.childSkuId) ||
        a.dependencyId.localeCompare(b.dependencyId),
    );
  }
  return index;
}

/**
 * Detects cycles in the whole rule graph (independent of any parent context).
 * Returns one error per cycle found, with the SKU path in context.
 */
export function detectDependencyCycles(rules: SkuDependencyRule[]): PipelineError[] {
  const index = indexDependencyRules(rules);
  const errors: PipelineError[] = [];
  const state = new Map<string, 'VISITING' | 'DONE'>();

  const visit = (skuId: string, path: string[]): void => {
    const s = state.get(skuId);
    if (s === 'DONE') return;
    if (s === 'VISITING') {
      const start = path.indexOf(skuId);
      errors.push(
        createPipelineError(ErrorCode.DEP_CIRCULAR_DEPENDENCY, {
          path: [...path.slice(start), skuId],
        }),
      );
      return;
    }
    state.set(skuId, 'VISITING');
    for (const rule of index.get(skuId) ?? []) {
      visit(rule.childSkuId, [...path, skuId]);
    }
    state.set(skuId, 'DONE');
  };

  for (const parentSkuId of [...index.keys()].sort()) {
    visit(parentSkuId, []);
  }
  return errors;
}

interface QuantityResult {
  quantity?: number;
  missing?: string;
}

function computeQuantity(
  rule: SkuDependencyRule,
  parentQuantity: number,
  root: DependencyParentContext,
): QuantityResult {
  const f = rule.quantityFactor;
  switch (rule.quantityRule) {
    case 'PER_PARENT':
      return { quantity: Math.ceil(parentQuantity * f) };
    case 'PER_AREA':
      if (root.areaMm2 === undefined) return { missing: 'areaMm2' };
      return { quantity: Math.ceil((root.areaMm2 / 1_000_000) * f) };
    case 'PER_LENGTH':
      if (root.edgeLengthMm === undefined) return { missing: 'edgeLengthMm' };
      return { quantity: Math.ceil((root.edgeLengthMm / 1000) * f) };
    case 'PER_EDGE':
      if (root.edgeCount === undefined) return { missing: 'edgeCount' };
      return { quantity: Math.ceil(root.edgeCount * f) };
    case 'FIXED':
      return { quantity: Math.ceil(f) };
    default:
      return { missing: 'quantityRule' };
  }
}

/**
 * Resolves the dependent SKU lines for a set of parent (primary) lines.
 *
 * Cycles are reported as BLOCKING errors and the offending branch is not
 * expanded further; a defensive depth cap guards against pathological graphs.
 */
export function resolveSkuDependencies(
  parents: DependencyParentContext[],
  rules: SkuDependencyRule[],
): ResolveDependenciesOutput {
  const lines: ResolvedDependencyLine[] = [];
  const errors: PipelineError[] = [];
  const warnings: PipelineError[] = [];

  if (rules.length === 0 || parents.length === 0) {
    return { lines, errors, warnings };
  }

  errors.push(...detectDependencyCycles(rules));
  const index = indexDependencyRules(rules);

  const expand = (
    root: DependencyParentContext,
    parentSkuId: string,
    parentQuantity: number,
    level: number,
    path: string[],
  ): void => {
    if (level > MAX_DEPENDENCY_DEPTH) return;
    const childRules = index.get(parentSkuId);
    if (!childRules) return;

    for (const rule of childRules) {
      if (path.includes(rule.childSkuId)) {
        // Already reported by detectDependencyCycles; do not recurse.
        continue;
      }

      let included = false;
      switch (rule.dependencyType) {
        case 'REQUIRED':
          included = true;
          break;
        case 'OPTIONAL':
          included = root.selectedOptionalSkuIds?.includes(rule.childSkuId) ?? false;
          break;
        case 'CONDITIONAL': {
          if (!rule.condition) break;
          const value = root.fieldValues?.[rule.condition.field];
          if (value === undefined) {
            warnings.push(
              createPipelineError(ErrorCode.DEP_CONDITION_UNRESOLVED, {
                componentId: root.componentId,
                dependencyId: rule.dependencyId,
                parentSkuId,
                childSkuId: rule.childSkuId,
                field: rule.condition.field,
              }),
            );
            break;
          }
          included = compareValues(value, rule.condition.operator, rule.condition.value);
          break;
        }
      }
      if (!included) continue;

      const qty = computeQuantity(rule, parentQuantity, root);
      if (qty.quantity === undefined) {
        errors.push(
          createPipelineError(ErrorCode.DEP_CONTEXT_MISSING, {
            componentId: root.componentId,
            dependencyId: rule.dependencyId,
            parentSkuId,
            childSkuId: rule.childSkuId,
            quantityRule: rule.quantityRule,
            missing: qty.missing,
          }),
        );
        continue;
      }
      if (qty.quantity <= 0) continue;

      lines.push({
        lineId: `dep-${root.componentId}-${path.join('>')}-${rule.dependencyId}`,
        componentId: root.componentId,
        skuId: rule.childSkuId,
        parentSkuId,
        dependencyId: rule.dependencyId,
        dependencyType: rule.dependencyType,
        quantityRule: rule.quantityRule,
        level,
        quantity: qty.quantity,
        unitOfMeasure: rule.unitOfMeasure,
        productType: rule.childProductType,
      });

      expand(root, rule.childSkuId, qty.quantity, level + 1, [...path, rule.childSkuId]);
    }
  };

  for (const parent of parents) {
    if (!parent.skuId || parent.quantity <= 0) continue;
    expand(parent, parent.skuId, parent.quantity, 1, [parent.skuId]);
  }

  return { lines, errors, warnings };
}
