import { useCallback } from 'react';
import { useWallConfigStore } from '@/stores/wallConfigStore';
import type { FitAlgorithm, WallMountingType } from '@/engines/types';

const FIT_ALGORITHMS: FitAlgorithm[] = [
  'EQUAL',
  'ADJUST_END_PANELS',
  'SPREAD_LEFT',
  'SPREAD_RIGHT',
  'SPREAD_BOTH_ENDS',
  'CENTRE_FOCUS',
  'OUTER_FOCUS',
  'ALTERNATING',
];

const MOUNTING_TYPES: WallMountingType[] = ['DIRECT', 'PROFILE', 'RAIL'];

/**
 * Right-side panel for DESIGNER mode showing wall configuration controls.
 * Always visible in DESIGNER mode (not conditional on zone selection).
 * Allows configuring wall dimensions, panel layout, spacing, and mounting type.
 */
export function WallConfigPanel() {
  const config = useWallConfigStore((s) => s.config);
  const panelFrames = useWallConfigStore((s) => s.panelFrames);
  const generationError = useWallConfigStore((s) => s.generationError);
  const setWallConfig = useWallConfigStore((s) => s.setWallConfig);

  const handleNumberChange = useCallback(
    (field: string, value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        setWallConfig({ [field]: num });
      }
    },
    [setWallConfig],
  );

  const handleFitAlgorithmChange = useCallback(
    (value: string) => {
      setWallConfig({ fit_algorithm: value as FitAlgorithm });
    },
    [setWallConfig],
  );

  const handleMountingTypeChange = useCallback(
    (value: string) => {
      setWallConfig({ mounting_type: value as WallMountingType });
    },
    [setWallConfig],
  );

  const handleIntensityChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        setWallConfig({ fit_intensity_percent: num });
      }
    },
    [setWallConfig],
  );

  return (
    <div
      className="wall-config-panel"
      style={{
        width: '280px',
        padding: '16px',
        borderLeft: '1px solid #e0e0e0',
        overflowY: 'auto',
      }}
      data-testid="wall-config-panel"
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>
        Wall Configuration
      </h3>

      {/* Generation error */}
      {generationError && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 12px',
            backgroundColor: '#fbe9e7',
            borderRadius: '4px',
            border: '1px solid #f44336',
            fontSize: '12px',
            color: '#c62828',
          }}
          data-testid="generation-error"
        >
          {generationError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Wall Configuration Section */}
        <section>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
            Wall
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Wall Type - read only */}
            <label style={{ fontSize: '13px' }}>
              Wall Type
              <input
                type="text"
                value={config.wall_type}
                readOnly
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '3px',
                }}
                data-testid="input-wall-type"
              />
            </label>

            {/* Total Width */}
            <label style={{ fontSize: '13px' }}>
              Total Width (mm)
              <input
                type="number"
                value={config.total_width_mm}
                onChange={(e) => handleNumberChange('total_width_mm', e.target.value)}
                min={1}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="input-total-width"
              />
            </label>

            {/* Total Height */}
            <label style={{ fontSize: '13px' }}>
              Total Height (mm)
              <input
                type="number"
                value={config.total_height_mm}
                onChange={(e) => handleNumberChange('total_height_mm', e.target.value)}
                min={1}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="input-total-height"
              />
            </label>
          </div>
        </section>

        {/* Panel Layout Section */}
        <section>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
            Panel Layout
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Rows */}
            <label style={{ fontSize: '13px' }}>
              Rows
              <select
                value={config.rows}
                onChange={(e) => handleNumberChange('rows', e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="select-rows"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            {/* Columns */}
            <label style={{ fontSize: '13px' }}>
              Columns
              <input
                type="number"
                value={config.columns}
                onChange={(e) => handleNumberChange('columns', e.target.value)}
                min={1}
                max={12}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="input-columns"
              />
            </label>

            {/* Panel Fit */}
            <label style={{ fontSize: '13px' }}>
              Panel Fit
              <select
                value={config.fit_algorithm}
                onChange={(e) => handleFitAlgorithmChange(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="select-fit-algorithm"
              >
                {FIT_ALGORITHMS.map((alg) => (
                  <option key={alg} value={alg}>
                    {alg}
                  </option>
                ))}
              </select>
            </label>

            {/* Fit Intensity */}
            <label style={{ fontSize: '13px' }}>
              Fit Intensity: {config.fit_intensity_percent}%
              <input
                type="range"
                value={config.fit_intensity_percent}
                onChange={(e) => handleIntensityChange(e.target.value)}
                min={0}
                max={100}
                step={1}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                }}
                data-testid="input-fit-intensity"
              />
            </label>
          </div>
        </section>

        {/* Spacing Section */}
        <section>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
            Spacing
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Panel Gap */}
            <label style={{ fontSize: '13px' }}>
              Panel Gap (mm)
              <input
                type="number"
                value={config.panel_gap_mm}
                onChange={(e) => handleNumberChange('panel_gap_mm', e.target.value)}
                min={0}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="input-panel-gap"
              />
            </label>

            {/* Edge Margin Left */}
            <label style={{ fontSize: '13px' }}>
              Edge Margin Left (mm)
              <input
                type="number"
                value={config.edge_margin_left_mm ?? 0}
                onChange={(e) => handleNumberChange('edge_margin_left_mm', e.target.value)}
                min={0}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="input-edge-margin-left"
              />
            </label>

            {/* Edge Margin Right */}
            <label style={{ fontSize: '13px' }}>
              Edge Margin Right (mm)
              <input
                type="number"
                value={config.edge_margin_right_mm ?? 0}
                onChange={(e) => handleNumberChange('edge_margin_right_mm', e.target.value)}
                min={0}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="input-edge-margin-right"
              />
            </label>
          </div>
        </section>

        {/* Mounting Section */}
        <section>
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
            Mounting
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px' }}>
              Mounting Type
              <select
                value={config.mounting_type}
                onChange={(e) => handleMountingTypeChange(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                }}
                data-testid="select-mounting-type"
              >
                {MOUNTING_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {mt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Generated Frame Count */}
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            backgroundColor: '#e8f5e9',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#2e7d32',
            textAlign: 'center',
          }}
          data-testid="frame-count"
        >
          Generated Panels: <strong>{panelFrames.length}</strong>
        </div>
      </div>
    </div>
  );
}
