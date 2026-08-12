import { useCanvasStore } from '@/stores/canvasStore';
import { useAuthStore } from '@/stores/authStore';
import { useBomStore } from '@/stores/bomStore';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';
import { CanvasMode } from '@/types/database';

export function Navigation() {
  const mode = useCanvasStore((s) => s.mode);
  const setMode = useCanvasStore((s) => s.setMode);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);
  const openBomPanel = useBomStore((s) => s.openBomPanel);
  const openPanel = useTemplateManagementStore((s) => s.openPanel);

  const isDesigner = mode === CanvasMode.DESIGNER;

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header
      data-testid="navigation"
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
      <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
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
        {role === 'DESIGNER' && (
          <button
            onClick={openPanel}
            style={{
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#ede7f6',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            data-testid="my-templates-btn"
          >
            My Templates
          </button>
        )}
      </div>
      <button
        onClick={handleLogout}
        style={{
          padding: '4px 12px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: '#ffebee',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
        data-testid="logout-btn"
      >
        Logout
      </button>
    </header>
  );
}
