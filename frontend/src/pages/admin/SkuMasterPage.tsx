import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { ProductType, SkuStatus } from '@/types/database';
import type { SkuMaster } from '@/types/database';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: 'rgba(63,107,79,0.1)', color: 'var(--color-success)' },
    INACTIVE: { bg: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' },
  };
  const style = colors[status] ?? { bg: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
  return (
    <span data-testid={`status-badge-${status}`} style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

interface SkuFormData {
  sku_code: string;
  product_type: ProductType;
  family_id: string;
  category_id: string;
  width_mm: string;
  height_mm: string;
  thickness_mm: string;
  depth_mm: string;
  unit_length_mm: string;
  material: string;
  colour: string;
  finish: string;
  pattern_identity: string;
  gh_mm: string;
  gv_mm: string;
  quantity_mode: string;
}

const emptyForm: SkuFormData = {
  sku_code: '',
  product_type: ProductType.WALL_PANEL,
  family_id: '',
  category_id: '',
  width_mm: '',
  height_mm: '',
  thickness_mm: '',
  depth_mm: '',
  unit_length_mm: '',
  material: '',
  colour: '',
  finish: '',
  pattern_identity: '',
  gh_mm: '0',
  gv_mm: '0',
  quantity_mode: '',
};

function validateForm(form: SkuFormData): string[] {
  const errors: string[] = [];

  if (!form.sku_code.trim()) errors.push('SKU code is required');
  if (!form.family_id.trim()) errors.push('Family is required');
  if (!form.category_id.trim()) errors.push('Category is required');
  if (!form.material.trim()) errors.push('Material is required');
  if (!form.colour.trim()) errors.push('Colour is required');
  if (!form.finish.trim()) errors.push('Finish is required');

  const ghVal = parseFloat(form.gh_mm);
  const gvVal = parseFloat(form.gv_mm);
  if (isNaN(ghVal) || ghVal < 0 || ghVal > 10) errors.push('gh_mm must be between 0 and 10');
  if (isNaN(gvVal) || gvVal < 0 || gvVal > 10) errors.push('gv_mm must be between 0 and 10');

  // Product-type-dependent validation
  if (form.product_type === ProductType.WALL_PANEL) {
    const w = parseFloat(form.width_mm);
    if (!form.width_mm || isNaN(w) || w <= 0) errors.push('Width is required and must be > 0 for WALL_PANEL');
    if (!form.height_mm) errors.push('Height is required for WALL_PANEL');
    if (!form.thickness_mm) errors.push('Thickness is required for WALL_PANEL');
  } else if (form.product_type === ProductType.LIGHT) {
    const w = parseFloat(form.width_mm);
    if (!form.width_mm || isNaN(w) || w <= 0) errors.push('Width is required and must be > 0 for LIGHT');
    if (!form.height_mm) errors.push('Height is required for LIGHT');
  } else if (form.product_type === ProductType.FURNITURE) {
    const w = parseFloat(form.width_mm);
    if (!form.width_mm || isNaN(w) || w <= 0) errors.push('Width is required and must be > 0 for FURNITURE');
    if (!form.height_mm) errors.push('Height is required for FURNITURE');
    if (!form.depth_mm) errors.push('Depth is required for FURNITURE');
  }

  // If width is provided, it must be > 0
  if (form.width_mm && parseFloat(form.width_mm) <= 0) {
    if (!errors.some(e => e.includes('Width'))) {
      errors.push('Width must be > 0');
    }
  }

  return errors;
}

const inputStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)', boxSizing: 'border-box' as const };
const selectStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 'var(--weight-semibold)' as const, marginBottom: '4px', color: 'var(--color-ink-primary)' };

