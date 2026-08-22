import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { usePermissionEnforcement } from '@/canvas/permissions/usePermissionEnforcement';
import { isLShape } from '@/engines/wallType';
import { projectMeasurements, toPermissionKey } from '@/lib/measurementModel';
import type { MeasurementColumn, ProjectedMeasurement } from '@/lib/measurementModel';

/** Resolve a project_measurement column to the canonical DB permission key. */
function permissionKeyFor(column: string): string {
  return toPermissionKey(column) ?? column;
}

/* --- Design system inline style constants --- */
const LABEL_STYLE: React.CSSProperties = {
  fontSize: '13px',
  color: '#6E6E6E', /* --color-ink-secondary */
};

const INPUT_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '6px 8px',
  height: '32px',
  boxSizing: 'border-box',
  border: '1px solid #D8D5D0', /* --color-disabled */
  borderRadius: '4px',
  backgroundColor: '#FFFFFF', /* --color-surface */
};

/**
 * Side panel for CONSULTANT mode.
 * Shows form fields for actual site measurements:
 * wall_width_mm, wall_height_mm, segment_a_width_mm, segment_b_width_mm.
 * Validates: wall width 600-12000mm, wall height 300-6000mm.
 * Enforces permissions from loaded snapshot (LOCKED/RESTRICTED/FREE).
 */
