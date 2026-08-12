import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import type { DesignFamilyMaster, DesignSubfamilyMaster } from '@/types/database';

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
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
        Design Families
      </h1>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Design Families section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Design Families</h2>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            data-testid="new-design-family-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New design family name"
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }}
          />
          <button
            data-testid="add-design-family-btn"
            onClick={handleCreate}
            style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Add
          </button>
        </div>

        <table data-testid="design-families-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '8px', textAlign: 'left' }}>Created</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {designFamilies.map((df) => (
              <tr
                key={df.design_family_id}
                data-testid={`design-family-row-${df.design_family_id}`}
                onClick={() => setSelectedFamily(df)}
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  backgroundColor: selectedFamily?.design_family_id === df.design_family_id ? '#eff6ff' : 'transparent',
                }}
              >
                <td style={{ padding: '8px' }}>
                  {editingFamily?.design_family_id === df.design_family_id ? (
                    <input
                      data-testid="edit-design-family-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                      style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  ) : (
                    df.name
                  )}
                </td>
                <td style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>
                  {new Date(df.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  {editingFamily?.design_family_id === df.design_family_id ? (
                    <>
                      <button onClick={handleUpdate} style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}>Save</button>
                      <button onClick={() => setEditingFamily(null)} style={{ cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        data-testid={`edit-df-${df.design_family_id}`}
                        onClick={(e) => { e.stopPropagation(); setEditingFamily(df); setEditName(df.name); }}
                        style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      >
                        Edit
                      </button>
                      <button
                        data-testid={`delete-df-${df.design_family_id}`}
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete design family "${df.name}"? This cannot be undone.`)) { deleteDesignFamily(df.design_family_id); } }}
                        style={{ cursor: 'pointer', padding: '4px 8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px' }}
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
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
            Subfamilies for: {selectedFamily.name}
          </h2>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              data-testid="new-subfamily-input"
              type="text"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="New subfamily name"
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }}
            />
            <button
              data-testid="add-subfamily-btn"
              onClick={handleCreateSub}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>

          <table data-testid="subfamilies-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Created</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designSubfamilies.map((sub) => (
                <tr key={sub.design_subfamily_id} data-testid={`subfamily-row-${sub.design_subfamily_id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px' }}>
                    {editingSub?.design_subfamily_id === sub.design_subfamily_id ? (
                      <input
                        data-testid="edit-subfamily-input"
                        value={editSubName}
                        onChange={(e) => setEditSubName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateSub()}
                        style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    ) : (
                      sub.name
                    )}
                  </td>
                  <td style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {editingSub?.design_subfamily_id === sub.design_subfamily_id ? (
                      <>
                        <button onClick={handleUpdateSub} style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}>Save</button>
                        <button onClick={() => setEditingSub(null)} style={{ cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          data-testid={`edit-sub-${sub.design_subfamily_id}`}
                          onClick={() => { setEditingSub(sub); setEditSubName(sub.name); }}
                          style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        >
                          Edit
                        </button>
                        <button
                          data-testid={`delete-sub-${sub.design_subfamily_id}`}
                          onClick={() => { if (window.confirm(`Delete subfamily "${sub.name}"? This cannot be undone.`)) { deleteDesignSubfamily(sub.design_subfamily_id); } }}
                          style={{ cursor: 'pointer', padding: '4px 8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px' }}
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
