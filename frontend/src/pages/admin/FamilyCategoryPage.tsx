import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import type { FamilyMaster, CategoryMaster } from '@/types/database';

const inputStyle = { display: 'block', width: '100%', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)', boxSizing: 'border-box' as const };

export function FamilyCategoryPage() {
  const {
    families,
    categories,
    isLoading,
    error,
    fetchFamilies,
    createFamily,
    updateFamily,
    deleteFamily,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    clearError,
  } = useAdminStore();

  const [selectedFamily, setSelectedFamily] = useState<FamilyMaster | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [editingFamily, setEditingFamily] = useState<FamilyMaster | null>(null);
  const [editFamilyName, setEditFamilyName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<CategoryMaster | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  useEffect(() => {
    if (selectedFamily) {
      fetchCategories(selectedFamily.family_id);
    }
  }, [selectedFamily, fetchCategories]);

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) return;
    await createFamily(newFamilyName.trim());
    setNewFamilyName('');
  };

  const handleUpdateFamily = async () => {
    if (!editingFamily || !editFamilyName.trim()) return;
    await updateFamily(editingFamily.family_id, editFamilyName.trim());
    setEditingFamily(null);
    setEditFamilyName('');
  };

  const handleCreateCategory = async () => {
    if (!selectedFamily || !newCategoryName.trim()) return;
    await createCategory(selectedFamily.family_id, newCategoryName.trim());
    setNewCategoryName('');
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    await updateCategory(editingCategory.category_id, editCategoryName.trim());
    setEditingCategory(null);
    setEditCategoryName('');
  };

  return (
    <div data-testid="family-category-page">
      <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 24px' }}>
        Families & Categories
      </h1>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Families section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', marginBottom: '12px' }}>Families</h2>

        {/* Add family form */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            data-testid="new-family-input"
            type="text"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            placeholder="New family name"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            data-testid="add-family-btn"
            onClick={handleCreateFamily}
            style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
          >
            Add Family
          </button>
        </div>

        {/* Families table */}
        <table data-testid="families-table" className="table-minimal">
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {families.map((family) => (
              <tr
                key={family.family_id}
                data-testid={`family-row-${family.family_id}`}
                onClick={() => setSelectedFamily(family)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedFamily?.family_id === family.family_id ? 'var(--color-nav-active-bg)' : 'transparent',
                }}
              >
                <td>
                  {editingFamily?.family_id === family.family_id ? (
                    <input
                      data-testid="edit-family-input"
                      value={editFamilyName}
                      onChange={(e) => setEditFamilyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateFamily()}
                      style={inputStyle}
                    />
                  ) : (
                    family.name
                  )}
                </td>
                <td style={{ color: 'var(--color-ink-secondary)', fontSize: '13px' }}>
                  {new Date(family.created_at).toLocaleDateString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {editingFamily?.family_id === family.family_id ? (
                    <>
                      <button onClick={handleUpdateFamily} style={{ marginRight: '4px', cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}>Save</button>
                      <button onClick={() => setEditingFamily(null)} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        data-testid={`edit-family-${family.family_id}`}
                        onClick={(e) => { e.stopPropagation(); setEditingFamily(family); setEditFamilyName(family.name); }}
                        style={{ marginRight: '4px', background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        data-testid={`delete-family-${family.family_id}`}
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete family "${family.name}"? This cannot be undone.`)) { deleteFamily(family.family_id); } }}
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

      {/* Categories section */}
      {selectedFamily && (
        <div data-testid="categories-section">
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Categories for: {selectedFamily.name}
          </h2>

          {/* Add category form */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              data-testid="new-category-input"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              data-testid="add-category-btn"
              onClick={handleCreateCategory}
              style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
            >
              Add Category
            </button>
          </div>

          {/* Categories table */}
          <table data-testid="categories-table" className="table-minimal">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.category_id} data-testid={`category-row-${category.category_id}`}>
                  <td>
                    {editingCategory?.category_id === category.category_id ? (
                      <input
                        data-testid="edit-category-input"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory()}
                        style={inputStyle}
                      />
                    ) : (
                      category.name
                    )}
                  </td>
                  <td style={{ color: 'var(--color-ink-secondary)', fontSize: '13px' }}>
                    {new Date(category.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingCategory?.category_id === category.category_id ? (
                      <>
                        <button onClick={handleUpdateCategory} style={{ marginRight: '4px', cursor: 'pointer', padding: '6px 12px', backgroundColor: 'var(--color-success)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-base)' }}>Save</button>
                        <button onClick={() => setEditingCategory(null)} style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          data-testid={`edit-category-${category.category_id}`}
                          onClick={() => { setEditingCategory(category); setEditCategoryName(category.name); }}
                          style={{ marginRight: '4px', background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          data-testid={`delete-category-${category.category_id}`}
                          onClick={() => { if (window.confirm(`Delete category "${category.name}"? This cannot be undone.`)) { deleteCategory(category.category_id); } }}
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
