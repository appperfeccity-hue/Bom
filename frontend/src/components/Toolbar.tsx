import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePublishStore } from '@/stores/publishStore';
import { CanvasMode, TemplateStatus, ProjectStatus } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';
import { canAddZone } from '@/canvas/utils/zoneConstraints';
import { useHistory } from '@/canvas/history/useHistory';
import { FinalizeButton } from '@/components/Finalization/FinalizeButton';
import { GenerateActualBomButton } from '@/components/GenerateActualBom/GenerateActualBomButton';

/**
 * Top toolbar with mode indicator, zoom controls, grid snap toggle,
 * layer visibility dropdown, zone tools (DESIGNER), and save status.
 */
export function Toolbar() {
  const mode = useCanvasStore((s) => s.mode);
  const viewport = useCanvasStore((s) => s.viewport);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const resetViewport = useCanvasStore((s) => s.resetViewport);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const saveStatus = useCanvasStore((s) => s.saveStatus);
  const selection = useCanvasStore((s) => s.selection);
  const zones = useProjectStore((s) => s.zones);
  const removeZone = useProjectStore((s) => s.removeZone);
  const toggleLayer = useCanvasStore((s) => s.toggleLayer);
  const layerVisibility = useCanvasStore((s) => s.layerVisibility);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const currentProject = useProjectStore((s) => s.currentProject);
  const runValidation = usePublishStore((s) => s.runValidation);
  const history = useHistory();

  const zoomPercent = Math.round(viewport.zoom * 100);
  const isDesigner = mode === CanvasMode.DESIGNER;
  const isFinalized = currentProject?.status === ProjectStatus.FINALIZED;

  const handleZoomIn = () => setZoom(viewport.zoom * 1.25);
  const handleZoomOut = () => setZoom(viewport.zoom / 1.25);
  const handleFitToViewport = () => resetViewport();

  const handleDeleteZone = () => {
    if (selection.selectedZoneId) {
      void removeZone(selection.selectedZoneId);
    }
  };

  const handleUndo = () => {
    const undoState = history.undo();
    if (undoState) {
      useProjectStore.setState({ zones: undoState });
    }
  };

  const handleRedo = () => {
    const redoState = history.redo();
    if (redoState) {
      useProjectStore.setState({ zones: redoState });
    }
  };

  const handleToggleSnap = () => {
    // Grid snap is managed via the store - we use a workaround through direct toggle
    // The canvasStore doesn't expose setGridConfig directly, so we toggle via layer
    // For now this toggles the grid overlay layer visibility as a proxy
    useCanvasStore.setState((state) => ({
      gridConfig: { ...state.gridConfig, snapEnabled: !state.gridConfig.snapEnabled },
    }));
  };

  const saveStatusDisplay: Record<string, { text: string; color: string }> = {
    saving: { text: 'Saving...', color: '#ff9800' },
    saved: { text: 'Saved', color: '#4caf50' },
    unsaved: { text: 'Unsaved changes', color: '#f44336' },
    error: { text: 'Error saving', color: '#f44336' },
  };

  const status = saveStatusDisplay[saveStatus] ?? saveStatusDisplay.saved;

  return (
    <div
      className="toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        flexWrap: 'wrap',
      }}
      data-testid="toolbar"
    >
      {/* Mode badge */}
      <span
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: isDesigner ? '#e3f2fd' : '#fff3e0',
          color: isDesigner ? '#1565c0' : '#e65100',
        }}
        data-testid="mode-badge"
      >
        {mode}
      </span>

      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={handleZoomOut} title="Zoom Out" data-testid="zoom-out">
          -
        </button>
        <span style={{ minWidth: '48px', textAlign: 'center', fontSize: '13px' }} data-testid="zoom-display">
          {zoomPercent}%
        </span>
        <button onClick={handleZoomIn} title="Zoom In" data-testid="zoom-in">
          +
        </button>
        <button onClick={handleFitToViewport} title="Fit to Viewport" data-testid="fit-viewport">
          Fit
        </button>
      </div>

      {/* Grid snap toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
        <input
          type="checkbox"
          checked={gridConfig.snapEnabled}
          onChange={handleToggleSnap}
          data-testid="snap-toggle"
        />
        Snap to Grid
      </label>

      {/* Layer visibility dropdown */}
      <div style={{ position: 'relative' }}>
        <select
          onChange={(e) => {
            const layer = e.target.value as CanvasLayer;
            if (layer) toggleLayer(layer);
            e.target.value = '';
          }}
          value=""
          style={{ fontSize: '13px' }}
          data-testid="layer-toggle"
        >
          <option value="">Toggle Layer...</option>
          {Object.values(CanvasLayer).map((layer) => (
            <option key={layer} value={layer}>
              {layerVisibility[layer] ? '\u2713' : '\u2717'} {layer}
            </option>
          ))}
        </select>
      </div>

      {/* Designer-only zone tools */}
      {isDesigner && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleUndo}
            disabled={!history.canUndo || isFinalized}
            title="Undo (Ctrl+Z)"
            data-testid="undo-btn"
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!history.canRedo || isFinalized}
            title="Redo (Ctrl+Shift+Z)"
            data-testid="redo-btn"
          >
            Redo
          </button>
          <button
            disabled={!canAddZone(zones.length) || isFinalized}
            title={isFinalized ? 'Project is finalized' : canAddZone(zones.length) ? 'Click and drag on canvas to create zone' : 'Maximum 12 zones reached'}
            data-testid="create-zone-btn"
          >
            + Zone
          </button>
          <button
            onClick={handleDeleteZone}
            disabled={!selection.selectedZoneId || isFinalized}
            title={isFinalized ? 'Project is finalized' : 'Delete selected zone'}
            data-testid="delete-zone-btn"
          >
            Delete Zone
          </button>
          {currentTemplate?.status === TemplateStatus.DRAFT && (
            <button
              onClick={() => void runValidation(currentTemplate.id)}
              title="Publish Template"
              data-testid="publish-template-btn"
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: '#7b1fa2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Publish Template
            </button>
          )}
        </div>
      )}

      {/* Finalized lock badge */}
      {isFinalized && (
        <span
          data-testid="finalized-lock-badge"
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#e8f5e9',
            color: '#2e7d32',
            border: '1px solid #a5d6a7',
          }}
        >
          Finalized (Immutable)
        </span>
      )}

      {/* Finalize button - CONSULTANT mode, VALIDATED status */}
      <FinalizeButton />

      {/* Generate Actual BOM button - CONSULTANT mode */}
      <GenerateActualBomButton />

      {/* Save status */}
      <span
        style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: status.color,
          fontWeight: 500,
        }}
        data-testid="save-status"
      >
        {status.text}
      </span>
    </div>
  );
}
