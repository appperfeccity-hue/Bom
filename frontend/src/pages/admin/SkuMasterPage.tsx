import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { ProductType, SkuStatus } from '@/types/database';
import type { SkuMaster } from '@/types/database';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: '#dcfce7', color: '#16a34a' },
    INACTIVE: { bg: '#f3f4f6', color: '#6b7280' },
  };
  const style = colors[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span data-testid={`status-badge-${status}`} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: style.bg, color: style.color }}>
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
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>SKU Master</h1>
        <button
          data-testid="add-sku-btn"
          onClick={() => { setShowForm(true); setEditingSku(null); setForm(emptyForm); setValidationErrors([]); }}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Add SKU
        </button>
      </div>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '16px' }}>
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
          style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
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
          style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* SKU Form */}
      {showForm && (
        <div data-testid="sku-form" style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>{editingSku ? 'Edit SKU' : 'Create SKU'}</h2>

          {validationErrors.length > 0 && (
            <div data-testid="validation-errors" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '12px' }}>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>SKU Code *</label>
              <input data-testid="sku-form-code" value={form.sku_code} onChange={(e) => updateFormField('sku_code', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Product Type *</label>
              <select data-testid="sku-form-product-type" value={form.product_type} onChange={(e) => updateFormField('product_type', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                {Object.values(ProductType).map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Family *</label>
              <select data-testid="sku-form-family" value={form.family_id} onChange={(e) => updateFormField('family_id', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option value="">Select family</option>
                {families.map((f) => <option key={f.family_id} value={f.family_id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Category *</label>
              <select data-testid="sku-form-category" value={form.category_id} onChange={(e) => updateFormField('category_id', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Width (mm){form.product_type === ProductType.WALL_PANEL || form.product_type === ProductType.LIGHT || form.product_type === ProductType.FURNITURE ? ' *' : ''}</label>
              <input data-testid="sku-form-width" type="number" value={form.width_mm} onChange={(e) => updateFormField('width_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Height (mm){form.product_type === ProductType.WALL_PANEL || form.product_type === ProductType.LIGHT || form.product_type === ProductType.FURNITURE ? ' *' : ''}</label>
              <input data-testid="sku-form-height" type="number" value={form.height_mm} onChange={(e) => updateFormField('height_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Thickness (mm){form.product_type === ProductType.WALL_PANEL ? ' *' : ''}</label>
              <input data-testid="sku-form-thickness" type="number" value={form.thickness_mm} onChange={(e) => updateFormField('thickness_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Depth (mm){form.product_type === ProductType.FURNITURE ? ' *' : ''}</label>
              <input data-testid="sku-form-depth" type="number" value={form.depth_mm} onChange={(e) => updateFormField('depth_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Unit Length (mm)</label>
              <input data-testid="sku-form-unit-length" type="number" value={form.unit_length_mm} onChange={(e) => updateFormField('unit_length_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Material *</label>
              <input data-testid="sku-form-material" value={form.material} onChange={(e) => updateFormField('material', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Colour *</label>
              <input data-testid="sku-form-colour" value={form.colour} onChange={(e) => updateFormField('colour', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Finish *</label>
              <input data-testid="sku-form-finish" value={form.finish} onChange={(e) => updateFormField('finish', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Pattern Identity</label>
              <input data-testid="sku-form-pattern" value={form.pattern_identity} onChange={(e) => updateFormField('pattern_identity', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>GH (mm) [0-10]</label>
              <input data-testid="sku-form-gh" type="number" min="0" max="10" value={form.gh_mm} onChange={(e) => updateFormField('gh_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>GV (mm) [0-10]</label>
              <input data-testid="sku-form-gv" type="number" min="0" max="10" value={form.gv_mm} onChange={(e) => updateFormField('gv_mm', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Quantity Mode</label>
              <select data-testid="sku-form-quantity-mode" value={form.quantity_mode} onChange={(e) => updateFormField('quantity_mode', e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option value="">None</option>
                <option value="DISCRETE">DISCRETE</option>
                <option value="LINEAR">LINEAR</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button data-testid="sku-form-submit" onClick={handleSubmit} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {editingSku ? 'Update' : 'Create'}
            </button>
            <button data-testid="sku-form-cancel" onClick={() => { setShowForm(false); setEditingSku(null); setValidationErrors([]); }} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SKU Table */}
      <table data-testid="sku-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>SKU Code</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Product Type</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Material</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Dimensions</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSkus.map((sku) => (
            <tr key={sku.sku_id} data-testid={`sku-row-${sku.sku_id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{sku.sku_code}</td>
              <td style={{ padding: '8px' }}>{sku.product_type}</td>
              <td style={{ padding: '8px' }}>{sku.material}</td>
              <td style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>
                {sku.width_mm && `W:${sku.width_mm}`}
                {sku.height_mm && ` H:${sku.height_mm}`}
                {sku.thickness_mm && ` T:${sku.thickness_mm}`}
                {sku.depth_mm && ` D:${sku.depth_mm}`}
              </td>
              <td style={{ padding: '8px' }}><StatusBadge status={sku.status} /></td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                <button
                  data-testid={`edit-sku-${sku.sku_id}`}
                  onClick={() => handleEdit(sku)}
                  style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                >
                  Edit
                </button>
                <button
                  data-testid={`toggle-sku-${sku.sku_id}`}
                  onClick={() => handleToggleStatus(sku)}
                  style={{ cursor: 'pointer', padding: '4px 8px', backgroundColor: sku.status === SkuStatus.ACTIVE ? '#f97316' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}
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
