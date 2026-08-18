import { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePublishStore } from '@/stores/publishStore';
import { CanvasMode, TemplateStatus, ProjectStatus } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';
import { canAddZone } from '@/canvas/utils/zoneConstraints';
import { useHistory } from '@/canvas/history/useHistory';
import { FinalizeButton } from '@/components/Finalization/FinalizeButton';
import { GenerateActualBomButton } from '@/components/GenerateActualBom/GenerateActualBomButton';

/** Breakpoint below which toolbar enters compact mode (icon-only, touch-friendly). */
const COMPACT_BREAKPOINT = 640;

/**
 * Top toolbar with mode indicator, zoom controls, grid snap toggle,
 * layer visibility dropdown, zone tools (DESIGNER), and save status.
 */
export function Toolbar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
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
  const projectError = useProjectStore((s) => s.error);
  const runValidation = usePublishStore((s) => s.runValidation);
  const history = useHistory();

  const zoomPercent = Math.round(viewport.zoom * 100);
  const isDesigner = mode === CanvasMode.DESIGNER;
  const isFinalized = currentProject?.status === ProjectStatus.FINALIZED;

  // Responsive breakpoint detection
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < COMPACT_BREAKPOINT);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const buttonStyle = isCompact
    ? { padding: '12px', fontSize: '16px', minWidth: '44px', minHeight: '44px' }
    : {};

  const handleZoomIn = () => setZoom(viewport.zoom * 1.25);
  const handleZoomOut = () => setZoom(viewport.zoom / 1.25);
  const handleFitToViewport = () => resetViewport();

  const handleDeleteZone = () => {
    const selectedIds = selection.selectedZoneIds;
    if (selectedIds.length > 0) {
      // Push history before deletion so the action is undoable
      history.pushState(zones);
      for (const id of selectedIds) {
        void removeZone(id);
      }
      // Clear selection to avoid stale references to deleted zones
      useCanvasStore.getState().clearSelection();
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
    saving: { text: 'Saving...', color: '#A66A2D' }, /* --color-warning */
    saved: { text: 'Saved', color: '#3F6B4F' }, /* --color-success */
    unsaved: { text: 'Unsaved changes', color: '#B0413E' }, /* --color-error */
    error: { text: 'Error saving', color: '#B0413E' }, /* --color-error */
  };

  const status = saveStatusDisplay[saveStatus] ?? saveStatusDisplay.saved;

  return (
    <div
      ref={containerRef}
      className="toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isCompact ? '8px' : '12px',
        padding: '0 16px',
        height: '40px',
        borderBottom: '1px solid #E3E1DD', /* --color-hairline */
        backgroundColor: '#FFFFFF', /* --color-surface */
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
          backgroundColor: 'rgba(154, 123, 79, 0.12)', /* --color-accent 12% */
          color: '#9A7B4F', /* --color-accent */
        }}
        data-testid="mode-badge"
      >
        {mode}
      </span>

      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={handleZoomOut} title="Zoom Out" data-testid="zoom-out" style={buttonStyle}>
          -
        </button>
        <span style={{ minWidth: '48px', textAlign: 'center', fontSize: '13px' }} data-testid="zoom-display">
          {zoomPercent}%
        </span>
        <button onClick={handleZoomIn} title="Zoom In" data-testid="zoom-in" style={buttonStyle}>
          +
        </button>
        <button onClick={handleFitToViewport} title="Fit to Viewport" data-testid="fit-viewport" style={buttonStyle}>
          {isCompact ? '\u2922' : 'Fit'}
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
        {!isCompact && 'Snap to Grid'}
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
            style={buttonStyle}
          >
            {isCompact ? '\u21A9' : 'Undo'}
          </button>
          <button
            onClick={handleRedo}
            disabled={!history.canRedo || isFinalized}
            title="Redo (Ctrl+Shift+Z)"
            data-testid="redo-btn"
            style={buttonStyle}
          >
            {isCompact ? '\u21AA' : 'Redo'}
          </button>
          <button
            disabled={!canAddZone(zones.length) || isFinalized}
            title={isFinalized ? 'Project is finalized' : canAddZone(zones.length) ? 'Click and drag on canvas to create zone' : 'Maximum 12 zones reached'}
            data-testid="create-zone-btn"
            style={buttonStyle}
          >
            + {!isCompact && 'Zone'}
          </button>
          <button
            onClick={handleDeleteZone}
            disabled={selection.selectedZoneIds.length === 0 || isFinalized}
            title={isFinalized ? 'Project is finalized' : 'Delete selected zone'}
            data-testid="delete-zone-btn"
            style={buttonStyle}
          >
            {isCompact ? '\u2716' : 'Delete Zone'}
          </button>
          {currentTemplate?.status === TemplateStatus.DRAFT && (
            <button
              onClick={() => void runValidation(currentTemplate.template_id)}
              title="Publish Template"
              data-testid="publish-template-btn"
              style={{
                padding: isCompact ? '12px' : '4px 12px',
                fontSize: isCompact ? '16px' : '13px',
                fontWeight: 600,
                backgroundColor: '#9A7B4F', /* --color-accent */
                color: '#FFFFFF', /* --color-surface */
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {isCompact ? '\u2191' : 'Publish Template'}
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
            backgroundColor: 'rgba(63, 107, 79, 0.06)', /* --color-success 6% */
            color: '#3F6B4F', /* --color-success */
            border: '1px solid #3F6B4F', /* --color-success */
          }}
        >
          Finalized (Immutable)
        </span>
      )}

      {/* Finalize button - CONSULTANT mode, VALIDATED status */}
      <FinalizeButton />

      {/* Generate Actual BOM button - CONSULTANT mode */}
      <GenerateActualBomButton />

      {/* Rejected edit / load failure */}
      {projectError && (
        <span
          role="alert"
          data-testid="project-error"
          title={projectError}
          style={{
            marginLeft: 'auto',
            maxWidth: '480px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            backgroundColor: 'rgba(176, 65, 62, 0.06)', /* --color-error 6% */
            color: '#B0413E', /* --color-error */
            border: '1px solid #B0413E', /* --color-error */
          }}
        >
          {projectError}
        </span>
      )}

      {/* Save status */}
      <span
        style={{
          marginLeft: projectError ? '12px' : 'auto',
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
