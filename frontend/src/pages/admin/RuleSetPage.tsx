import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { RuleSetStatus } from '@/types/database';
import type { RuleSet } from '@/types/database';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: '#dbeafe', color: '#2563eb' },
    ACTIVE: { bg: '#dcfce7', color: '#16a34a' },
    SUPERSEDED: { bg: '#f3f4f6', color: '#6b7280' },
  };
  const style = colors[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span data-testid={`status-badge-${status}`} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

function getNextStatus(current: string): string | null {
  if (current === RuleSetStatus.DRAFT) return RuleSetStatus.ACTIVE;
  if (current === RuleSetStatus.ACTIVE) return RuleSetStatus.SUPERSEDED;
  return null;
}

export function RuleSetPage() {
  const {
    ruleSets,
    isLoading,
    error,
    fetchRuleSets,
    createRuleSet,
    updateRuleSet,
    transitionRuleSetStatus,
    clearError,
  } = useAdminStore();

  const [showForm, setShowForm] = useState(false);
  const [editingRuleSet, setEditingRuleSet] = useState<RuleSet | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formVersion, setFormVersion] = useState('1');
  const [formConstants, setFormConstants] = useState('{}');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    fetchRuleSets();
  }, [fetchRuleSets]);

  const handleEdit = (rs: RuleSet) => {
    setEditingRuleSet(rs);
    setFormCode(rs.rule_set_code);
    setFormVersion(rs.version.toString());
    setFormConstants(JSON.stringify(rs.constants, null, 2));
    setFormEffectiveFrom(rs.effective_from ?? '');
    setFormEffectiveTo(rs.effective_to ?? '');
    setShowForm(true);
    setJsonError(null);
  };

  const handleSubmit = async () => {
    // Validate JSON
    let parsedConstants: Record<string, unknown>;
    try {
      parsedConstants = JSON.parse(formConstants);
    } catch {
      setJsonError('Invalid JSON in constants field');
      return;
    }
    setJsonError(null);

    const payload: Partial<RuleSet> = {
      rule_set_code: formCode.trim(),
      version: parseInt(formVersion, 10),
      constants: parsedConstants,
      effective_from: formEffectiveFrom || null,
      effective_to: formEffectiveTo || null,
    };

    if (editingRuleSet) {
      await updateRuleSet(editingRuleSet.rule_set_id, payload);
    } else {
      await createRuleSet({ ...payload, status: RuleSetStatus.DRAFT });
    }

    setShowForm(false);
    setEditingRuleSet(null);
    resetForm();
  };

  const resetForm = () => {
    setFormCode('');
    setFormVersion('1');
    setFormConstants('{}');
    setFormEffectiveFrom('');
    setFormEffectiveTo('');
    setJsonError(null);
  };

  const handleTransition = async (rs: RuleSet) => {
    const next = getNextStatus(rs.status);
    if (next) {
      await transitionRuleSetStatus(rs.rule_set_id, next);
    }
  };

  return (
    <div data-testid="rule-set-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Rule Sets</h1>
        <button
          data-testid="add-rule-set-btn"
          onClick={() => { setShowForm(true); setEditingRuleSet(null); resetForm(); }}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Add Rule Set
        </button>
      </div>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Form */}
      {showForm && (
        <div data-testid="rule-set-form" style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>{editingRuleSet ? 'Edit Rule Set' : 'Create Rule Set'}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Code *</label>
              <input data-testid="rule-set-form-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Version</label>
              <input data-testid="rule-set-form-version" type="number" value={formVersion} onChange={(e) => setFormVersion(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Effective From</label>
              <input data-testid="rule-set-form-from" type="date" value={formEffectiveFrom} onChange={(e) => setFormEffectiveFrom(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Effective To</label>
              <input data-testid="rule-set-form-to" type="date" value={formEffectiveTo} onChange={(e) => setFormEffectiveTo(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Constants (JSON) *</label>
            <textarea
              data-testid="rule-set-form-constants"
              value={formConstants}
              onChange={(e) => setFormConstants(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', boxSizing: 'border-box' }}
            />
            {jsonError && (
              <p data-testid="json-error" style={{ color: '#dc2626', fontSize: '13px', margin: '4px 0 0' }}>{jsonError}</p>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button data-testid="rule-set-form-submit" onClick={handleSubmit} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {editingRuleSet ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingRuleSet(null); }} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <table data-testid="rule-sets-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>Code</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Version</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Effective From</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Effective To</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ruleSets.map((rs) => (
            <tr key={rs.rule_set_id} data-testid={`rule-set-row-${rs.rule_set_id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{rs.rule_set_code}</td>
              <td style={{ padding: '8px' }}>{rs.version}</td>
              <td style={{ padding: '8px' }}><StatusBadge status={rs.status} /></td>
              <td style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>{rs.effective_from ?? '-'}</td>
              <td style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>{rs.effective_to ?? '-'}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                <button
                  data-testid={`edit-rs-${rs.rule_set_id}`}
                  onClick={() => handleEdit(rs)}
                  style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                >
                  Edit
                </button>
                {getNextStatus(rs.status) && (
                  <button
                    data-testid={`transition-rs-${rs.rule_set_id}`}
                    onClick={() => handleTransition(rs)}
                    style={{ cursor: 'pointer', padding: '4px 8px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px' }}
                  >
                    {rs.status === RuleSetStatus.DRAFT ? 'Activate' : 'Supersede'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
