import { useState } from 'react';
import type { WallGeometryType } from '@/types/database';
import { AdaptationStrategy } from '@/types/database';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';

export function CreateTemplateDialog() {
  const createTemplate = useTemplateManagementStore((s) => s.createTemplate);
  const closeCreateDialog = useTemplateManagementStore((s) => s.closeCreateDialog);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wallGeometry, setWallGeometry] = useState<WallGeometryType>('STRAIGHT');
  const [baseWidthMm, setBaseWidthMm] = useState<number | ''>('');
  const [baseHeightMm, setBaseHeightMm] = useState<number | ''>('');
  const [adaptationStrategy, setAdaptationStrategy] = useState<AdaptationStrategy>(
    AdaptationStrategy.PROPORTIONAL,
  );
  const [designFamilyId] = useState('default-family');
  const [wallApplication] = useState('WALL_PANEL');
  const [wasteFactor] = useState(0.05);

  const isValid = name.trim() !== '' && baseWidthMm !== '' && baseHeightMm !== '' &&
    baseWidthMm > 0 && baseHeightMm > 0 && baseWidthMm <= 50000 && baseHeightMm <= 50000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    createTemplate({
      name: name.trim(),
      description: description.trim() || undefined,
      wall_geometry: wallGeometry,
      adaptation_strategy: adaptationStrategy,
      design_family_id: designFamilyId,
      wall_application: wallApplication,
      waste_factor: wasteFactor,
    });
  };

  return (
    <div
      data-testid="create-template-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1100,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ margin: 0 }}>Create New Template</h3>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
          Name *
          <input
            data-testid="create-template-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
          Description
          <textarea
            data-testid="create-template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '60px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
          Wall Geometry
          <select
            data-testid="create-template-geometry"
            value={wallGeometry}
            onChange={(e) => setWallGeometry(e.target.value as WallGeometryType)}
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value="STRAIGHT">STRAIGHT</option>
            <option value="L_CORNER">L_CORNER</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', flex: 1 }}>
            Base Width (mm) *
            <input
              data-testid="create-template-width"
              type="number"
              min="1"
              max="50000"
              value={baseWidthMm}
              onChange={(e) => setBaseWidthMm(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', flex: 1 }}>
            Base Height (mm) *
            <input
              data-testid="create-template-height"
              type="number"
              min="1"
              max="50000"
              value={baseHeightMm}
              onChange={(e) => setBaseHeightMm(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>
        </div>
        {((baseWidthMm !== '' && (baseWidthMm <= 0 || baseWidthMm > 50000)) ||
          (baseHeightMm !== '' && (baseHeightMm <= 0 || baseHeightMm > 50000))) && (
          <span data-testid="create-template-dimension-error" style={{ color: '#d32f2f', fontSize: '12px' }}>
            Dimensions must be between 1 and 50,000 mm
          </span>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
          Adaptation Strategy
          <select
            data-testid="create-template-strategy"
            value={adaptationStrategy}
            onChange={(e) => setAdaptationStrategy(e.target.value as AdaptationStrategy)}
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            <option value={AdaptationStrategy.PROPORTIONAL}>PROPORTIONAL</option>
            <option value={AdaptationStrategy.PRIORITY_ZONE}>PRIORITY_ZONE</option>
            <option value={AdaptationStrategy.EQUAL_DISTRIBUTION}>EQUAL_DISTRIBUTION</option>
            <option value={AdaptationStrategy.FIXED}>FIXED</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="create-template-cancel-btn"
            onClick={closeCreateDialog}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#f5f5f5',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="create-template-submit-btn"
            disabled={!isValid}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isValid ? '#1976d2' : '#bdbdbd',
              color: '#ffffff',
              cursor: isValid ? 'pointer' : 'default',
            }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
