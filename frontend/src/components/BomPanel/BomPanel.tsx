import { useEffect } from 'react';
import { useBomStore } from '@/stores/bomStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { MasterBomTable } from './MasterBomTable';
import { ActualBomTable } from './ActualBomTable';
import { FinalBomTable } from './FinalBomTable';
import { BomReconciliationView } from './BomReconciliationView';

/**
 * BOM Panel - a fixed overlay panel for viewing Bill of Materials.
 * In DESIGNER mode, shows Master BOM and reconciliation.
 * In CONSULTANT mode, shows Actual BOM and Final BOM.
 */
export function BomPanel() {
  const isBomPanelOpen = useBomStore((s) => s.isBomPanelOpen);
  const closeBomPanel = useBomStore((s) => s.closeBomPanel);
  const isLoading = useBomStore((s) => s.isLoading);
  const error = useBomStore((s) => s.error);
  const fetchMasterBom = useBomStore((s) => s.fetchMasterBom);
  const fetchActualBom = useBomStore((s) => s.fetchActualBom);
  const fetchFinalBom = useBomStore((s) => s.fetchFinalBom);
  const mode = useCanvasStore((s) => s.mode);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const currentProject = useProjectStore((s) => s.currentProject);

  const isDesigner = mode === CanvasMode.DESIGNER;

  // Trigger data fetching when the panel opens based on mode and loaded template/project
  useEffect(() => {
    if (!isBomPanelOpen) return;

    if (isDesigner && currentTemplate) {
      fetchMasterBom(currentTemplate.template_id);
    } else if (!isDesigner && currentProject) {
      fetchActualBom(currentProject.project_id);
      fetchFinalBom(currentProject.project_id);
    }
  }, [isBomPanelOpen, isDesigner, currentTemplate, currentProject, fetchMasterBom, fetchActualBom, fetchFinalBom]);

  if (!isBomPanelOpen) return null;

  return (
    <div
      data-testid="bom-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '600px',
        height: '100vh',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e0e0e0',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
          Bill of Materials
        </h3>
        <button
          onClick={closeBomPanel}
          style={{
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666',
            lineHeight: 1,
            padding: '4px',
          }}
          data-testid="bom-panel-close-btn"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {isLoading && (
          <div data-testid="bom-panel-loading" style={{ padding: '16px', color: '#666' }}>
            Loading BOM data...
          </div>
        )}

        {error && (
          <div data-testid="bom-panel-error" style={{ padding: '16px', color: '#f44336' }}>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {isDesigner ? (
              <>
                <MasterBomTable />
                <BomReconciliationView />
              </>
            ) : (
              <>
                <ActualBomTable />
                <FinalBomTable />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
