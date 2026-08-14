import { useFinalizationStore } from '@/stores/finalizationStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode, ProjectStatus } from '@/types/database';

/**
 * Button that triggers the finalization flow.
 * Only visible when:
 * - Canvas mode is CONSULTANT
 * - Current project status is VALIDATED
 */
export function FinalizeButton() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const mode = useCanvasStore((s) => s.mode);
  const startFinalization = useFinalizationStore((s) => s.startFinalization);

  const isConsultant = mode === CanvasMode.CONSULTANT;
  const isValidated = currentProject?.status === ProjectStatus.VALIDATED;

  if (!isConsultant || !isValidated) {
    return null;
  }

  return (
    <button
      onClick={startFinalization}
      title="Finalize Project"
      data-testid="finalize-project-btn"
      style={{
        padding: '4px 12px',
        fontSize: '13px',
        fontWeight: 600,
        backgroundColor: 'var(--color-success)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Finalize Project
    </button>
  );
}
