import { useEffect, useMemo, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { SkuStatus } from '@/types/database';
import type {
  SkuDependency,
  SkuDependencyCondition,
  SkuDependencyQuantityRule,
  SkuDependencyType,
  SkuDependencyUnit,
} from '@/types/database';

const DEPENDENCY_TYPES: SkuDependencyType[] = ['REQUIRED', 'CONDITIONAL', 'OPTIONAL'];
const QUANTITY_RULES: SkuDependencyQuantityRule[] = ['PER_PARENT', 'PER_AREA', 'PER_LENGTH', 'PER_EDGE', 'FIXED'];
const UNITS: SkuDependencyUnit[] = ['PCS', 'M', 'M2'];
const OPERATORS: SkuDependencyCondition['operator'][] = ['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'];

const QUANTITY_RULE_HELP: Record<SkuDependencyQuantityRule, string> = {
  PER_PARENT: 'child qty = parent qty × factor',
  PER_AREA: 'child qty = ceil(parent area m² × factor)',
  PER_LENGTH: 'child qty = ceil(parent edge length m × factor)',
  PER_EDGE: 'child qty = parent edge count × factor',
  FIXED: 'child qty = factor',
};

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

const inputStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)', boxSizing: 'border-box' as const };
const selectStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 'var(--weight-semibold)' as const, marginBottom: '4px', color: 'var(--color-ink-primary)' };
const helpStyle = { fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: '4px' };

function formatCondition(condition: SkuDependencyCondition | null): string {
  if (!condition) return '—';
  return `${condition.field} ${condition.operator} ${String(condition.value)}`;
}

