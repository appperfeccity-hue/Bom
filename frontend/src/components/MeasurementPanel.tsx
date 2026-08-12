import { useCallback, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { usePermissionEnforcement } from '@/canvas/permissions/usePermissionEnforcement';

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
  const updateMeasurements = useProjectStore((s) => s.updateMeasurements);
  const { isFieldLocked, validateField, getFieldPermission } = usePermissionEnforcement();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const handleChange = useCallback(
    (field: string, value: string) => {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue)) return;

      // If field is locked, do not update
      if (isFieldLocked(field)) return;

      // Permission-specific validation takes priority over generic constraints
      const permResult = validateField(field, numValue);
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

      const result = validateField(field, numValue);
      setFieldErrors((prev) => ({
        ...prev,
        [field]: result.valid ? null : (result.error ?? null),
      }));
    },
    [validateField],
  );

  const getFieldHint = (field: string): string | null => {
    const permission = getFieldPermission(field);
    if (!permission) return null;
    if (permission.edit_mode === 'RESTRICTED') {
      if (permission.min_value !== null && permission.max_value !== null) {
        return `${permission.min_value} - ${permission.max_value} mm`;
      }
    }
    return null;
  };

  return (
    <div
      className="measurement-panel"
      style={{
        width: '280px',
        padding: '16px',
        borderLeft: '1px solid #e0e0e0',
        overflowY: 'auto',
      }}
      data-testid="measurement-panel"
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>
        Site Measurements
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ fontSize: '13px' }}>
          Wall Width (mm)
          {isFieldLocked('wall_width_mm') && (
            <span data-testid="field-locked-wall_width_mm" style={{ marginLeft: '6px', color: '#999' }}>
              &#x1F512;
            </span>
          )}
          <input
            type="number"
            min={600}
            max={12000}
            value={measurements?.wall_width_mm ?? ''}
            onChange={(e) => handleChange('wall_width_mm', e.target.value)}
            onBlur={(e) => handleBlur('wall_width_mm', e.target.value)}
            disabled={isFieldLocked('wall_width_mm')}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="input-wall-width"
          />
          {fieldErrors.wall_width_mm && (
            <span data-testid="error-wall_width_mm" style={{ fontSize: '11px', color: '#d32f2f' }}>
              {fieldErrors.wall_width_mm}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#666' }}>
            {getFieldHint('wall_width_mm') ?? '600 - 12000 mm'}
          </span>
        </label>

        <label style={{ fontSize: '13px' }}>
          Wall Height (mm)
          {isFieldLocked('wall_height_mm') && (
            <span data-testid="field-locked-wall_height_mm" style={{ marginLeft: '6px', color: '#999' }}>
              &#x1F512;
            </span>
          )}
          <input
            type="number"
            min={300}
            max={6000}
            value={measurements?.wall_height_mm ?? ''}
            onChange={(e) => handleChange('wall_height_mm', e.target.value)}
            onBlur={(e) => handleBlur('wall_height_mm', e.target.value)}
            disabled={isFieldLocked('wall_height_mm')}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="input-wall-height"
          />
          {fieldErrors.wall_height_mm && (
            <span data-testid="error-wall_height_mm" style={{ fontSize: '11px', color: '#d32f2f' }}>
              {fieldErrors.wall_height_mm}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#666' }}>
            {getFieldHint('wall_height_mm') ?? '300 - 6000 mm'}
          </span>
        </label>

        {wallGeometry === 'L_CORNER' && (
          <>
            <label style={{ fontSize: '13px' }}>
              Segment A Width (mm)
              {isFieldLocked('segment_a_width_mm') && (
                <span data-testid="field-locked-segment_a_width_mm" style={{ marginLeft: '6px', color: '#999' }}>
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
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
                data-testid="input-segment-a"
              />
              {fieldErrors.segment_a_width_mm && (
                <span data-testid="error-segment_a_width_mm" style={{ fontSize: '11px', color: '#d32f2f' }}>
                  {fieldErrors.segment_a_width_mm}
                </span>
              )}
            </label>

            <label style={{ fontSize: '13px' }}>
              Segment B Width (mm)
              {isFieldLocked('segment_b_width_mm') && (
                <span data-testid="field-locked-segment_b_width_mm" style={{ marginLeft: '6px', color: '#999' }}>
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
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
                data-testid="input-segment-b"
              />
              {fieldErrors.segment_b_width_mm && (
                <span data-testid="error-segment_b_width_mm" style={{ fontSize: '11px', color: '#d32f2f' }}>
                  {fieldErrors.segment_b_width_mm}
                </span>
              )}
            </label>
          </>
        )}
      </div>
    </div>
  );
}
