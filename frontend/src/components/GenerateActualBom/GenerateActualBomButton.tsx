import { useBomStore } from '@/stores/bomStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';

/**
 * Button that triggers the full BOM pipeline.
 * Only visible when canvas mode is CONSULTANT.
 */
export function GenerateActualBomButton() {
  const mode = useCanvasStore((s) => s.mode);
  const pipelineStatus = useBomStore((s) => s.pipelineStatus);
  const runPipeline = useBomStore((s) => s.runPipeline);
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentSnapshot = useProjectStore((s) => s.currentSnapshot);

  const isConsultant = mode === CanvasMode.CONSULTANT;

  if (!isConsultant) {
    return null;
  }

  const isRunning = pipelineStatus === 'running';

  const handleClick = () => {
    if (currentProject && currentSnapshot) {
      void runPipeline(currentProject.project_id, currentSnapshot.snapshot_id);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isRunning || !currentSnapshot}
      title="Generate Actual BOM"
      data-testid="generate-actual-bom-btn"
      style={{
        padding: '4px 12px',
        fontSize: '13px',
        fontWeight: 600,
        backgroundColor: isRunning ? '#9e9e9e' : '#1565c0',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        cursor: isRunning || !currentSnapshot ? 'not-allowed' : 'pointer',
        opacity: isRunning || !currentSnapshot ? 0.7 : 1,
      }}
    >
      {isRunning ? 'Running...' : 'Generate Actual BOM'}
    </button>
  );
}