export function SkuDependencyPage() {
  const {
    skuDependencies,
    skus,
    isLoading,
    error,
    fetchSkuDependencies,
    createSkuDependency,
    updateSkuDependency,
    deleteSkuDependency,
    fetchSkus,
    clearError,
  } = useAdminStore();

  const [showForm, setShowForm] = useState(false);
  const [parentSkuId, setParentSkuId] = useState('');
  const [childSkuId, setChildSkuId] = useState('');
  const [dependencyType, setDependencyType] = useState<SkuDependencyType>('REQUIRED');
  const [quantityRule, setQuantityRule] = useState<SkuDependencyQuantityRule>('PER_PARENT');
  const [quantityFactor, setQuantityFactor] = useState('1');
  const [unit, setUnit] = useState<SkuDependencyUnit>('PCS');
  const [conditionField, setConditionField] = useState('mountingType');
  const [conditionOperator, setConditionOperator] = useState<SkuDependencyCondition['operator']>('EQ');
  const [conditionValue, setConditionValue] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [parentFilter, setParentFilter] = useState('');

  useEffect(() => {
    fetchSkuDependencies();
    fetchSkus();
  }, [fetchSkuDependencies, fetchSkus]);

  const filteredSkuOptions = skus.filter((sku) =>
    sku.sku_code.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const getSkuCode = (skuId: string): string =>
    skus.find((s) => s.sku_id === skuId)?.sku_code ?? skuId;

  const visibleRows = useMemo(
    () => (parentFilter ? skuDependencies.filter((d) => d.parent_sku_id === parentFilter) : skuDependencies),
    [skuDependencies, parentFilter],
  );

  const factorNumber = Number(quantityFactor);
  const conditionValid =
    dependencyType !== 'CONDITIONAL' || (conditionField.trim() !== '' && conditionValue.trim() !== '');
  const canSubmit =
    parentSkuId !== '' &&
    childSkuId !== '' &&
    parentSkuId !== childSkuId &&
    Number.isFinite(factorNumber) &&
    factorNumber > 0 &&
    conditionValid;

  const resetForm = () => {
    setShowForm(false);
    setParentSkuId('');
    setChildSkuId('');
    setDependencyType('REQUIRED');
    setQuantityRule('PER_PARENT');
    setQuantityFactor('1');
    setUnit('PCS');
    setConditionField('mountingType');
    setConditionOperator('EQ');
    setConditionValue('');
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    const numericValue = Number(conditionValue);
    const condition: SkuDependencyCondition | null =
      dependencyType === 'CONDITIONAL'
        ? {
            field: conditionField.trim(),
            operator: conditionOperator,
            value: conditionValue.trim() !== '' && Number.isFinite(numericValue) ? numericValue : conditionValue.trim(),
          }
        : null;
    const dep: Partial<SkuDependency> = {
      parent_sku_id: parentSkuId,
      child_sku_id: childSkuId,
      dependency_type: dependencyType,
      condition,
      quantity_rule: quantityRule,
      quantity_factor: factorNumber,
      unit_of_measure: unit,
      status: SkuStatus.ACTIVE,
    };
    await createSkuDependency(dep);
    resetForm();
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? SkuStatus.INACTIVE : SkuStatus.ACTIVE;
    await updateSkuDependency(id, { status: newStatus });
  };

  return (
    <div data-testid="sku-dependency-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: 0 }}>SKU Dependencies</h1>
        <button
          data-testid="add-dependency-btn"
          onClick={() => setShowForm(true)}
          style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
        >
          Add Dependency
        </button>
      </div>

      <p style={{ ...helpStyle, marginBottom: '16px' }}>
        Parent → child rules the BOM expands recursively. Compatibility rules only validate a selection; dependencies generate child lines.
      </p>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {showForm && (
        <div data-testid="dependency-form" style={{ padding: '20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 16px' }}>New SKU Dependency</h2>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Search SKUs</label>
            <input
              data-testid="sku-search-input"
              type="text"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              placeholder="Filter SKUs by code..."
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Parent SKU *</label>
              <select data-testid="parent-sku-select" value={parentSkuId} onChange={(e) => setParentSkuId(e.target.value)} style={selectStyle}>
                <option value="">Select parent SKU</option>
                {filteredSkuOptions.map((sku) => <option key={sku.sku_id} value={sku.sku_id}>{sku.sku_code}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Child SKU *</label>
              <select data-testid="child-sku-select" value={childSkuId} onChange={(e) => setChildSkuId(e.target.value)} style={selectStyle}>
                <option value="">Select child SKU</option>
                {filteredSkuOptions.map((sku) => <option key={sku.sku_id} value={sku.sku_id}>{sku.sku_code}</option>)}
              </select>
              {parentSkuId !== '' && parentSkuId === childSkuId && (
                <div style={{ ...helpStyle, color: 'var(--color-error)' }}>A SKU cannot depend on itself.</div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Dependency Type</label>
              <select data-testid="dependency-type-select" value={dependencyType} onChange={(e) => setDependencyType(e.target.value as SkuDependencyType)} style={selectStyle}>
                {DEPENDENCY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Quantity Rule</label>
              <select data-testid="quantity-rule-select" value={quantityRule} onChange={(e) => setQuantityRule(e.target.value as SkuDependencyQuantityRule)} style={selectStyle}>
                {QUANTITY_RULES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div style={helpStyle}>{QUANTITY_RULE_HELP[quantityRule]}</div>
            </div>
            <div>
              <label style={labelStyle}>Quantity Factor *</label>
              <input
                data-testid="quantity-factor-input"
                type="number"
                min="0.0001"
                step="0.0001"
                value={quantityFactor}
                onChange={(e) => setQuantityFactor(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <select data-testid="unit-select" value={unit} onChange={(e) => setUnit(e.target.value as SkuDependencyUnit)} style={selectStyle}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {dependencyType === 'CONDITIONAL' && (
            <div data-testid="condition-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={labelStyle}>Condition Field *</label>
                <input data-testid="condition-field-input" type="text" value={conditionField} onChange={(e) => setConditionField(e.target.value)} placeholder="e.g. mountingType" style={inputStyle} />
                <div style={helpStyle}>Evaluated against the parent line (mountingType, mode, productType, ...).</div>
              </div>
              <div>
                <label style={labelStyle}>Operator</label>
                <select data-testid="condition-operator-select" value={conditionOperator} onChange={(e) => setConditionOperator(e.target.value as SkuDependencyCondition['operator'])} style={selectStyle}>
                  {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Value *</label>
                <input data-testid="condition-value-input" type="text" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} placeholder="e.g. COVE" style={inputStyle} />
              </div>
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button
              data-testid="dependency-form-submit"
              onClick={handleCreate}
              disabled={!canSubmit}
              style={{ backgroundColor: canSubmit ? 'var(--color-accent)' : 'var(--color-disabled)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              Create
            </button>
            <button onClick={resetForm} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '12px', maxWidth: '320px' }}>
        <label style={labelStyle}>Filter by parent SKU</label>
        <select data-testid="parent-filter-select" value={parentFilter} onChange={(e) => setParentFilter(e.target.value)} style={selectStyle}>
          <option value="">All parents</option>
          {[...new Set(skuDependencies.map((d) => d.parent_sku_id))].map((id) => (
            <option key={id} value={id}>{getSkuCode(id)}</option>
          ))}
        </select>
      </div>

      <table data-testid="dependency-table" className="table-minimal">
        <thead>
          <tr>
            <th>Parent SKU</th>
            <th>Child SKU</th>
            <th>Type</th>
            <th>Condition</th>
            <th>Quantity Rule</th>
            <th>Factor</th>
            <th>Unit</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((dep) => (
            <tr key={dep.dependency_id} data-testid={`dependency-row-${dep.dependency_id}`}>
              <td>{getSkuCode(dep.parent_sku_id)}</td>
              <td>{getSkuCode(dep.child_sku_id)}</td>
              <td>{dep.dependency_type}</td>
              <td>{formatCondition(dep.condition)}</td>
              <td>{dep.quantity_rule}</td>
              <td>{dep.quantity_factor}</td>
              <td>{dep.unit_of_measure}</td>
              <td><StatusBadge status={dep.status} /></td>
              <td style={{ textAlign: 'right' }}>
                <button
                  data-testid={`toggle-dependency-${dep.dependency_id}`}
                  onClick={() => handleToggleStatus(dep.dependency_id, dep.status)}
                  style={{ marginRight: '4px', cursor: 'pointer', padding: '6px 12px', backgroundColor: dep.status === 'ACTIVE' ? 'var(--color-warning)' : 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                >
                  {dep.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  data-testid={`delete-dependency-${dep.dependency_id}`}
                  onClick={() => { if (window.confirm('Delete this dependency? This cannot be undone.')) { deleteSkuDependency(dep.dependency_id); } }}
                  style={{ cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-error)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {visibleRows.length === 0 && !isLoading && (
            <tr>
              <td colSpan={9} style={{ color: 'var(--color-ink-secondary)' }}>No dependencies defined.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
