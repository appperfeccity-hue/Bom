import { useCallback, useState } from 'react';
import { useWallConfigStore } from '@/stores/wallConfigStore';
import { useProjectStore } from '@/stores/projectStore';
import { fromTable } from '@/lib/supabase';
import type { FitAlgorithm, WallMountingType } from '@/engines/types';
import type { TemplateLighting, TemplateFurniture } from '@/types/database';

const EDGE_SELECTIONS = [
  'FULL_PERIMETER',
  'TOP_EDGE',
  'BOTTOM_EDGE',
  'LEFT_EDGE',
  'RIGHT_EDGE',
  'TOP_BOTTOM',
  'LEFT_RIGHT',
  'CUSTOM',
] as const;

const LIGHTING_MOUNTING_TYPES = ['DIRECT', 'PROFILE', 'COVE'] as const;
const ORIENTATIONS = ['HORIZONTAL', 'VERTICAL'] as const;

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

/* --- Design system inline style constants --- */
const SECTION_HEADER_STYLE: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6E6E6E', /* --color-ink-secondary */
  textTransform: 'uppercase',
};

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

const INPUT_READONLY_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: '#F6F5F3', /* --color-canvas */
};

const BUTTON_SECONDARY_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '13px',
  border: '1px solid #D8D5D0', /* --color-disabled */
  borderRadius: '4px',
  cursor: 'pointer',
  backgroundColor: 'transparent',
};

