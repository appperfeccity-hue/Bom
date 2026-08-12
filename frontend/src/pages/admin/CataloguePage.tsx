import { useEffect, useState, useRef } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { supabase } from '@/lib/supabase';
import { AssetType, CatalogueStatus } from '@/types/database';
import type { CatalogueEntry } from '@/types/database';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    READY: { bg: '#dcfce7', color: '#16a34a' },
    INCOMPLETE: { bg: '#fff7ed', color: '#ea580c' },
  };
  const style = colors[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span data-testid={`status-badge-${status}`} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

export function CataloguePage() {
  const {
    catalogueEntries,
    catalogueAssets,
    isLoading,
    error,
    fetchCatalogueEntries,
    fetchCatalogueAssets,
    uploadCatalogueAsset,
    approveCatalogueEntry,
    clearError,
  } = useAdminStore();

  const [selectedEntry, setSelectedEntry] = useState<CatalogueEntry | null>(null);
  const [uploadAssetType, setUploadAssetType] = useState<AssetType>(AssetType.GEOMETRY);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCatalogueEntries();
  }, [fetchCatalogueEntries]);

  useEffect(() => {
    if (selectedEntry) {
      fetchCatalogueAssets(selectedEntry.catalogue_entry_id);
    }
  }, [selectedEntry, fetchCatalogueAssets]);

  const handleUpload = async () => {
    if (!selectedEntry || !fileInputRef.current?.files?.[0]) return;
    const file = fileInputRef.current.files[0];
    await uploadCatalogueAsset(
      selectedEntry.catalogue_entry_id,
      selectedEntry.sku_id,
      uploadAssetType,
      file,
    );
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePreview = async (fileReference: string) => {
    if (previewUrls[fileReference]) return;
    const { data } = await supabase.storage
      .from('catalogue-assets')
      .createSignedUrl(fileReference, 3600);
    if (data?.signedUrl) {
      setPreviewUrls((prev) => ({ ...prev, [fileReference]: data.signedUrl }));
    }
  };

  const getAcceptedTypes = (): string => {
    switch (uploadAssetType) {
      case AssetType.GEOMETRY:
        return '.svg';
      case AssetType.PATTERN:
        return '.png';
      case AssetType.RENDER:
        return '.png,.jpeg,.jpg';
      default:
        return '*';
    }
  };

  return (
    <div data-testid="catalogue-page">
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
        Catalogue Management
      </h1>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Entries table */}
      <table data-testid="catalogue-entries-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', marginBottom: '24px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>SKU ID</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {catalogueEntries.map((entry) => (
            <tr
              key={entry.catalogue_entry_id}
              data-testid={`catalogue-entry-${entry.catalogue_entry_id}`}
              onClick={() => setSelectedEntry(entry)}
              style={{
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                backgroundColor: selectedEntry?.catalogue_entry_id === entry.catalogue_entry_id ? '#eff6ff' : 'transparent',
              }}
            >
              <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '13px' }}>{entry.sku_id}</td>
              <td style={{ padding: '8px' }}><StatusBadge status={entry.status} /></td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {entry.status === CatalogueStatus.INCOMPLETE && (
                  <button
                    data-testid={`approve-entry-${entry.catalogue_entry_id}`}
                    onClick={(e) => { e.stopPropagation(); approveCatalogueEntry(entry.catalogue_entry_id); }}
                    style={{ padding: '4px 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Approve Ready
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Assets section */}
      {selectedEntry && (
        <div data-testid="assets-section" style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>
            Assets for entry: {selectedEntry.catalogue_entry_id.slice(0, 8)}...
          </h2>

          {/* Upload form */}
          <div data-testid="upload-form" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Asset Type</label>
              <select
                data-testid="upload-asset-type"
                value={uploadAssetType}
                onChange={(e) => setUploadAssetType(e.target.value as AssetType)}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              >
                {Object.values(AssetType).map((at) => <option key={at} value={at}>{at}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>File</label>
              <input
                data-testid="upload-file-input"
                type="file"
                ref={fileInputRef}
                accept={getAcceptedTypes()}
                style={{ fontSize: '13px' }}
              />
            </div>
            <button
              data-testid="upload-btn"
              onClick={handleUpload}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Upload
            </button>
          </div>

          {/* Assets list */}
          <table data-testid="assets-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Version</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>File</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Current</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {catalogueAssets.map((asset) => (
                <tr key={asset.asset_id} data-testid={`asset-row-${asset.asset_id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px' }}>{asset.asset_type}</td>
                  <td style={{ padding: '8px' }}>{asset.version}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{asset.file_reference}</td>
                  <td style={{ padding: '8px' }}>{asset.status}</td>
                  <td style={{ padding: '8px' }}>{asset.is_current ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <button
                      data-testid={`preview-asset-${asset.asset_id}`}
                      onClick={() => handlePreview(asset.file_reference)}
                      style={{ cursor: 'pointer', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    >
                      Preview
                    </button>
                    {previewUrls[asset.file_reference] && (
                      <div style={{ marginTop: '4px' }}>
                        <img
                          data-testid={`preview-img-${asset.asset_id}`}
                          src={previewUrls[asset.file_reference]}
                          alt={asset.asset_type}
                          style={{ maxWidth: '100px', maxHeight: '60px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                        />
                      </div>
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
