import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSkuStore } from '@/stores/skuStore';
import { useSkuRemove } from '@/canvas/interactions/useSkuRemove';
import { useZoneValidation } from '@/canvas/utils/useZoneValidation';
import { ZoneWidthStrategy, ZoneHeightStrategy } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import { clampDimensions, constrainToWall, hasOverlap } from '@/canvas/utils/zoneConstraints';

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
        className="zone-properties-panel"
        style={{
          width: '280px',
          padding: '16px',
          borderLeft: '1px solid #e0e0e0',
          overflowY: 'auto',
        }}
        data-testid="zone-properties-panel"
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>
          Zone Properties
        </h3>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#e3f2fd',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#1565c0',
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
      className="zone-properties-panel"
      style={{
        width: '280px',
        padding: '16px',
        borderLeft: '1px solid #e0e0e0',
        overflowY: 'auto',
      }}
      data-testid="zone-properties-panel"
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600 }}>
        Zone Properties
      </h3>

      {/* Validation errors section */}
      {zoneValidation && zoneValidation.errors.length > 0 && (
        <div
          data-testid="zone-validation-errors"
          style={{
            marginBottom: '16px',
            padding: '10px 12px',
            backgroundColor: '#fbe9e7',
            borderRadius: '4px',
            border: '1px solid #f44336',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#c62828', marginBottom: '6px' }}>
            Validation Errors
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
            {zoneValidation.errors.map((error, i) => (
              <li key={i} style={{ fontSize: '12px', color: '#d32f2f', marginBottom: '4px' }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Zone ID */}
        <label style={{ fontSize: '13px' }}>
          Zone ID
          <input
            type="text"
            value={selectedZone.zone_id}
            readOnly
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="input-zone-name"
          />
        </label>

        {/* Segment badge (L_CORNER only) */}
        {wallGeometry === 'L_CORNER' && (
          <div
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: selectedZone.segment === 'SEGMENT_A'
                ? '#e8f5e9'
                : selectedZone.segment === 'SEGMENT_B'
                  ? '#e3f2fd'
                  : '#fff3e0',
              color: selectedZone.segment === 'SEGMENT_A'
                ? '#2e7d32'
                : selectedZone.segment === 'SEGMENT_B'
                  ? '#1565c0'
                  : '#e65100',
              border: `1px solid ${
                selectedZone.segment === 'SEGMENT_A'
                  ? '#a5d6a7'
                  : selectedZone.segment === 'SEGMENT_B'
                    ? '#90caf9'
                    : '#ffcc80'
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

        {/* Position */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <label style={{ flex: 1, fontSize: '13px' }}>
            X (mm)
            <input
              type="number"
              value={selectedZone.x_mm}
              onChange={(e) => handleFieldChange('x_mm', parseInt(e.target.value, 10) || 0)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
              data-testid="input-zone-x"
            />
          </label>
          <label style={{ flex: 1, fontSize: '13px' }}>
            Y (mm)
            <input
              type="number"
              value={selectedZone.y_mm}
              onChange={(e) => handleFieldChange('y_mm', parseInt(e.target.value, 10) || 0)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
              data-testid="input-zone-y"
            />
          </label>
        </div>

        {/* Dimensions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <label style={{ flex: 1, fontSize: '13px' }}>
            Width (mm)
            <input
              type="number"
              value={selectedZone.width_mm}
              onChange={(e) => handleFieldChange('width_mm', parseInt(e.target.value, 10) || 0)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
              data-testid="input-zone-width"
            />
          </label>
          <label style={{ flex: 1, fontSize: '13px' }}>
            Height (mm)
            <input
              type="number"
              value={selectedZone.height_mm}
              onChange={(e) => handleFieldChange('height_mm', parseInt(e.target.value, 10) || 0)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
              data-testid="input-zone-height"
            />
          </label>
        </div>

        {/* Width Strategy */}
        <label style={{ fontSize: '13px' }}>
          Width Strategy
          <select
            value={selectedZone.width_strategy}
            onChange={(e) => handleFieldChange('width_strategy', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="select-width-strategy"
          >
            {Object.values(ZoneWidthStrategy).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Height Strategy */}
        <label style={{ fontSize: '13px' }}>
          Height Strategy
          <select
            value={selectedZone.height_strategy}
            onChange={(e) => handleFieldChange('height_strategy', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="select-height-strategy"
          >
            {Object.values(ZoneHeightStrategy).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Assigned SKU */}
        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Assigned SKU</div>
          {sku ? (
            <div style={{ fontSize: '13px' }}>
              <strong>{sku.sku_code}</strong>
              <br />
              {sku.material} {sku.colour}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#999' }}>No SKU assigned</div>
          )}
          <button
            onClick={openBrowser}
            style={{ marginTop: '8px', fontSize: '12px', padding: '4px 8px' }}
            data-testid="assign-sku-btn"
          >
            Assign SKU
          </button>
          {sku && (
            <button
              onClick={() => removeSku(selectedZone.zone_id)}
              style={{ marginTop: '4px', marginLeft: '8px', fontSize: '12px', padding: '4px 8px', color: '#d32f2f' }}
              data-testid="remove-sku-btn"
            >
              Remove SKU
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
