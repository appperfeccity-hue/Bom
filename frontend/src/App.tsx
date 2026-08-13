import { useCanvasStore } from '@/stores/canvasStore';
import { useSkuStore } from '@/stores/skuStore';
import { useBomStore } from '@/stores/bomStore';
import { usePublishStore } from '@/stores/publishStore';
import { PublishStep } from '@/stores/publishStore';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';
import { CanvasMode } from '@/types/database';
import { CanvasContainer } from '@/canvas/CanvasContainer';
import { Toolbar } from '@/components/Toolbar';
import { ZonePropertiesPanel } from '@/components/ZonePropertiesPanel';
import { WallConfigPanel } from '@/components/WallConfigPanel';
import { MeasurementPanel } from '@/components/MeasurementPanel';
import { SkuBrowser } from '@/components/SkuBrowser';
import { BomPanel } from '@/components/BomPanel';
import { PublishWorkflow } from '@/components/PublishWorkflow';
import { ProjectCreationWizard } from '@/components/ProjectCreation';
import { TemplateManagementPanel } from '@/components/TemplateManagement';
import { Navigation } from '@/components/Navigation';

function App() {
  const mode = useCanvasStore((s) => s.mode);
  const selection = useCanvasStore((s) => s.selection);
  const isBrowserOpen = useSkuStore((s) => s.isBrowserOpen);
  const isBomPanelOpen = useBomStore((s) => s.isBomPanelOpen);
  const publishStep = usePublishStore((s) => s.currentStep);
  const creationStep = useProjectCreationStore((s) => s.step);
  const isPanelVisible = useTemplateManagementStore((s) => s.isPanelVisible);

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
      {/* Navigation Header */}
      <Navigation />

      {/* Toolbar */}
      <Toolbar />

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <CanvasContainer mode={mode} />
        </div>

        {/* Side panels */}
        {isDesigner && <WallConfigPanel />}
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

      {/* Template Management Panel overlay */}
      {isPanelVisible && <TemplateManagementPanel />}
    </div>
  );
}

export default App;