const REMOVE_BUTTON_STYLE: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: '11px',
  border: '1px solid #B0413E', /* --color-error */
  borderRadius: '4px',
  backgroundColor: 'rgba(176, 65, 62, 0.06)', /* --color-error 6% */
  color: '#B0413E', /* --color-error */
  cursor: 'pointer',
};

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
        width: '320px',
        padding: '16px',
        borderLeft: '1px solid #E3E1DD', /* --color-hairline */
        backgroundColor: '#FFFFFF', /* --color-surface */
        overflowY: 'auto',
      }}
      data-testid="wall-config-panel"
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1A1A1A' /* --color-ink-primary */ }}>
        Wall Configuration
      </h3>

      {/* Generation error */}
      {generationError && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 12px',
            backgroundColor: 'rgba(176, 65, 62, 0.06)', /* --color-error 6% */
            borderRadius: '4px',
            border: '1px solid #B0413E', /* --color-error */
            fontSize: '12px',
            color: '#B0413E', /* --color-error */
          }}
          data-testid="generation-error"
        >
          {generationError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Wall Configuration Section */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>
            Wall
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Wall Type - read only */}
            <label style={LABEL_STYLE}>
              Wall Type
              <input
                type="text"
                value={config.wall_type}
                readOnly
                style={INPUT_READONLY_STYLE}
                data-testid="input-wall-type"
              />
            </label>

            {/* Total Width */}
            <label style={LABEL_STYLE}>
              Total Width (mm)
              <input
                type="number"
                value={config.total_width_mm}
                onChange={(e) => handleNumberChange('total_width_mm', e.target.value)}
                min={1}
                style={INPUT_STYLE}
                data-testid="input-total-width"
              />
            </label>

            {/* Total Height */}
            <label style={LABEL_STYLE}>
              Total Height (mm)
              <input
                type="number"
                value={config.total_height_mm}
                onChange={(e) => handleNumberChange('total_height_mm', e.target.value)}
                min={1}
                style={INPUT_STYLE}
                data-testid="input-total-height"
              />
            </label>
          </div>
        </section>

        {/* Panel Layout Section */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>
            Panel Layout
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Rows */}
            <label style={LABEL_STYLE}>
              Rows
              <select
                value={config.rows}
                onChange={(e) => handleNumberChange('rows', e.target.value)}
                style={INPUT_STYLE}
                data-testid="select-rows"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            {/* Columns */}
            <label style={LABEL_STYLE}>
              Columns
              <input
                type="number"
                value={config.columns}
                onChange={(e) => handleNumberChange('columns', e.target.value)}
                min={1}
                max={12}
                style={INPUT_STYLE}
                data-testid="input-columns"
              />
            </label>

            {/* Panel Fit */}
            <label style={LABEL_STYLE}>
              Panel Fit
              <select
                value={config.fit_algorithm}
                onChange={(e) => handleFitAlgorithmChange(e.target.value)}
                style={INPUT_STYLE}
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
            <label style={LABEL_STYLE}>
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
          <h4 style={SECTION_HEADER_STYLE}>
            Spacing
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Panel Gap */}
            <label style={LABEL_STYLE}>
              Panel Gap (mm)
              <input
                type="number"
                value={config.panel_gap_mm}
                onChange={(e) => handleNumberChange('panel_gap_mm', e.target.value)}
                min={0}
                style={INPUT_STYLE}
                data-testid="input-panel-gap"
              />
            </label>

            {/* Edge Margin Left */}
            <label style={LABEL_STYLE}>
              Edge Margin Left (mm)
              <input
                type="number"
                value={config.edge_margin_left_mm ?? 0}
                onChange={(e) => handleNumberChange('edge_margin_left_mm', e.target.value)}
                min={0}
                style={INPUT_STYLE}
                data-testid="input-edge-margin-left"
              />
            </label>

            {/* Edge Margin Right */}
            <label style={LABEL_STYLE}>
              Edge Margin Right (mm)
              <input
                type="number"
                value={config.edge_margin_right_mm ?? 0}
                onChange={(e) => handleNumberChange('edge_margin_right_mm', e.target.value)}
                min={0}
                style={INPUT_STYLE}
                data-testid="input-edge-margin-right"
              />
            </label>
          </div>
        </section>

        {/* Mounting Section */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>
            Mounting
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={LABEL_STYLE}>
              Mounting Type
              <select
                value={config.mounting_type}
                onChange={(e) => handleMountingTypeChange(e.target.value)}
                style={INPUT_STYLE}
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

        {/* Lighting Section */}
        <LightingSection />

        {/* Furniture Section */}
        <FurnitureSection />

        {/* Generated Frame Count */}
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            backgroundColor: 'rgba(63, 107, 79, 0.06)', /* --color-success 6% */
            borderRadius: '4px',
            border: '1px solid #3F6B4F', /* --color-success */
            fontSize: '13px',
            color: '#3F6B4F', /* --color-success */
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

function LightingSection() {
  const lighting = useProjectStore((s) => s.lighting);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const loadTemplate = useProjectStore((s) => s.loadTemplate);

  const [newEdgeSelection, setNewEdgeSelection] = useState<string>('FULL_PERIMETER');
  const [newMountingType, setNewMountingType] = useState<TemplateLighting['mounting_type']>('DIRECT');

  const handleAddLight = useCallback(async () => {
    if (!currentTemplate) return;
    const { error } = await fromTable('template_lighting').insert({
      template_id: currentTemplate.template_id,
      sku_id: crypto.randomUUID(),
      edge_selection: newEdgeSelection,
      mounting_type: newMountingType,
      quantity_rule: null,
    });
    if (!error) {
      await loadTemplate(currentTemplate.template_id);
    }
  }, [currentTemplate, newEdgeSelection, newMountingType, loadTemplate]);

  const handleRemoveLight = useCallback(
    async (lightingId: string) => {
      const { error } = await fromTable('template_lighting')
        .delete()
        .eq('lighting_id', lightingId);
      if (!error && currentTemplate) {
        await loadTemplate(currentTemplate.template_id);
      }
    },
    [currentTemplate, loadTemplate],
  );

  return (
    <section data-testid="lighting-section">
      <h4 style={SECTION_HEADER_STYLE}>
        Lighting
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Inline form */}
        <label style={LABEL_STYLE}>
          Edge Selection
          <select
            value={newEdgeSelection}
            onChange={(e) => setNewEdgeSelection(e.target.value)}
            style={INPUT_STYLE}
            data-testid="select-edge-selection"
          >
            {EDGE_SELECTIONS.map((es) => (
              <option key={es} value={es}>
                {es}
              </option>
            ))}
          </select>
        </label>

        <label style={LABEL_STYLE}>
          Mounting Type
          <select
            value={newMountingType}
            onChange={(e) => setNewMountingType(e.target.value as TemplateLighting['mounting_type'])}
            style={INPUT_STYLE}
            data-testid="select-lighting-mounting-type"
          >
            {LIGHTING_MOUNTING_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {mt}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={handleAddLight}
          style={BUTTON_SECONDARY_STYLE}
          data-testid="add-light-btn"
        >
          Add Light
        </button>

        {/* List of current lighting items */}
        {lighting.map((item) => (
          <div
            key={item.lighting_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              backgroundColor: '#F6F5F3', /* --color-canvas */
              border: '1px solid #E3E1DD', /* --color-hairline */
              borderRadius: '4px',
              fontSize: '12px',
            }}
            data-testid={`lighting-item-${item.lighting_id}`}
          >
            <span>
              {item.edge_selection ?? 'N/A'} / {item.mounting_type}
            </span>
            <button
              onClick={() => handleRemoveLight(item.lighting_id)}
              style={REMOVE_BUTTON_STYLE}
              data-testid={`remove-light-${item.lighting_id}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FurnitureSection() {
  const furniture = useProjectStore((s) => s.furniture);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const loadTemplate = useProjectStore((s) => s.loadTemplate);

  const [positionX, setPositionX] = useState<number>(0);
  const [positionY, setPositionY] = useState<number>(0);
  const [orientation, setOrientation] = useState<TemplateFurniture['orientation']>('HORIZONTAL');

  const handleAddFurniture = useCallback(async () => {
    if (!currentTemplate) return;
    const { error } = await fromTable('template_furniture').insert({
      template_id: currentTemplate.template_id,
      sku_id: crypto.randomUUID(),
      position_x_mm: positionX,
      position_y_mm: positionY,
      orientation,
    });
    if (!error) {
      await loadTemplate(currentTemplate.template_id);
    }
  }, [currentTemplate, positionX, positionY, orientation, loadTemplate]);

  const handleRemoveFurniture = useCallback(
    async (furnitureId: string) => {
      const { error } = await fromTable('template_furniture')
        .delete()
        .eq('furniture_id', furnitureId);
      if (!error && currentTemplate) {
        await loadTemplate(currentTemplate.template_id);
      }
    },
    [currentTemplate, loadTemplate],
  );

  return (
    <section data-testid="furniture-section">
      <h4 style={SECTION_HEADER_STYLE}>
        Furniture
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Inline form */}
        <label style={LABEL_STYLE}>
          Position X (mm)
          <input
            type="number"
            value={positionX}
            onChange={(e) => setPositionX(parseInt(e.target.value, 10) || 0)}
            min={0}
            style={INPUT_STYLE}
            data-testid="input-position-x"
          />
        </label>

        <label style={LABEL_STYLE}>
          Position Y (mm)
          <input
            type="number"
            value={positionY}
            onChange={(e) => setPositionY(parseInt(e.target.value, 10) || 0)}
            min={0}
            style={INPUT_STYLE}
            data-testid="input-position-y"
          />
        </label>

        <label style={LABEL_STYLE}>
          Orientation
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as TemplateFurniture['orientation'])}
            style={INPUT_STYLE}
            data-testid="select-orientation"
          >
            {ORIENTATIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={handleAddFurniture}
          style={BUTTON_SECONDARY_STYLE}
          data-testid="add-furniture-btn"
        >
          Add Furniture
        </button>

        {/* List of current furniture items */}
        {furniture.map((item) => (
          <div
            key={item.furniture_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              backgroundColor: '#F6F5F3', /* --color-canvas */
              border: '1px solid #E3E1DD', /* --color-hairline */
              borderRadius: '4px',
              fontSize: '12px',
            }}
            data-testid={`furniture-item-${item.furniture_id}`}
          >
            <span>
              ({item.position_x_mm}, {item.position_y_mm}) / {item.orientation}
            </span>
            <button
              onClick={() => handleRemoveFurniture(item.furniture_id)}
              style={REMOVE_BUTTON_STYLE}
              data-testid={`remove-furniture-${item.furniture_id}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
