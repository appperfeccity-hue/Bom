import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import type { DesignFamilyMaster, DesignSubfamilyMaster } from '@/types/database';

const inputStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)', boxSizing: 'border-box' as const };

export function DesignFamilyPage() {
  const {
    designFamilies,
    designSubfamilies,
    isLoading,
    error,
    fetchDesignFamilies,
    createDesignFamily,
    updateDesignFamily,
    deleteDesignFamily,
    fetchDesignSubfamilies,
    createDesignSubfamily,
    updateDesignSubfamily,
    deleteDesignSubfamily,
    clearError,
  } = useAdminStore();

  const [selectedFamily, setSelectedFamily] = useState<DesignFamilyMaster | null>(null);
  const [newName, setNewName] = useState('');
  const [editingFamily, setEditingFamily] = useState<DesignFamilyMaster | null>(null);
  const [editName, setEditName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [editingSub, setEditingSub] = useState<DesignSubfamilyMaster | null>(null);
  const [editSubName, setEditSubName] = useState('');

  useEffect(() => {
    fetchDesignFamilies();
  }, [fetchDesignFamilies]);

  useEffect(() => {
    if (selectedFamily) {
      fetchDesignSubfamilies(selectedFamily.design_family_id);
    }
  }, [selectedFamily, fetchDesignSubfamilies]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createDesignFamily(newName.trim());
    setNewName('');
  };

  const handleUpdate = async () => {
    if (!editingFamily || !editName.trim()) return;
    await updateDesignFamily(editingFamily.design_family_id, editName.trim());
    setEditingFamily(null);
    setEditName('');
  };

  const handleCreateSub = async () => {
    if (!selectedFamily || !newSubName.trim()) return;
    await createDesignSubfamily(selectedFamily.design_family_id, newSubName.trim());
    setNewSubName('');
  };

  const handleUpdateSub = async () => {
    if (!editingSub || !editSubName.trim()) return;
    await updateDesignSubfamily(editingSub.design_subfamily_id, editSubName.trim());
    setEditingSub(null);
    setEditSubName('');
  };

  return (
    <div data-testid="design-family-page">
      <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 24px' }}>
        Design Families
      </h1>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Design Families section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', marginBottom: '12px' }}>Design Families</h2>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            data-testid="new-design-family-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New design family name"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            data-testid="add-design-family-btn"
            onClick={handleCreate}
            style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
          >
            Add
          </button>
        </div>

        <table data-testid="design-families-table" className="table-minimal">
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {designFamilies.map((df) => (
              <tr
                key={df.design_family_id}
                data-testid={`design-family-row-${df.design_family_id}`}
                onClick={() => setSelectedFamily(df)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedFamily?.design_family_id === df.design_family_id ? 'var(--color-nav-active-bg)' : 'transparent',
                }}
              >
                <td>
                  {editingFamily?.design_family_id === df.design_family_id ? (
                    <input
                      data-testid="edit-design-family-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                      style={inputStyle}
                    />
                  ) : (
                    df.name
                  )}
                </td>
                <td style={{ color: 'var(--color-ink-secondary)', fontSize: '13px' }}>
                  {new Date(df.created_at).toLocaleDateString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {editingFamily?.design_family_id === df.design_family_id ? (
                    <>
                      <button onClick={handleUpdate} style={{ marginRight: '4px', cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}>Save</button>
                      <button onClick={() => setEditingFamily(null)} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        data-testid={`edit-df-${df.design_family_id}`}
                        onClick={(e) => { e.stopPropagation(); setEditingFamily(df); setEditName(df.name); }}
                        style={{ marginRight: '4px', background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        data-testid={`delete-df-${df.design_family_id}`}
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete design family "${df.name}"? This cannot be undone.`)) { deleteDesignFamily(df.design_family_id); } }}
                        style={{ cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-error)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subfamilies section */}
      {selectedFamily && (
        <div data-testid="subfamilies-section">
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Subfamilies for: {selectedFamily.name}
          </h2>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              data-testid="new-subfamily-input"
              type="text"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="New subfamily name"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              data-testid="add-subfamily-btn"
              onClick={handleCreateSub}
              style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>

          <table data-testid="subfamilies-table" className="table-minimal">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designSubfamilies.map((sub) => (
                <tr key={sub.design_subfamily_id} data-testid={`subfamily-row-${sub.design_subfamily_id}`}>
                  <td>
                    {editingSub?.design_subfamily_id === sub.design_subfamily_id ? (
                      <input
                        data-testid="edit-subfamily-input"
                        value={editSubName}
                        onChange={(e) => setEditSubName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateSub()}
                        style={inputStyle}
                      />
                    ) : (
                      sub.name
                    )}
                  </td>
                  <td style={{ color: 'var(--color-ink-secondary)', fontSize: '13px' }}>
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingSub?.design_subfamily_id === sub.design_subfamily_id ? (
                      <>
                        <button onClick={handleUpdateSub} style={{ marginRight: '4px', cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}>Save</button>
                        <button onClick={() => setEditingSub(null)} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          data-testid={`edit-sub-${sub.design_subfamily_id}`}
                          onClick={() => { setEditingSub(sub); setEditSubName(sub.name); }}
                          style={{ marginRight: '4px', background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          data-testid={`delete-sub-${sub.design_subfamily_id}`}
                          onClick={() => { if (window.confirm(`Delete subfamily "${sub.name}"? This cannot be undone.`)) { deleteDesignSubfamily(sub.design_subfamily_id); } }}
                          style={{ cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-error)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
