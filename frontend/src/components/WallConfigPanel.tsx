import { useCallback, useState } from 'react';
import { useWallConfigStore } from '@/stores/wallConfigStore';
import { useProjectStore } from '@/stores/projectStore';
import { fromTable } from '@/lib/supabase';
import type { FitAlgorithm, WallMountingType } from '@/engines/types';
import { isLShape } from '@/engines/wallType';
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
  margin: 0,
  padding: '0 0 var(--space-1)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--color-ink-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontSize: 'var(--text-base)',
  color: 'var(--color-ink-secondary)',
  fontWeight: 400,
};

const INPUT_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '32px',
  padding: '0 8px',
  boxSizing: 'border-box',
  border: '1px solid var(--color-disabled)',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--color-surface)',
  fontSize: 'var(--text-base)',
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-ink-primary)',
};

const INPUT_READONLY_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: 'var(--color-canvas)',
  color: 'var(--color-ink-secondary)',
  cursor: 'default',
};

const SECTION_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const SECTION_DIVIDER_STYLE: React.CSSProperties = {
  height: '1px',
  backgroundColor: 'var(--color-hairline)',
  border: 'none',
  margin: 0,
};

const BUTTON_SECONDARY_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '32px',
  padding: '0 12px',
  fontSize: 'var(--text-base)',
  fontWeight: 500,
  border: '1px solid var(--color-disabled)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: 'var(--color-ink-primary)',
  fontFamily: 'var(--font-sans)',
};

const REMOVE_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '22px',
  padding: '0 6px',
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'rgba(176, 65, 62, 0.08)',
  color: 'var(--color-error)',
  cursor: 'pointer',
  lineHeight: 1,
};

