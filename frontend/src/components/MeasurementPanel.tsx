import { useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';

/**
 * Side panel for CONSULTANT mode.
 * Shows form fields for actual site measurements:
 * wall_width_mm, wall_height_mm, segment_a_width_mm, segment_b_width_mm.
 * Validates: wall width 600-12000mm, wall height 300-6000mm.
 */
export function MeasurementPanel() {
  const measurements = useProjectStore((s) => s.measurements);
  const wallGeometry = useProjectStore((s) => s.wallGeometry);
  const updateMeasurements = useProjectStore((s) => s.updateMeasurements);

  const handleChange = useCallback(
    (field: string, value: string) => {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue)) return;

      // Validation
      if (field === 'wall_width_mm' && (numValue < 600 || numValue > 12000)) return;
      if (field === 'wall_height_mm' && (numValue < 300 || numValue > 6000)) return;

      void updateMeasurements({ [field]: numValue });
    },
    [updateMeasurements],
  );

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
          <input
            type="number"
            min={600}
            max={12000}
            value={measurements?.wall_width_mm ?? ''}
            onChange={(e) => handleChange('wall_width_mm', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="input-wall-width"
          />
          <span style={{ fontSize: '11px', color: '#666' }}>600 - 12000 mm</span>
        </label>

        <label style={{ fontSize: '13px' }}>
          Wall Height (mm)
          <input
            type="number"
            min={300}
            max={6000}
            value={measurements?.wall_height_mm ?? ''}
            onChange={(e) => handleChange('wall_height_mm', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="input-wall-height"
          />
          <span style={{ fontSize: '11px', color: '#666' }}>300 - 6000 mm</span>
        </label>

        {wallGeometry === 'L_CORNER' && (
          <>
            <label style={{ fontSize: '13px' }}>
              Segment A Width (mm)
              <input
                type="number"
                min={0}
                value={measurements?.segment_a_width_mm ?? ''}
                onChange={(e) => handleChange('segment_a_width_mm', e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
                data-testid="input-segment-a"
              />
            </label>

            <label style={{ fontSize: '13px' }}>
              Segment B Width (mm)
              <input
                type="number"
                min={0}
                value={measurements?.segment_b_width_mm ?? ''}
                onChange={(e) => handleChange('segment_b_width_mm', e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
                data-testid="input-segment-b"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