export function SkuMasterPage() {
  const { skus, families, categories, isLoading, error, fetchSkus, fetchFamilies, fetchCategories, createSku, updateSku, clearError } = useAdminStore();

  const [showForm, setShowForm] = useState(false);
  const [editingSku, setEditingSku] = useState<SkuMaster | null>(null);
  const [form, setForm] = useState<SkuFormData>(emptyForm);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [filterProductType, setFilterProductType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    fetchSkus();
    fetchFamilies();
    fetchCategories();
  }, [fetchSkus, fetchFamilies, fetchCategories]);

  const filteredSkus = skus.filter((sku) => {
    if (filterProductType && sku.product_type !== filterProductType) return false;
    if (filterStatus && sku.status !== filterStatus) return false;
    return true;
  });

  const handleEdit = (sku: SkuMaster) => {
    setEditingSku(sku);
    setForm({
      sku_code: sku.sku_code,
      product_type: sku.product_type,
      family_id: sku.family_id,
      category_id: sku.category_id,
      width_mm: sku.width_mm?.toString() ?? '',
      height_mm: sku.height_mm?.toString() ?? '',
      thickness_mm: sku.thickness_mm?.toString() ?? '',
      depth_mm: sku.depth_mm?.toString() ?? '',
      unit_length_mm: sku.unit_length_mm?.toString() ?? '',
      material: sku.material,
      colour: sku.colour,
      finish: sku.finish,
      pattern_identity: sku.pattern_identity ?? '',
      gh_mm: sku.gh_mm.toString(),
      gv_mm: sku.gv_mm.toString(),
      quantity_mode: sku.quantity_mode ?? '',
    });
    setShowForm(true);
    setValidationErrors([]);
  };

  const handleSubmit = async () => {
    const errors = validateForm(form);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const payload: Partial<SkuMaster> = {
      sku_code: form.sku_code.trim(),
      product_type: form.product_type,
      family_id: form.family_id,
      category_id: form.category_id,
      width_mm: form.width_mm ? parseFloat(form.width_mm) : null,
      height_mm: form.height_mm ? parseFloat(form.height_mm) : null,
      thickness_mm: form.thickness_mm ? parseFloat(form.thickness_mm) : null,
      depth_mm: form.depth_mm ? parseFloat(form.depth_mm) : null,
      unit_length_mm: form.unit_length_mm ? parseFloat(form.unit_length_mm) : null,
      material: form.material.trim(),
      colour: form.colour.trim(),
      finish: form.finish.trim(),
      pattern_identity: form.pattern_identity.trim() || null,
      gh_mm: parseFloat(form.gh_mm),
      gv_mm: parseFloat(form.gv_mm),
      quantity_mode: form.quantity_mode ? (form.quantity_mode as SkuMaster['quantity_mode']) : null,
    };

    if (editingSku) {
      await updateSku(editingSku.sku_id, payload);
    } else {
      await createSku(payload);
    }

    setShowForm(false);
    setEditingSku(null);
    setForm(emptyForm);
  };

  const handleToggleStatus = async (sku: SkuMaster) => {
    const newStatus = sku.status === SkuStatus.ACTIVE ? SkuStatus.INACTIVE : SkuStatus.ACTIVE;
    await updateSku(sku.sku_id, { status: newStatus });
  };

  const updateFormField = (field: keyof SkuFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div data-testid="sku-master-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: 0 }}>SKU Master</h1>
        <button
          data-testid="add-sku-btn"
          onClick={() => { setShowForm(true); setEditingSku(null); setForm(emptyForm); setValidationErrors([]); }}
          style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
        >
          Add SKU
        </button>
      </div>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div data-testid="sku-filters" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <select
          data-testid="filter-product-type"
          value={filterProductType}
          onChange={(e) => setFilterProductType(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Product Types</option>
          {Object.values(ProductType).map((pt) => (
            <option key={pt} value={pt}>{pt}</option>
          ))}
        </select>
        <select
          data-testid="filter-status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* SKU Form */}
      {showForm && (
        <div data-testid="sku-form" style={{ padding: '20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 16px' }}>{editingSku ? 'Edit SKU' : 'Create SKU'}</h2>

          {validationErrors.length > 0 && (
            <div data-testid="validation-errors" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <label style={labelStyle}>SKU Code *</label>
              <input data-testid="sku-form-code" value={form.sku_code} onChange={(e) => updateFormField('sku_code', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Product Type *</label>
              <select data-testid="sku-form-product-type" value={form.product_type} onChange={(e) => updateFormField('product_type', e.target.value)} style={selectStyle}>
                {Object.values(ProductType).map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Family *</label>
              <select data-testid="sku-form-family" value={form.family_id} onChange={(e) => updateFormField('family_id', e.target.value)} style={selectStyle}>
                <option value="">Select family</option>
                {families.map((f) => <option key={f.family_id} value={f.family_id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category *</label>
              <select data-testid="sku-form-category" value={form.category_id} onChange={(e) => updateFormField('category_id', e.target.value)} style={selectStyle}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Width (mm){form.product_type === ProductType.WALL_PANEL || form.product_type === ProductType.LIGHT || form.product_type === ProductType.FURNITURE ? ' *' : ''}</label>
              <input data-testid="sku-form-width" type="number" value={form.width_mm} onChange={(e) => updateFormField('width_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Height (mm){form.product_type === ProductType.WALL_PANEL || form.product_type === ProductType.LIGHT || form.product_type === ProductType.FURNITURE ? ' *' : ''}</label>
              <input data-testid="sku-form-height" type="number" value={form.height_mm} onChange={(e) => updateFormField('height_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Thickness (mm){form.product_type === ProductType.WALL_PANEL ? ' *' : ''}</label>
              <input data-testid="sku-form-thickness" type="number" value={form.thickness_mm} onChange={(e) => updateFormField('thickness_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Depth (mm){form.product_type === ProductType.FURNITURE ? ' *' : ''}</label>
              <input data-testid="sku-form-depth" type="number" value={form.depth_mm} onChange={(e) => updateFormField('depth_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Unit Length (mm)</label>
              <input data-testid="sku-form-unit-length" type="number" value={form.unit_length_mm} onChange={(e) => updateFormField('unit_length_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Material *</label>
              <input data-testid="sku-form-material" value={form.material} onChange={(e) => updateFormField('material', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Colour *</label>
              <input data-testid="sku-form-colour" value={form.colour} onChange={(e) => updateFormField('colour', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Finish *</label>
              <input data-testid="sku-form-finish" value={form.finish} onChange={(e) => updateFormField('finish', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pattern Identity</label>
              <input data-testid="sku-form-pattern" value={form.pattern_identity} onChange={(e) => updateFormField('pattern_identity', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>GH (mm) [0-10]</label>
              <input data-testid="sku-form-gh" type="number" min="0" max="10" value={form.gh_mm} onChange={(e) => updateFormField('gh_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>GV (mm) [0-10]</label>
              <input data-testid="sku-form-gv" type="number" min="0" max="10" value={form.gv_mm} onChange={(e) => updateFormField('gv_mm', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Quantity Mode</label>
              <select data-testid="sku-form-quantity-mode" value={form.quantity_mode} onChange={(e) => updateFormField('quantity_mode', e.target.value)} style={selectStyle}>
                <option value="">None</option>
                <option value="DISCRETE">DISCRETE</option>
                <option value="LINEAR">LINEAR</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button data-testid="sku-form-submit" onClick={handleSubmit} style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}>
              {editingSku ? 'Update' : 'Create'}
            </button>
            <button data-testid="sku-form-cancel" onClick={() => { setShowForm(false); setEditingSku(null); setValidationErrors([]); }} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SKU Table */}
      <table data-testid="sku-table" className="table-minimal">
        <thead>
          <tr>
            <th>SKU Code</th>
            <th>Product Type</th>
            <th>Material</th>
            <th>Dimensions</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSkus.map((sku) => (
            <tr key={sku.sku_id} data-testid={`sku-row-${sku.sku_id}`}>
              <td style={{ fontWeight: 'var(--weight-semibold)' }}>{sku.sku_code}</td>
              <td>{sku.product_type}</td>
              <td>{sku.material}</td>
              <td style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                {sku.width_mm && `W:${sku.width_mm}`}
                {sku.height_mm && ` H:${sku.height_mm}`}
                {sku.thickness_mm && ` T:${sku.thickness_mm}`}
                {sku.depth_mm && ` D:${sku.depth_mm}`}
              </td>
              <td><StatusBadge status={sku.status} /></td>
              <td style={{ textAlign: 'right' }}>
                <button
                  data-testid={`edit-sku-${sku.sku_id}`}
                  onClick={() => handleEdit(sku)}
                  style={{ marginRight: '4px', background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  data-testid={`toggle-sku-${sku.sku_id}`}
                  onClick={() => handleToggleStatus(sku)}
                  style={{ cursor: 'pointer', padding: '6px 12px', backgroundColor: sku.status === SkuStatus.ACTIVE ? 'var(--color-warning)' : 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                >
                  {sku.status === SkuStatus.ACTIVE ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
