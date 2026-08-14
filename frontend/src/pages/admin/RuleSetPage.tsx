import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { RuleSetStatus } from '@/types/database';
import type { RuleSet } from '@/types/database';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: 'rgba(154,123,79,0.1)', color: 'var(--color-accent)' },
    ACTIVE: { bg: 'rgba(63,107,79,0.1)', color: 'var(--color-success)' },
    SUPERSEDED: { bg: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' },
  };
  const style = colors[status] ?? { bg: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
  return (
    <span data-testid={`status-badge-${status}`} style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

function getNextStatus(current: string): string | null {
  if (current === RuleSetStatus.DRAFT) return RuleSetStatus.ACTIVE;
  if (current === RuleSetStatus.ACTIVE) return RuleSetStatus.SUPERSEDED;
  return null;
}

const inputStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)', boxSizing: 'border-box' as const };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 'var(--weight-semibold)' as const, marginBottom: '4px', color: 'var(--color-ink-primary)' };

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
        <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: 0 }}>Rule Sets</h1>
        <button
          data-testid="add-rule-set-btn"
          onClick={() => { setShowForm(true); setEditingRuleSet(null); resetForm(); }}
          style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
        >
          Add Rule Set
        </button>
      </div>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Form */}
      {showForm && (
        <div data-testid="rule-set-form" style={{ padding: '20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 16px' }}>{editingRuleSet ? 'Edit Rule Set' : 'Create Rule Set'}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Code *</label>
              <input data-testid="rule-set-form-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Version</label>
              <input data-testid="rule-set-form-version" type="number" value={formVersion} onChange={(e) => setFormVersion(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Effective From</label>
              <input data-testid="rule-set-form-from" type="date" value={formEffectiveFrom} onChange={(e) => setFormEffectiveFrom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Effective To</label>
              <input data-testid="rule-set-form-to" type="date" value={formEffectiveTo} onChange={(e) => setFormEffectiveTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Constants (JSON) *</label>
            <textarea
              data-testid="rule-set-form-constants"
              value={formConstants}
              onChange={(e) => setFormConstants(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '13px', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-primary)' }}
            />
            {jsonError && (
              <p data-testid="json-error" style={{ color: 'var(--color-error)', fontSize: '13px', margin: '4px 0 0' }}>{jsonError}</p>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button data-testid="rule-set-form-submit" onClick={handleSubmit} style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}>
              {editingRuleSet ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingRuleSet(null); }} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <table data-testid="rule-sets-table" className="table-minimal">
        <thead>
          <tr>
            <th>Code</th>
            <th>Version</th>
            <th>Status</th>
            <th>Effective From</th>
            <th>Effective To</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ruleSets.map((rs) => (
            <tr key={rs.rule_set_id} data-testid={`rule-set-row-${rs.rule_set_id}`}>
              <td style={{ fontWeight: 'var(--weight-semibold)' }}>{rs.rule_set_code}</td>
              <td>{rs.version}</td>
              <td><StatusBadge status={rs.status} /></td>
              <td style={{ fontSize: '13px', color: 'var(--color-ink-secondary)' }}>{rs.effective_from ?? '-'}</td>
              <td style={{ fontSize: '13px', color: 'var(--color-ink-secondary)' }}>{rs.effective_to ?? '-'}</td>
              <td style={{ textAlign: 'right' }}>
                <button
                  data-testid={`edit-rs-${rs.rule_set_id}`}
                  onClick={() => handleEdit(rs)}
                  style={{ marginRight: '4px', background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                >
                  Edit
                </button>
                {getNextStatus(rs.status) && (
                  <button
                    data-testid={`transition-rs-${rs.rule_set_id}`}
                    onClick={() => handleTransition(rs)}
                    style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
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
