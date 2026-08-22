import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSkuStore } from '@/stores/skuStore';
import { useSkuRemove } from '@/canvas/interactions/useSkuRemove';
import { useZoneValidation } from '@/canvas/utils/useZoneValidation';
import { ZoneWidthStrategy, ZoneHeightStrategy } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import { clampDimensions, constrainToWall, hasOverlap } from '@/canvas/utils/zoneConstraints';
import { isLShape } from '@/engines/wallType';

/* --- Design system inline style constants (matching WallConfigPanel) --- */
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

const BUTTON_PRIMARY_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '32px',
  padding: '0 12px',
  fontSize: 'var(--text-base)',
  fontWeight: 500,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  backgroundColor: 'var(--color-accent)',
  color: 'var(--color-surface)',
  fontFamily: 'var(--font-sans)',
};

const BUTTON_DESTRUCTIVE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '28px',
  padding: '0 10px',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: 'var(--color-error)',
  fontFamily: 'var(--font-sans)',
};

const MM_SUFFIX_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-ink-secondary)',
  pointerEvents: 'none',
};

/**
 * Side panel for DESIGNER mode when a zone is selected.
 * Shows zone dimensions, position, strategy selectors, and assigned SKU.
 */
export function ZonePropertiesPanel() {
  const selection = useCanvasStore((s) => s.selection);
  const zones = useProjectStore((s) => s.zones);
  const zoneSku = useProjectStore((s) => s.zoneSku);
  const updateZone = useProjectStore((s) => s.updateZone);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const openBrowser = useSkuStore((s) => s.openBrowser);
  const { removeSku } = useSkuRemove();
  const validationMap = useZoneValidation();

  const selectedZone = zones.find((z) => z.zone_id === selection.selectedZoneId);
  const wallGeometry = useProjectStore((s) => s.wallGeometry);

  // Multi-selection info
  if (selection.selectedZoneIds.length > 1) {
    return (
      <div
        className="zone-properties-panel panel"
        style={{
          width: '280px',
          padding: 'var(--space-4)',
          borderLeft: '1px solid var(--color-hairline)',
          backgroundColor: 'var(--color-surface)',
          overflowY: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
        data-testid="zone-properties-panel"
      >
        <h3
          style={{
            margin: '0 0 var(--space-4)',
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: 'var(--color-ink-primary)',
          }}
        >
          Zone Properties
        </h3>
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(154, 123, 79, 0.08)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(154, 123, 79, 0.2)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-accent)',
            fontWeight: 500,
          }}
          data-testid="multi-select-info"
        >
          {selection.selectedZoneIds.length} zones selected
        </div>
      </div>
    );
  }

  const handleFieldChange = useCallback(
    (field: keyof TemplateZone, value: string | number) => {
      if (!selectedZone || !currentTemplate) return;

      const updated = { ...selectedZone, [field]: value };

      // Apply dimension clamping for spatial fields
      if (field === 'width_mm' || field === 'height_mm') {
        const clamped = clampDimensions(updated.width_mm, updated.height_mm);
        updated.width_mm = clamped.width;
        updated.height_mm = clamped.height;
      }

      // Apply wall boundary constraint for position/size fields
      if (field === 'x_mm' || field === 'y_mm' || field === 'width_mm' || field === 'height_mm') {
        const wallWidth = currentTemplate.wall_geometry.base_width_mm;
        const wallHeight = currentTemplate.wall_geometry.base_height_mm;
        const constrained = constrainToWall(
          updated.x_mm,
          updated.y_mm,
          updated.width_mm,
          updated.height_mm,
          wallWidth,
          wallHeight,
        );
        updated.x_mm = constrained.x;
        updated.y_mm = constrained.y;

        // Check for overlap with other zones
        const box = { x: updated.x_mm, y: updated.y_mm, width: updated.width_mm, height: updated.height_mm };
        if (hasOverlap(box, zones, selectedZone.zone_id)) {
          return; // Reject the change if it causes overlap
        }
      }

      void updateZone(updated);
    },
    [selectedZone, updateZone, currentTemplate, zones],
  );

  if (!selectedZone) return null;

  const sku = zoneSku.get(selectedZone.zone_id);
  const zoneValidation = validationMap.get(selectedZone.zone_id);

  return (
    <div
      className="zone-properties-panel panel"
      style={{
        width: '280px',
        padding: 'var(--space-4)',
        borderLeft: '1px solid var(--color-hairline)',
        backgroundColor: 'var(--color-surface)',
        overflowY: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
      data-testid="zone-properties-panel"
    >
      {/* Panel Header */}
      <h3
        style={{
          margin: '0 0 var(--space-4)',
          fontSize: 'var(--text-md)',
          fontWeight: 600,
          color: 'var(--color-ink-primary)',
        }}
      >
        Zone Properties
      </h3>

      {/* Validation errors section */}
      {zoneValidation && zoneValidation.errors.length > 0 && (
        <div
          data-testid="zone-validation-errors"
          style={{
            marginBottom: 'var(--space-4)',
            padding: '8px 10px',
            backgroundColor: 'rgba(176, 65, 62, 0.06)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-error)',
          }}
        >
          {zoneValidation.errors.length === 1 ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', fontWeight: 500 }}>
              {zoneValidation.errors[0]}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-error)', marginBottom: '4px' }}>
                Validation Errors
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
                {zoneValidation.errors.map((error, i) => (
                  <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', marginBottom: '2px' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* ─── Identity Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Identity</h4>
          <div style={SECTION_GROUP_STYLE}>
            {/* Zone ID */}
            <label style={LABEL_STYLE}>
              Zone ID
              <input
                type="text"
                value={selectedZone.zone_id}
                readOnly
                style={INPUT_READONLY_STYLE}
                data-testid="input-zone-name"
              />
            </label>

            {/* Segment badge (L_SHAPE / legacy L_CORNER only) */}
            {isLShape(wallGeometry) && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  backgroundColor: selectedZone.segment === 'SEGMENT_A'
                    ? 'rgba(63, 107, 79, 0.08)'
                    : selectedZone.segment === 'SEGMENT_B'
                      ? 'rgba(154, 123, 79, 0.08)'
                      : 'var(--color-canvas)',
                  color: selectedZone.segment === 'SEGMENT_A'
                    ? 'var(--color-success)'
                    : selectedZone.segment === 'SEGMENT_B'
                      ? 'var(--color-accent)'
                      : 'var(--color-ink-secondary)',
                  border: `1px solid ${
                    selectedZone.segment === 'SEGMENT_A'
                      ? 'rgba(63, 107, 79, 0.3)'
                      : selectedZone.segment === 'SEGMENT_B'
                        ? 'rgba(154, 123, 79, 0.3)'
                        : 'var(--color-disabled)'
                  }`,
                }}
                data-testid="segment-badge"
              >
                {selectedZone.segment === 'SEGMENT_A'
                  ? 'Segment A'
                  : selectedZone.segment === 'SEGMENT_B'
                    ? 'Segment B'
                    : 'Unassigned'}
              </div>
            )}
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Position Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Position</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <label style={LABEL_STYLE}>
              X
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={selectedZone.x_mm}
                  onChange={(e) => handleFieldChange('x_mm', parseInt(e.target.value, 10) || 0)}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-zone-x"
                />
                <span style={MM_SUFFIX_STYLE}>mm</span>
              </div>
            </label>
            <label style={LABEL_STYLE}>
              Y
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={selectedZone.y_mm}
                  onChange={(e) => handleFieldChange('y_mm', parseInt(e.target.value, 10) || 0)}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-zone-y"
                />
                <span style={MM_SUFFIX_STYLE}>mm</span>
              </div>
            </label>
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Dimensions Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Dimensions</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <label style={LABEL_STYLE}>
              Width
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={selectedZone.width_mm}
                  onChange={(e) => handleFieldChange('width_mm', parseInt(e.target.value, 10) || 0)}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-zone-width"
                />
                <span style={MM_SUFFIX_STYLE}>mm</span>
              </div>
            </label>
            <label style={LABEL_STYLE}>
              Height
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={selectedZone.height_mm}
                  onChange={(e) => handleFieldChange('height_mm', parseInt(e.target.value, 10) || 0)}
                  style={{ ...INPUT_STYLE, paddingRight: '32px' }}
                  data-testid="input-zone-height"
                />
                <span style={MM_SUFFIX_STYLE}>mm</span>
              </div>
            </label>
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── Strategy Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>Strategy</h4>
          <div style={SECTION_GROUP_STYLE}>
            {/* Width Strategy */}
            <label style={LABEL_STYLE}>
              Width Strategy
              <select
                value={selectedZone.width_strategy}
                onChange={(e) => handleFieldChange('width_strategy', e.target.value)}
                style={INPUT_STYLE}
                data-testid="select-width-strategy"
              >
                {Object.values(ZoneWidthStrategy).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            {/* Height Strategy */}
            <label style={LABEL_STYLE}>
              Height Strategy
              <select
                value={selectedZone.height_strategy}
                onChange={(e) => handleFieldChange('height_strategy', e.target.value)}
                style={INPUT_STYLE}
                data-testid="select-height-strategy"
              >
                {Object.values(ZoneHeightStrategy).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <hr style={SECTION_DIVIDER_STYLE} />

        {/* ─── SKU Assignment Section ─── */}
        <section>
          <h4 style={SECTION_HEADER_STYLE}>SKU Assignment</h4>
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            {sku ? (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                  {sku.sku_code}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', marginTop: '2px' }}>
                  {sku.material} {sku.colour}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-2)' }}>
                No SKU assigned
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                onClick={openBrowser}
                style={BUTTON_PRIMARY_STYLE}
                data-testid="assign-sku-btn"
              >
                Assign SKU
              </button>
              {sku && (
                <button
                  onClick={() => removeSku(selectedZone.zone_id)}
                  style={BUTTON_DESTRUCTIVE_STYLE}
                  data-testid="remove-sku-btn"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
