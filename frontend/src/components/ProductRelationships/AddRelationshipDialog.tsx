import { useState, useEffect, useRef } from 'react';
import { fromTable } from '@/lib/supabase';
import { CompatibilityRelationship, Directionality, SkuStatus } from '@/types/database';
import type { SkuMaster } from '@/types/database';

interface AddRelationshipDialogProps {
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to create a new SKU compatibility relationship.
 * Provides SKU search for source and target, relationship type, directionality, and mandatory flag.
 */
export function AddRelationshipDialog({ onClose, onAdded }: AddRelationshipDialogProps) {
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [sourceSkus, setSourceSkus] = useState<SkuMaster[]>([]);
  const [targetSkus, setTargetSkus] = useState<SkuMaster[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState<CompatibilityRelationship>(CompatibilityRelationship.REQUIRES);
  const [directionality, setDirectionality] = useState<Directionality>(Directionality.UNIDIRECTIONAL);
  const [isMandatory, setIsMandatory] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);

  const sourceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search source SKUs with 300ms debounce
  useEffect(() => {
    if (!sourceQuery.trim()) {
      setSourceSkus([]);
      return;
    }
    let cancelled = false;
    if (sourceTimerRef.current) {
      clearTimeout(sourceTimerRef.current);
    }
    sourceTimerRef.current = setTimeout(() => {
      const fetchSkus = async () => {
        setIsLoadingSource(true);
        const { data } = await fromTable('sku_master')
          .select('*')
          .ilike('sku_code', `%${sourceQuery}%`)
          .eq('status', 'ACTIVE')
          .range(0, 19);
        if (!cancelled && data) {
          setSourceSkus(data as SkuMaster[]);
        }
        if (!cancelled) setIsLoadingSource(false);
      };
      fetchSkus();
    }, 300);
    return () => {
      cancelled = true;
      if (sourceTimerRef.current) {
        clearTimeout(sourceTimerRef.current);
      }
    };
  }, [sourceQuery]);

  // Search target SKUs with 300ms debounce
  useEffect(() => {
    if (!targetQuery.trim()) {
      setTargetSkus([]);
      return;
    }
    let cancelled = false;
    if (targetTimerRef.current) {
      clearTimeout(targetTimerRef.current);
    }
    targetTimerRef.current = setTimeout(() => {
      const fetchSkus = async () => {
        setIsLoadingTarget(true);
        const { data } = await fromTable('sku_master')
          .select('*')
          .ilike('sku_code', `%${targetQuery}%`)
          .eq('status', 'ACTIVE')
          .range(0, 19);
        if (!cancelled && data) {
          setTargetSkus(data as SkuMaster[]);
        }
        if (!cancelled) setIsLoadingTarget(false);
      };
      fetchSkus();
    }, 300);
    return () => {
      cancelled = true;
      if (targetTimerRef.current) {
        clearTimeout(targetTimerRef.current);
      }
    };
  }, [targetQuery]);

  const handleConfirm = async () => {
    setValidationError(null);
    setWriteError(null);

    if (!selectedSourceId || !selectedTargetId) return;

    if (selectedSourceId === selectedTargetId) {
      setValidationError('Source and target SKU must be different.');
      return;
    }

    setIsSaving(true);

    const { error } = await fromTable('sku_compatibility').insert({
      source_sku_id: selectedSourceId,
      target_sku_id: selectedTargetId,
      relationship_type: relationshipType,
      directionality: directionality,
      is_mandatory: isMandatory,
      status: SkuStatus.ACTIVE,
    });

    setIsSaving(false);

    if (error) {
      setWriteError(
        typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to save relationship'
      );
      return;
    }

    onAdded();
  };

  return (
    <div
      data-testid="add-relationship-dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '24px',
          width: '520px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Product Relationship</h3>

        {/* Source SKU Search */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Source SKU
          </label>
          <input
            data-testid="source-sku-search"
            type="text"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            placeholder="Search source SKU..."
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
          {isLoadingSource && <div style={{ fontSize: '12px', color: '#666' }}>Loading...</div>}
          <div style={{ maxHeight: '120px', overflow: 'auto' }}>
            {sourceSkus.map((sku) => (
              <div
                key={sku.sku_id}
                data-testid={`source-sku-option-${sku.sku_id}`}
                onClick={() => setSelectedSourceId(sku.sku_id)}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  backgroundColor: selectedSourceId === sku.sku_id ? '#e3f2fd' : 'transparent',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                <strong>{sku.sku_code}</strong> - {sku.product_type}
              </div>
            ))}
          </div>
        </div>

        {/* Target SKU Search */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Target SKU
          </label>
          <input
            data-testid="target-sku-search"
            type="text"
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder="Search target SKU..."
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
          {isLoadingTarget && <div style={{ fontSize: '12px', color: '#666' }}>Loading...</div>}
          <div style={{ maxHeight: '120px', overflow: 'auto' }}>
            {targetSkus.map((sku) => (
              <div
                key={sku.sku_id}
                data-testid={`target-sku-option-${sku.sku_id}`}
                onClick={() => setSelectedTargetId(sku.sku_id)}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  backgroundColor: selectedTargetId === sku.sku_id ? '#e3f2fd' : 'transparent',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                <strong>{sku.sku_code}</strong> - {sku.product_type}
              </div>
            ))}
          </div>
        </div>

        {/* Relationship Type */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Relationship Type
          </label>
          <select
            data-testid="relationship-type-select"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value as CompatibilityRelationship)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            <option value={CompatibilityRelationship.REQUIRES}>REQUIRES</option>
            <option value={CompatibilityRelationship.COMPATIBLE_WITH}>COMPATIBLE_WITH</option>
            <option value={CompatibilityRelationship.ALTERNATIVE_TO}>ALTERNATIVE_TO</option>
          </select>
        </div>

        {/* Directionality */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Directionality
          </label>
          <select
            data-testid="directionality-select"
            value={directionality}
            onChange={(e) => setDirectionality(e.target.value as Directionality)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            <option value={Directionality.UNIDIRECTIONAL}>UNIDIRECTIONAL</option>
            <option value={Directionality.BIDIRECTIONAL}>BIDIRECTIONAL</option>
          </select>
        </div>

        {/* Is Mandatory */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
            <input
              data-testid="mandatory-checkbox"
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
            />
            Mandatory Relationship
          </label>
        </div>

        {validationError && (
          <div
            data-testid="validation-error"
            style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: '4px', fontSize: '12px' }}
          >
            {validationError}
          </div>
        )}

        {writeError && (
          <div
            data-testid="write-error"
            style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: '12px' }}
          >
            {writeError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            data-testid="cancel-btn"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="confirm-btn"
            onClick={handleConfirm}
            disabled={!selectedSourceId || !selectedTargetId || isSaving}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#1976d2',
              color: '#fff',
              cursor: !selectedSourceId || !selectedTargetId || isSaving ? 'not-allowed' : 'pointer',
              opacity: !selectedSourceId || !selectedTargetId || isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
