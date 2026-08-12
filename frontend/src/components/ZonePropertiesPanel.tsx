import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { ZoneWidthStrategy, ZoneHeightStrategy } from '@/types/database';
import type { TemplateZone } from '@/types/database';

/**
 * Side panel for DESIGNER mode when a zone is selected.
 * Shows zone dimensions, position, strategy selectors, and assigned SKU.
 */
export function ZonePropertiesPanel() {
  const selection = useCanvasStore((s) => s.selection);
  const zones = useProjectStore((s) => s.zones);
  const zoneSku = useProjectStore((s) => s.zoneSku);
  const updateZone = useProjectStore((s) => s.updateZone);

  const selectedZone = zones.find((z) => z.id === selection.selectedZoneId);

  const handleFieldChange = useCallback(
    (field: keyof TemplateZone, value: string | number) => {
      if (!selectedZone) return;
      const updated = { ...selectedZone, [field]: value };
      void updateZone(updated);
    },
    [selectedZone, updateZone],
  );

  if (!selectedZone) return null;

  const sku = zoneSku.get(selectedZone.id);

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Zone name */}
        <label style={{ fontSize: '13px' }}>
          Name
          <input
            type="text"
            value={selectedZone.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px' }}
            data-testid="input-zone-name"
          />
        </label>

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
              {sku.name}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#999' }}>No SKU assigned</div>
          )}
          <button
            style={{ marginTop: '8px', fontSize: '12px', padding: '4px 8px' }}
            data-testid="assign-sku-btn"
          >
            Assign SKU
          </button>
        </div>
      </div>
    </div>
  );
}
