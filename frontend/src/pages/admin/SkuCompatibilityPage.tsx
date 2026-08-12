import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { CompatibilityRelationship, Directionality, SkuStatus } from '@/types/database';

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
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>SKU Compatibility</h1>
        <button
          data-testid="add-compatibility-btn"
          onClick={() => setShowForm(true)}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Add Rule
        </button>
      </div>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Add form */}
      {showForm && (
        <div data-testid="compatibility-form" style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>New Compatibility Rule</h2>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Search SKUs</label>
            <input
              data-testid="sku-search-input"
              type="text"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              placeholder="Filter SKUs by code..."
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box', marginBottom: '8px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Source SKU *</label>
              <select data-testid="source-sku-select" value={sourceSkuId} onChange={(e) => setSourceSkuId(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option value="">Select source SKU</option>
                {filteredSkuOptions.map((sku) => <option key={sku.sku_id} value={sku.sku_id}>{sku.sku_code}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Target SKU *</label>
              <select data-testid="target-sku-select" value={targetSkuId} onChange={(e) => setTargetSkuId(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option value="">Select target SKU</option>
                {filteredSkuOptions.map((sku) => <option key={sku.sku_id} value={sku.sku_id}>{sku.sku_code}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Relationship Type</label>
              <select data-testid="relationship-type-select" value={relationshipType} onChange={(e) => setRelationshipType(e.target.value as CompatibilityRelationship)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                {Object.values(CompatibilityRelationship).map((rt) => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Directionality</label>
              <select data-testid="directionality-select" value={directionality} onChange={(e) => setDirectionality(e.target.value as Directionality)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
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
            <button data-testid="compatibility-form-submit" onClick={handleCreate} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Create
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <table data-testid="compatibility-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>Source SKU</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Target SKU</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Relationship</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Direction</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Mandatory</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {compatibilityRules.map((rule) => (
            <tr key={rule.compatibility_id} data-testid={`rule-row-${rule.compatibility_id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px' }}>{getSkuCode(rule.source_sku_id)}</td>
              <td style={{ padding: '8px' }}>{getSkuCode(rule.target_sku_id)}</td>
              <td style={{ padding: '8px' }}>{rule.relationship_type}</td>
              <td style={{ padding: '8px' }}>{rule.directionality}</td>
              <td style={{ padding: '8px' }}>{rule.is_mandatory ? 'Yes' : 'No'}</td>
              <td style={{ padding: '8px' }}><StatusBadge status={rule.status} /></td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                <button
                  data-testid={`toggle-rule-${rule.compatibility_id}`}
                  onClick={() => handleToggleStatus(rule.compatibility_id, rule.status)}
                  style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', backgroundColor: rule.status === 'ACTIVE' ? '#f97316' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}
                >
                  {rule.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  data-testid={`delete-rule-${rule.compatibility_id}`}
                  onClick={() => { if (window.confirm('Delete this compatibility rule? This cannot be undone.')) { deleteCompatibilityRule(rule.compatibility_id); } }}
                  style={{ cursor: 'pointer', padding: '4px 8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px' }}
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
