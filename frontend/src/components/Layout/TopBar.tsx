import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

const SAVE_STATUS_LABELS: Record<string, string> = {
  saved: 'Saved',
  saving: 'Saving...',
  unsaved: 'Unsaved changes',
  error: 'Save error',
};

export function TopBar() {
  const mode = useCanvasStore((s) => s.mode);
  const saveStatus = useCanvasStore((s) => s.saveStatus);

  const modeLabel = mode === CanvasMode.DESIGNER ? 'Designer' : 'Consultant';
  const statusLabel = SAVE_STATUS_LABELS[saveStatus] ?? saveStatus;

  return (
    <div className="top-bar" data-testid="top-bar" role="banner">
      <span className="top-bar__brand">
        Perfeccity
      </span>

      <span className="top-bar__mode-badge" data-testid="mode-indicator">
        {modeLabel}
      </span>

      <span
        className={`top-bar__save-status top-bar__save-status--${saveStatus}`}
        data-testid="save-status"
      >
        {statusLabel}
      </span>
    </div>
  );
}
