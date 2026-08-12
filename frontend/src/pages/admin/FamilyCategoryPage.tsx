import { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import type { FamilyMaster, CategoryMaster } from '@/types/database';

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
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
        Families & Categories
      </h1>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Families section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Families</h2>

        {/* Add family form */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            data-testid="new-family-input"
            type="text"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            placeholder="New family name"
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }}
          />
          <button
            data-testid="add-family-btn"
            onClick={handleCreateFamily}
            style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Add Family
          </button>
        </div>

        {/* Families table */}
        <table data-testid="families-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '8px', textAlign: 'left' }}>Created</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {families.map((family) => (
              <tr
                key={family.family_id}
                data-testid={`family-row-${family.family_id}`}
                onClick={() => setSelectedFamily(family)}
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  backgroundColor: selectedFamily?.family_id === family.family_id ? '#eff6ff' : 'transparent',
                }}
              >
                <td style={{ padding: '8px' }}>
                  {editingFamily?.family_id === family.family_id ? (
                    <input
                      data-testid="edit-family-input"
                      value={editFamilyName}
                      onChange={(e) => setEditFamilyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateFamily()}
                      style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  ) : (
                    family.name
                  )}
                </td>
                <td style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>
                  {new Date(family.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  {editingFamily?.family_id === family.family_id ? (
                    <>
                      <button onClick={handleUpdateFamily} style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}>Save</button>
                      <button onClick={() => setEditingFamily(null)} style={{ cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        data-testid={`edit-family-${family.family_id}`}
                        onClick={(e) => { e.stopPropagation(); setEditingFamily(family); setEditFamilyName(family.name); }}
                        style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      >
                        Edit
                      </button>
                      <button
                        data-testid={`delete-family-${family.family_id}`}
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete family "${family.name}"? This cannot be undone.`)) { deleteFamily(family.family_id); } }}
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

      {/* Categories section */}
      {selectedFamily && (
        <div data-testid="categories-section">
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
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
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }}
            />
            <button
              data-testid="add-category-btn"
              onClick={handleCreateCategory}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Add Category
            </button>
          </div>

          {/* Categories table */}
          <table data-testid="categories-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Created</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.category_id} data-testid={`category-row-${category.category_id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px' }}>
                    {editingCategory?.category_id === category.category_id ? (
                      <input
                        data-testid="edit-category-input"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory()}
                        style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    ) : (
                      category.name
                    )}
                  </td>
                  <td style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>
                    {new Date(category.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {editingCategory?.category_id === category.category_id ? (
                      <>
                        <button onClick={handleUpdateCategory} style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}>Save</button>
                        <button onClick={() => setEditingCategory(null)} style={{ cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          data-testid={`edit-category-${category.category_id}`}
                          onClick={() => { setEditingCategory(category); setEditCategoryName(category.name); }}
                          style={{ marginRight: '4px', cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        >
                          Edit
                        </button>
                        <button
                          data-testid={`delete-category-${category.category_id}`}
                          onClick={() => { if (window.confirm(`Delete category "${category.name}"? This cannot be undone.`)) { deleteCategory(category.category_id); } }}
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
