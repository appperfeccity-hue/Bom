import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { CompatibilityRelationship, Directionality, SkuStatus } from '@/types/database';

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

export function SkuCompatibilityPage() {
  const {
    compatibilityRules,
    skus,
    isLoading,
    error,
    fetchCompatibilityRules,
    createCompatibilityRule,
    updateCompatibilityRule,
    deleteCompatibilityRule,
    fetchSkus,
    clearError,
  } = useAdminStore();

  const [showForm, setShowForm] = useState(false);
  const [sourceSkuId, setSourceSkuId] = useState('');
  const [targetSkuId, setTargetSkuId] = useState('');
  const [relationshipType, setRelationshipType] = useState<CompatibilityRelationship>(CompatibilityRelationship.REQUIRES);
  const [directionality, setDirectionality] = useState<Directionality>(Directionality.UNIDIRECTIONAL);
  const [isMandatory, setIsMandatory] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');

  useEffect(() => {
    fetchCompatibilityRules();
    fetchSkus();
  }, [fetchCompatibilityRules, fetchSkus]);

  const filteredSkuOptions = skus.filter((sku) =>
    sku.sku_code.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const handleCreate = async () => {
    if (!sourceSkuId || !targetSkuId) return;
    await createCompatibilityRule({
      source_sku_id: sourceSkuId,
      target_sku_id: targetSkuId,
      relationship_type: relationshipType,
      directionality,
      is_mandatory: isMandatory,
      status: SkuStatus.ACTIVE,
    });
    setShowForm(false);
    setSourceSkuId('');
    setTargetSkuId('');
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? SkuStatus.INACTIVE : SkuStatus.ACTIVE;
    await updateCompatibilityRule(id, { status: newStatus });
  };

  const getSkuCode = (skuId: string): string => {
    return skus.find((s) => s.sku_id === skuId)?.sku_code ?? skuId;
  };

  return (
    <div data-testid="sku-compatibility-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: 0 }}>SKU Compatibility</h1>
        <button
          data-testid="add-compatibility-btn"
          onClick={() => setShowForm(true)}
          style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
        >
          Add Rule
        </button>
      </div>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Add form */}
      {showForm && (
        <div data-testid="compatibility-form" style={{ padding: '20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 16px' }}>New Compatibility Rule</h2>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Search SKUs</label>
            <input
              data-testid="sku-search-input"
              type="text"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              placeholder="Filter SKUs by code..."
              style={{ ...inputStyle, marginBottom: '8px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Source SKU *</label>
              <select data-testid="source-sku-select" value={sourceSkuId} onChange={(e) => setSourceSkuId(e.target.value)} style={selectStyle}>
                <option value="">Select source SKU</option>
                {filteredSkuOptions.map((sku) => <option key={sku.sku_id} value={sku.sku_id}>{sku.sku_code}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target SKU *</label>
              <select data-testid="target-sku-select" value={targetSkuId} onChange={(e) => setTargetSkuId(e.target.value)} style={selectStyle}>
                <option value="">Select target SKU</option>
                {filteredSkuOptions.map((sku) => <option key={sku.sku_id} value={sku.sku_id}>{sku.sku_code}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Relationship Type</label>
              <select data-testid="relationship-type-select" value={relationshipType} onChange={(e) => setRelationshipType(e.target.value as CompatibilityRelationship)} style={selectStyle}>
                {Object.values(CompatibilityRelationship).map((rt) => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Directionality</label>
              <select data-testid="directionality-select" value={directionality} onChange={(e) => setDirectionality(e.target.value as Directionality)} style={selectStyle}>
                {Object.values(Directionality).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input data-testid="is-mandatory-toggle" type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} />
              Is Mandatory
            </label>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button data-testid="compatibility-form-submit" onClick={handleCreate} style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}>
              Create
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <table data-testid="compatibility-table" className="table-minimal">
        <thead>
          <tr>
            <th>Source SKU</th>
            <th>Target SKU</th>
            <th>Relationship</th>
            <th>Direction</th>
            <th>Mandatory</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {compatibilityRules.map((rule) => (
            <tr key={rule.compatibility_id} data-testid={`rule-row-${rule.compatibility_id}`}>
              <td>{getSkuCode(rule.source_sku_id)}</td>
              <td>{getSkuCode(rule.target_sku_id)}</td>
              <td>{rule.relationship_type}</td>
              <td>{rule.directionality}</td>
              <td>{rule.is_mandatory ? 'Yes' : 'No'}</td>
              <td><StatusBadge status={rule.status} /></td>
              <td style={{ textAlign: 'right' }}>
                <button
                  data-testid={`toggle-rule-${rule.compatibility_id}`}
                  onClick={() => handleToggleStatus(rule.compatibility_id, rule.status)}
                  style={{ marginRight: '4px', cursor: 'pointer', padding: '6px 12px', backgroundColor: rule.status === 'ACTIVE' ? 'var(--color-warning)' : 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                >
                  {rule.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  data-testid={`delete-rule-${rule.compatibility_id}`}
                  onClick={() => { if (window.confirm('Delete this compatibility rule? This cannot be undone.')) { deleteCompatibilityRule(rule.compatibility_id); } }}
                  style={{ cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-error)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
