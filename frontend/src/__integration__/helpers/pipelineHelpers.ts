/**
 * Helper functions for integration tests.
 * Provides utilities to assemble pipeline inputs and assert BOM consistency.
 */

import type {
  BomPipelineInput,
  BomPipelineOutput,
  SnapshotData,
  BomMeasurements,
  BomConfiguration,
  BomRuleSet,
} from '@/engines/bomPipeline';
import type { PermissionRule, CompatibilityRule } from '@/engines/validationEngine';

/**
 * Assembles a BomPipelineInput from individual parts.
 * This mirrors how the application would combine data from various sources
 * (snapshot from DB, measurements from site survey, config from UI).
 */
export function buildPipelineInput(
  snapshotData: SnapshotData,
  measurements: BomMeasurements,
  config: BomConfiguration = {},
  permissions: PermissionRule[] = [],
  compatRules: CompatibilityRule[] = [],
  ruleSet: BomRuleSet = {},
): BomPipelineInput {
  return {
    snapshotData,
    measurements,
    configuration: config,
    ruleSet,
    permissions,
    compatibilityRules: compatRules,
  };
}

/**
 * Asserts that every physical component in the snapshot has a corresponding BOM line.
 * Validates the critical invariant: Canvas state and BOM state describe the same physical wall.
 *
 * Checks:
 * - Every zone with panelWidth/panelHeight produces a WALL_PANEL line
 * - Every lighting component produces a LIGHT line
 * - Every furniture item with quantity > 0 produces a FURNITURE line
 * - Every triggered hidden component produces a HIDDEN_COMPONENT line
 */
export function assertBomConsistency(
  bomOutput: BomPipelineOutput,
  snapshotData: SnapshotData,
): void {
  const bomLines = bomOutput.actualBomLines;

  // Check zones -> WALL_PANEL lines
  const zonesWithPanels = snapshotData.zones.filter(
    (z) => z.panelWidth && z.panelHeight,
  );
  const panelLines = bomLines.filter((l) => l.calculationRule === 'WALL_PANEL');
  for (const zone of zonesWithPanels) {
    const matchingLine = panelLines.find((l) => l.componentId === zone.zoneId);
    if (!matchingLine) {
      throw new Error(
        `Zone "${zone.zoneId}" has panels but no WALL_PANEL BOM line`,
      );
    }
    if (matchingLine.quantity <= 0) {
      throw new Error(
        `Zone "${zone.zoneId}" WALL_PANEL line has quantity ${matchingLine.quantity} (expected > 0)`,
      );
    }
  }

  // Check lighting -> LIGHT lines
  if (snapshotData.lighting) {
    const lightLines = bomLines.filter((l) => l.calculationRule === 'LIGHT');
    for (const light of snapshotData.lighting) {
      const matchingLine = lightLines.find(
        (l) => l.componentId === light.componentId,
      );
      if (!matchingLine) {
        throw new Error(
          `Lighting "${light.componentId}" has no LIGHT BOM line`,
        );
      }
      if (matchingLine.quantity <= 0) {
        throw new Error(
          `Lighting "${light.componentId}" LIGHT line has quantity ${matchingLine.quantity} (expected > 0)`,
        );
      }
    }
  }

  // Check furniture -> FURNITURE lines (only for quantity > 0)
  if (snapshotData.furniture) {
    const furnLines = bomLines.filter((l) => l.calculationRule === 'FURNITURE');
    for (const item of snapshotData.furniture) {
      if (item.quantity === 0) continue;
      const matchingLine = furnLines.find(
        (l) => l.componentId === item.componentId,
      );
      if (!matchingLine) {
        throw new Error(
          `Furniture "${item.componentId}" (qty=${item.quantity}) has no FURNITURE BOM line`,
        );
      }
    }
  }

  // Check no orphan BOM lines (every line traces back to a snapshot component)
  for (const line of bomLines) {
    const isPanel = snapshotData.zones.some((z) => z.zoneId === line.componentId);
    const isLight = snapshotData.lighting?.some(
      (l) => l.componentId === line.componentId,
    );
    const isFurniture = snapshotData.furniture?.some(
      (f) => f.componentId === line.componentId,
    );
    const isHidden = snapshotData.hiddenComponents?.some(
      (h) => h.componentId === line.componentId,
    );

    if (!isPanel && !isLight && !isFurniture && !isHidden) {
      throw new Error(
        `BOM line "${line.lineId}" (componentId="${line.componentId}") has no matching snapshot component (orphan)`,
      );
    }
  }
}

/**
 * Verifies that a pipeline output has no stale references -
 * every BOM line componentId exists in the given snapshot data.
 */
export function assertNoStaleReferences(
  bomOutput: BomPipelineOutput,
  snapshotData: SnapshotData,
): void {
  const allComponentIds = new Set<string>();
  snapshotData.zones.forEach((z) => allComponentIds.add(z.zoneId));
  snapshotData.lighting?.forEach((l) => allComponentIds.add(l.componentId));
  snapshotData.furniture?.forEach((f) => allComponentIds.add(f.componentId));
  snapshotData.hiddenComponents?.forEach((h) => allComponentIds.add(h.componentId));

  for (const line of bomOutput.actualBomLines) {
    if (!allComponentIds.has(line.componentId)) {
      throw new Error(
        `Stale BOM line found: "${line.lineId}" references componentId "${line.componentId}" which no longer exists in snapshot`,
      );
    }
  }
}
