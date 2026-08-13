import type { Template } from '@/types/database';

interface TemplateCardProps {
  template: Template;
  onSelect: (template: Template) => void;
}

/**
 * TemplateCard - displays a single template in the Design Library grid.
 * Shows name, description, wall_geometry badge, base dimensions, and status badge.
 */
export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <div
      data-testid="template-card"
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{template.name}</h4>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#e8f5e9',
            color: '#2e7d32',
          }}
        >
          {template.status}
        </span>
      </div>

      {template.description && (
        <p style={{ margin: 0, fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
          {template.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#e3f2fd',
            color: '#1565c0',
          }}
        >
          {template.wall_geometry.type}
        </span>
        <span style={{ fontSize: '11px', color: '#888' }}>
          {template.wall_geometry.base_width_mm} x {template.wall_geometry.base_height_mm} mm
        </span>
      </div>

      <button
        data-testid="template-select-btn"
        onClick={() => onSelect(template)}
        style={{
          marginTop: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: '#1976d2',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Select
      </button>
    </div>
  );
}