export function MeasurementPanel() {
  const measurements = useProjectStore((s) => s.measurements);
  const wallGeometry = useProjectStore((s) => s.wallGeometry);
  const currentSnapshot = useProjectStore((s) => s.currentSnapshot);
  const updateMeasurements = useProjectStore((s) => s.updateMeasurements);
  const { isFieldLocked, validateField } = usePermissionEnforcement();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  /**
   * Derived projection: default from frozen snapshot geometry, min/max from the
   * frozen consultant permissions, actual from project_measurement. The template
   * adaptation range takes priority; the 600-12000 / 300-6000 clamps below stay
   * only as a secondary DB-safety bound.
   */
  const projected = useMemo(
    () => projectMeasurements(currentSnapshot?.snapshot_data ?? null, measurements),
    [currentSnapshot, measurements],
  );

  const fieldOf = (field: string): ProjectedMeasurement | undefined =>
    projected[field as MeasurementColumn];

  const handleChange = useCallback(
    (field: string, value: string) => {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue)) return;

      const canonicalKey = permissionKeyFor(field);

      // If field is locked, do not update
      if (isFieldLocked(canonicalKey)) return;

      // Permission-specific validation takes priority over generic constraints
      const permResult = validateField(canonicalKey, numValue);
      if (!permResult.valid) return;

      // Generic measurement constraints (applied AFTER permission validation)
      if (field === 'wall_width_mm' && (numValue < 600 || numValue > 12000)) return;
      if (field === 'wall_height_mm' && (numValue < 300 || numValue > 6000)) return;

      void updateMeasurements({ [field]: numValue });
    },
    [updateMeasurements, isFieldLocked, validateField],
  );

  const handleBlur = useCallback(
    (field: string, value: string) => {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue)) return;

      const result = validateField(permissionKeyFor(field), numValue);
      setFieldErrors((prev) => ({
        ...prev,
        [field]: result.valid ? null : (result.error ?? null),
      }));
    },
    [validateField],
  );

  const getFieldHint = (field: string): string | null => {
    const measurement = fieldOf(field);
    if (!measurement) return null;
    if (measurement.minimum !== null && measurement.maximum !== null) {
      return `${measurement.minimum} - ${measurement.maximum} mm`;
    }
    return null;
  };

  /** Frozen designer default, shown as a reference next to the actual value. */
  const getDefaultHint = (field: string): string | null => {
    const measurement = fieldOf(field);
    if (!measurement || measurement.default === null) return null;
    return `Design default: ${measurement.default} mm`;
  };

  const renderDefaultHint = (field: string) => {
    const hint = getDefaultHint(field);
    if (!hint) return null;
    return (
      <span
        data-testid={`default-${field}`}
        style={{ display: 'block', fontSize: '11px', color: '#6E6E6E' }}
      >
        {hint}
      </span>
    );
  };

  return (
    <div
      className="measurement-panel"
      style={{
        width: '320px',
        padding: '16px',
        borderLeft: '1px solid #E3E1DD', /* --color-hairline */
        backgroundColor: '#FFFFFF', /* --color-surface */
        overflowY: 'auto',
      }}
      data-testid="measurement-panel"
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1A1A1A' /* --color-ink-primary */ }}>
        Site Measurements
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={LABEL_STYLE}>
          Wall Width (mm)
          {isFieldLocked('wall_width_mm') && (
            <span data-testid="field-locked-wall_width_mm" style={{ marginLeft: '6px', color: '#D8D5D0' /* --color-disabled */ }}>
              &#x1F512;
            </span>
          )}
          <input
            type="number"
            min={fieldOf('wall_width_mm')?.minimum ?? 600}
            max={fieldOf('wall_width_mm')?.maximum ?? 12000}
            value={measurements?.wall_width_mm ?? ''}
            onChange={(e) => handleChange('wall_width_mm', e.target.value)}
            onBlur={(e) => handleBlur('wall_width_mm', e.target.value)}
            disabled={isFieldLocked('wall_width_mm')}
            style={INPUT_STYLE}
            data-testid="input-wall-width"
          />
          {fieldErrors.wall_width_mm && (
            <span data-testid="error-wall_width_mm" style={{ fontSize: '11px', color: '#B0413E' /* --color-error */ }}>
              {fieldErrors.wall_width_mm}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#6E6E6E' /* --color-ink-secondary */ }}>
            {getFieldHint('wall_width_mm') ?? '600 - 12000 mm'}
          </span>
          {renderDefaultHint('wall_width_mm')}
        </label>

        <label style={LABEL_STYLE}>
          Wall Height (mm)
          {isFieldLocked('wall_height_mm') && (
            <span data-testid="field-locked-wall_height_mm" style={{ marginLeft: '6px', color: '#D8D5D0' /* --color-disabled */ }}>
              &#x1F512;
            </span>
          )}
          <input
            type="number"
            min={fieldOf('wall_height_mm')?.minimum ?? 300}
            max={fieldOf('wall_height_mm')?.maximum ?? 6000}
            value={measurements?.wall_height_mm ?? ''}
            onChange={(e) => handleChange('wall_height_mm', e.target.value)}
            onBlur={(e) => handleBlur('wall_height_mm', e.target.value)}
            disabled={isFieldLocked('wall_height_mm')}
            style={INPUT_STYLE}
            data-testid="input-wall-height"
          />
          {fieldErrors.wall_height_mm && (
            <span data-testid="error-wall_height_mm" style={{ fontSize: '11px', color: '#B0413E' /* --color-error */ }}>
              {fieldErrors.wall_height_mm}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#6E6E6E' /* --color-ink-secondary */ }}>
            {getFieldHint('wall_height_mm') ?? '300 - 6000 mm'}
          </span>
          {renderDefaultHint('wall_height_mm')}
        </label>

        {isLShape(wallGeometry) && (
          <>
            <label style={LABEL_STYLE}>
              Segment A Width (mm)
              {isFieldLocked('segment_a_width_mm') && (
                <span data-testid="field-locked-segment_a_width_mm" style={{ marginLeft: '6px', color: '#D8D5D0' /* --color-disabled */ }}>
                  &#x1F512;
                </span>
              )}
              <input
                type="number"
                min={0}
                value={measurements?.segment_a_width_mm ?? ''}
                onChange={(e) => handleChange('segment_a_width_mm', e.target.value)}
                onBlur={(e) => handleBlur('segment_a_width_mm', e.target.value)}
                disabled={isFieldLocked('segment_a_width_mm')}
                style={INPUT_STYLE}
                data-testid="input-segment-a"
              />
              {fieldErrors.segment_a_width_mm && (
                <span data-testid="error-segment_a_width_mm" style={{ fontSize: '11px', color: '#B0413E' /* --color-error */ }}>
                  {fieldErrors.segment_a_width_mm}
                </span>
              )}
              {getFieldHint('segment_a_width_mm') && (
                <span style={{ fontSize: '11px', color: '#6E6E6E' }}>
                  {getFieldHint('segment_a_width_mm')}
                </span>
              )}
              {renderDefaultHint('segment_a_width_mm')}
            </label>

            <label style={LABEL_STYLE}>
              Segment B Width (mm)
              {isFieldLocked('segment_b_width_mm') && (
                <span data-testid="field-locked-segment_b_width_mm" style={{ marginLeft: '6px', color: '#D8D5D0' /* --color-disabled */ }}>
                  &#x1F512;
                </span>
              )}
              <input
                type="number"
                min={0}
                value={measurements?.segment_b_width_mm ?? ''}
                onChange={(e) => handleChange('segment_b_width_mm', e.target.value)}
                onBlur={(e) => handleBlur('segment_b_width_mm', e.target.value)}
                disabled={isFieldLocked('segment_b_width_mm')}
                style={INPUT_STYLE}
                data-testid="input-segment-b"
              />
              {fieldErrors.segment_b_width_mm && (
                <span data-testid="error-segment_b_width_mm" style={{ fontSize: '11px', color: '#B0413E' /* --color-error */ }}>
                  {fieldErrors.segment_b_width_mm}
                </span>
              )}
              {getFieldHint('segment_b_width_mm') && (
                <span style={{ fontSize: '11px', color: '#6E6E6E' }}>
                  {getFieldHint('segment_b_width_mm')}
                </span>
              )}
              {renderDefaultHint('segment_b_width_mm')}
            </label>
          </>
        )}
      </div>
    </div>
  );
}
