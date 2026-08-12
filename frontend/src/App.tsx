import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import { CanvasContainer } from '@/canvas/CanvasContainer';
import { Toolbar } from '@/components/Toolbar';
import { ZonePropertiesPanel } from '@/components/ZonePropertiesPanel';
import { MeasurementPanel } from '@/components/MeasurementPanel';

function App() {
  const mode = useCanvasStore((s) => s.mode);
  const setMode = useCanvasStore((s) => s.setMode);
  const selection = useCanvasStore((s) => s.selection);

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
    </div>
  );
}

export default App;
