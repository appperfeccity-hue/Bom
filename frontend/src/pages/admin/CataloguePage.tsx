import { useEffect, useState, useRef } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { supabase } from '@/lib/supabase';
import { AssetType, CatalogueStatus } from '@/types/database';
import type { CatalogueEntry } from '@/types/database';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    READY: { bg: 'rgba(63,107,79,0.1)', color: 'var(--color-success)' },
    INCOMPLETE: { bg: 'rgba(166,106,45,0.1)', color: 'var(--color-warning)' },
  };
  const style = colors[status] ?? { bg: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
  return (
    <span data-testid={`status-badge-${status}`} style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', backgroundColor: style.bg, color: style.color }}>
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
      <h1 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 24px' }}>
        Catalogue Management
      </h1>

      {error && (
        <div data-testid="admin-error" style={{ padding: '12px', backgroundColor: 'rgba(176,65,62,0.08)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
          {error}
          <button onClick={clearError} style={{ marginLeft: '8px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {isLoading && <p data-testid="admin-loading">Loading...</p>}

      {/* Entries table */}
      <table data-testid="catalogue-entries-table" className="table-minimal" style={{ marginBottom: '24px' }}>
        <thead>
          <tr>
            <th>SKU ID</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {catalogueEntries.map((entry) => (
            <tr
              key={entry.catalogue_entry_id}
              data-testid={`catalogue-entry-${entry.catalogue_entry_id}`}
              onClick={() => setSelectedEntry(entry)}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedEntry?.catalogue_entry_id === entry.catalogue_entry_id ? 'var(--color-nav-active-bg)' : 'transparent',
              }}
            >
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{entry.sku_id}</td>
              <td><StatusBadge status={entry.status} /></td>
              <td style={{ textAlign: 'right' }}>
                {entry.status === CatalogueStatus.INCOMPLETE && (
                  <button
                    data-testid={`approve-entry-${entry.catalogue_entry_id}`}
                    onClick={(e) => { e.stopPropagation(); approveCatalogueEntry(entry.catalogue_entry_id); }}
                    style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
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
        <div data-testid="assets-section" style={{ padding: '20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)' }}>
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-ink-secondary)', letterSpacing: '0.05em', margin: '0 0 16px' }}>
            Assets for entry: {selectedEntry.catalogue_entry_id.slice(0, 8)}...
          </h2>

          {/* Upload form */}
          <div data-testid="upload-form" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'var(--weight-semibold)', marginBottom: '4px', color: 'var(--color-ink-primary)' }}>Asset Type</label>
              <select
                data-testid="upload-asset-type"
                value={uploadAssetType}
                onChange={(e) => setUploadAssetType(e.target.value as AssetType)}
                style={{ display: 'block', height: '32px', padding: '0 8px', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--text-base)', color: 'var(--color-ink-primary)' }}
              >
                {Object.values(AssetType).map((at) => <option key={at} value={at}>{at}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'var(--weight-semibold)', marginBottom: '4px', color: 'var(--color-ink-primary)' }}>File</label>
              <input
                data-testid="upload-file-input"
                type="file"
                ref={fileInputRef}
                accept={getAcceptedTypes()}
                style={{ fontSize: 'var(--text-base)' }}
              />
            </div>
            <button
              data-testid="upload-btn"
              onClick={handleUpload}
              style={{ backgroundColor: 'var(--color-accent)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
            >
              Upload
            </button>
          </div>

          {/* Assets list */}
          <table data-testid="assets-table" className="table-minimal">
            <thead>
              <tr>
                <th>Type</th>
                <th>Version</th>
                <th>File</th>
                <th>Status</th>
                <th>Current</th>
                <th style={{ textAlign: 'right' }}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {catalogueAssets.map((asset) => (
                <tr key={asset.asset_id} data-testid={`asset-row-${asset.asset_id}`}>
                  <td>{asset.asset_type}</td>
                  <td>{asset.version}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{asset.file_reference}</td>
                  <td>{asset.status}</td>
                  <td>{asset.is_current ? 'Yes' : 'No'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      data-testid={`preview-asset-${asset.asset_id}`}
                      onClick={() => handlePreview(asset.file_reference)}
                      style={{ background: 'transparent', border: '1px solid var(--color-disabled)', color: 'var(--color-ink-primary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-base)', cursor: 'pointer' }}
                    >
                      Preview
                    </button>
                    {previewUrls[asset.file_reference] && (
                      <div style={{ marginTop: '4px' }}>
                        <img
                          data-testid={`preview-img-${asset.asset_id}`}
                          src={previewUrls[asset.file_reference]}
                          alt={asset.asset_type}
                          style={{ maxWidth: '100px', maxHeight: '60px', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)' }}
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
