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
    <div className="top-bar" data-testid="top-bar">
      <span
        style={{
          fontWeight: 'var(--weight-semibold)' as unknown as number,
          fontSize: 'var(--text-md)',
          color: 'var(--color-ink-primary)',
        }}
      >
        Perfeccity
      </span>

      <span
        style={{
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-nav-active-bg)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-medium)' as unknown as number,
          color: 'var(--color-accent)',
        }}
        data-testid="mode-indicator"
      >
        {modeLabel}
      </span>

      <span
        style={{
          marginLeft: 'auto',
          fontSize: 'var(--text-xs)',
          color: saveStatus === 'error' ? 'var(--color-error)' : 'var(--color-ink-secondary)',
        }}
        data-testid="save-status"
      >
        {statusLabel}
      </span>
    </div>
  );
}