const ITEM_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  backgroundColor: 'var(--color-canvas)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-ink-primary)',
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

  const isLCorner = isLShape(config.wall_type);

  return (
    <div
      className="wall-config-panel panel"
      style={{
        width: 'var(--right-panel-width)',
        minWidth: '280px',
        padding: 'var(--space-4)',
        borderLeft: '1px solid var(--color-hairline)',
        backgroundColor: 'var(--color-surface)',
        overflowY: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
      data-testid="wall-config-panel"
    >
      {/* Panel Header */}
      <h3
        className="panel-header"
        style={{
          margin: '0 0 var(--space-4)',
          fontSize: 'var(--text-md)',
          fontWeight: 600,
          color: 'var(--color-ink-primary)',
        }}
      >
        Wall Configuration
      </h3>

      {/* Generation error banner */}
      {generationError && (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: '10px 12px',
            backgroundColor: 'rgba(176, 65, 62, 0.06)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-error)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--color-error)',
            lineHeight: 1.4,
          }}
          data-testid="generation-error"
        >
          {generationError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* ─── Wall Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Wall</h4>
          <div style={SECTION_GROUP_STYLE}>
            {/* Wall Type - read only */}
            <label style={LABEL_STYLE}>
              Type
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
              Total Width
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={config.total_width_mm}
                  onChange={(e) => handleNumberChange('total_width_mm', e.target.value)}
                  min={1}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-total-width"
                />
                <span style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  pointerEvents: 'none',
                }}>mm</span>
              </div>
            </label>

            {/* Total Height */}
            <label style={LABEL_STYLE}>
              Total Height
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={config.total_height_mm}
                  onChange={(e) => handleNumberChange('total_height_mm', e.target.value)}
                  min={1}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-total-height"
                />
                <span style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  pointerEvents: 'none',
                }}>mm</span>
              </div>
            </label>

            {/* L-Corner Segment fields */}
            {isLCorner && (
              <>
                <label style={LABEL_STYLE}>
                  Segment A Width
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={config.segment_a_width_mm ?? 0}
                      onChange={(e) => handleNumberChange('segment_a_width_mm', e.target.value)}
                      min={0}
                      style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                    />
                    <span style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-secondary)',
                      pointerEvents: 'none',
                    }}>mm</span>
                  </div>
                </label>
                <label style={LABEL_STYLE}>
                  Segment B Width
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={config.segment_b_width_mm ?? 0}
                      onChange={(e) => handleNumberChange('segment_b_width_mm', e.target.value)}
                      min={0}
                      style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                    />
                    <span style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-secondary)',
                      pointerEvents: 'none',
                    }}>mm</span>
                  </div>
                </label>
              </>
            )}
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Panel Layout Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Panel Layout</h4>
          <div style={SECTION_GROUP_STYLE}>
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
              Fit Algorithm
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>Fit Intensity</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--color-ink-primary)',
                }}>{config.fit_intensity_percent}%</span>
              </div>
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
                  height: '32px',
                  margin: 0,
                  cursor: 'pointer',
                  accentColor: 'var(--color-accent)',
                }}
                data-testid="input-fit-intensity"
              />
            </label>
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Spacing Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Spacing</h4>
          <div style={SECTION_GROUP_STYLE}>
            {/* Panel Gap */}
            <label style={LABEL_STYLE}>
              Panel Gap
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={config.panel_gap_mm}
                  onChange={(e) => handleNumberChange('panel_gap_mm', e.target.value)}
                  min={0}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-panel-gap"
                />
                <span style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  pointerEvents: 'none',
                }}>mm</span>
              </div>
            </label>

            {/* Edge Margins - compact row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <label style={LABEL_STYLE}>
                Margin L
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={config.edge_margin_left_mm ?? 0}
                    onChange={(e) => handleNumberChange('edge_margin_left_mm', e.target.value)}
                    min={0}
                    style={{ ...INPUT_STYLE, paddingRight: '28px' }}
                    data-testid="input-edge-margin-left"
                  />
                  <span style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-secondary)',
                    pointerEvents: 'none',
                  }}>mm</span>
                </div>
              </label>
              <label style={LABEL_STYLE}>
                Margin R
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={config.edge_margin_right_mm ?? 0}
                    onChange={(e) => handleNumberChange('edge_margin_right_mm', e.target.value)}
                    min={0}
                    style={{ ...INPUT_STYLE, paddingRight: '28px' }}
                    data-testid="input-edge-margin-right"
                  />
                  <span style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-secondary)',
                    pointerEvents: 'none',
                  }}>mm</span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Mounting Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Mounting</h4>
          <div style={SECTION_GROUP_STYLE}>
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

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Lighting Section ─── */}
        <LightingSection />

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Furniture Section ─── */}
        <FurnitureSection />

        {/* ─── Generated Panel Count - status chip ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-2)',
            padding: '8px 12px',
            backgroundColor: 'rgba(63, 107, 79, 0.06)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-success)',
            fontWeight: 500,
          }}
          data-testid="frame-count"
        >
          <span>Generated Panels</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-md)',
            fontWeight: 600,
          }}>{panelFrames.length}</span>
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
  const [showAddForm, setShowAddForm] = useState(false);

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
      setShowAddForm(false);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ ...SECTION_HEADER_STYLE, margin: 0, padding: 0 }}>Lighting</h4>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              ...BUTTON_SECONDARY_STYLE,
              height: '24px',
              padding: '0 8px',
              fontSize: 'var(--text-xs)',
            }}
            data-testid="add-light-btn"
          >
            + Add
          </button>
        )}
      </div>

      <div style={SECTION_GROUP_STYLE}>
        {/* List of current lighting items */}
        {lighting.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lighting.map((item) => (
              <div
                key={item.lighting_id}
                style={ITEM_ROW_STYLE}
                data-testid={`lighting-item-${item.lighting_id}`}
              >
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-primary)' }}>
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
        )}

        {/* Add form - progressive disclosure */}
        {showAddForm && (
          <div style={{
            padding: 'var(--space-2)',
            backgroundColor: 'var(--color-canvas)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}>
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

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={handleAddLight}
                style={{
                  ...BUTTON_SECONDARY_STYLE,
                  flex: 1,
                  borderColor: 'var(--color-accent)',
                  color: 'var(--color-accent)',
                  fontWeight: 500,
                }}
                data-testid="submit-light-btn"
              >
                Add Light
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  ...BUTTON_SECONDARY_STYLE,
                  flex: 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Fallback button when no items and form hidden */}
        {lighting.length === 0 && !showAddForm && (
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
            No lighting configured
          </p>
        )}
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
  const [showAddForm, setShowAddForm] = useState(false);

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
      setShowAddForm(false);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ ...SECTION_HEADER_STYLE, margin: 0, padding: 0 }}>Furniture</h4>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              ...BUTTON_SECONDARY_STYLE,
              height: '24px',
              padding: '0 8px',
              fontSize: 'var(--text-xs)',
            }}
            data-testid="add-furniture-btn"
          >
            + Add
          </button>
        )}
      </div>

      <div style={SECTION_GROUP_STYLE}>
        {/* List of current furniture items */}
        {furniture.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {furniture.map((item) => (
              <div
                key={item.furniture_id}
                style={ITEM_ROW_STYLE}
                data-testid={`furniture-item-${item.furniture_id}`}
              >
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-primary)' }}>
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
        )}

        {/* Add form - progressive disclosure */}
        {showAddForm && (
          <div style={{
            padding: 'var(--space-2)',
            backgroundColor: 'var(--color-canvas)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <label style={LABEL_STYLE}>
                Pos X
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={positionX}
                    onChange={(e) => setPositionX(parseInt(e.target.value, 10) || 0)}
                    min={0}
                    style={{ ...INPUT_STYLE, paddingRight: '28px' }}
                    data-testid="input-position-x"
                  />
                  <span style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-secondary)',
                    pointerEvents: 'none',
                  }}>mm</span>
                </div>
              </label>
              <label style={LABEL_STYLE}>
                Pos Y
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={positionY}
                    onChange={(e) => setPositionY(parseInt(e.target.value, 10) || 0)}
                    min={0}
                    style={{ ...INPUT_STYLE, paddingRight: '28px' }}
                    data-testid="input-position-y"
                  />
                  <span style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-secondary)',
                    pointerEvents: 'none',
                  }}>mm</span>
                </div>
              </label>
            </div>

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

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={handleAddFurniture}
                style={{
                  ...BUTTON_SECONDARY_STYLE,
                  flex: 1,
                  borderColor: 'var(--color-accent)',
                  color: 'var(--color-accent)',
                  fontWeight: 500,
                }}
                data-testid="submit-furniture-btn"
              >
                Add Furniture
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  ...BUTTON_SECONDARY_STYLE,
                  flex: 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {furniture.length === 0 && !showAddForm && (
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
            No furniture configured
          </p>
        )}
      </div>
    </section>
  );
}
