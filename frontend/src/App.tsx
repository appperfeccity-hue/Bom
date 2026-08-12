import { useEffect } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useAuthStore } from '@/stores/authStore';
import { useSkuStore } from '@/stores/skuStore';
import { useBomStore } from '@/stores/bomStore';
import { usePublishStore } from '@/stores/publishStore';
import { PublishStep } from '@/stores/publishStore';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';
import { CanvasMode } from '@/types/database';
import { CanvasContainer } from '@/canvas/CanvasContainer';
import { Toolbar } from '@/components/Toolbar';
import { ZonePropertiesPanel } from '@/components/ZonePropertiesPanel';
import { MeasurementPanel } from '@/components/MeasurementPanel';
import { SkuBrowser } from '@/components/SkuBrowser';
import { BomPanel } from '@/components/BomPanel';
import { PublishWorkflow } from '@/components/PublishWorkflow';
import { ProjectCreationWizard } from '@/components/ProjectCreation';

function App() {
  const mode = useCanvasStore((s) => s.mode);
  const setMode = useCanvasStore((s) => s.setMode);
  const selection = useCanvasStore((s) => s.selection);
  const subscribeToAuthChanges = useAuthStore((s) => s.subscribeToAuthChanges);
  const isBrowserOpen = useSkuStore((s) => s.isBrowserOpen);
  const isBomPanelOpen = useBomStore((s) => s.isBomPanelOpen);
  const openBomPanel = useBomStore((s) => s.openBomPanel);
  const publishStep = usePublishStore((s) => s.currentStep);
  const role = useAuthStore((s) => s.role);
  const creationStep = useProjectCreationStore((s) => s.step);

  // Subscribe to Supabase auth state changes on mount
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges();
    return unsubscribe;
  }, [subscribeToAuthChanges]);

  const isDesigner = mode === CanvasMode.DESIGNER;
  const showZonePanel = isDesigner && selection.selectedZoneId !== null;
  const showMeasurementPanel = mode === CanvasMode.CONSULTANT;

  return (
    <div
      id="app"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#ffffff',
          gap: '16px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Perfeccity Canvas</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setMode(CanvasMode.DESIGNER)}
            style={{
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: isDesigner ? 600 : 400,
              backgroundColor: isDesigner ? '#e3f2fd' : 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            data-testid="mode-designer-btn"
          >
            Designer
          </button>
          <button
            onClick={() => setMode(CanvasMode.CONSULTANT)}
            style={{
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: !isDesigner ? 600 : 400,
              backgroundColor: !isDesigner ? '#fff3e0' : 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            data-testid="mode-consultant-btn"
          >
            Consultant
          </button>
          <button
            onClick={openBomPanel}
            style={{
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#f3e5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            data-testid="bom-open-btn"
          >
            BOM
          </button>
          {role === 'CONSULTANT' && (
            <button
              onClick={() => useProjectCreationStore.setState({ step: CreationStep.BROWSE_TEMPLATES })}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: '#e8f5e9',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              data-testid="new-project-btn"
            >
              New Project
            </button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar />

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <CanvasContainer mode={mode} />
        </div>

        {/* Side panels */}
        {showZonePanel && <ZonePropertiesPanel />}
        {showMeasurementPanel && <MeasurementPanel />}
      </div>

      {/* SKU Browser overlay */}
      {isBrowserOpen && <SkuBrowser />}

      {/* BOM Panel overlay */}
      {isBomPanelOpen && <BomPanel />}

      {/* Publish Workflow overlay */}
      {publishStep !== PublishStep.IDLE && <PublishWorkflow />}

      {/* Project Creation Wizard overlay */}
      {creationStep !== CreationStep.IDLE && <ProjectCreationWizard />}
    </div>
  );
}

export default App;
