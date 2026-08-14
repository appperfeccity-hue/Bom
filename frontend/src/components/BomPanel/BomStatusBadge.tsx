import type { MasterBomStatus, ActualBomStatus } from '@/types/database';

interface BomStatusBadgeProps {
  status: MasterBomStatus | ActualBomStatus | string;
}

function getStatusStyle(status: string): { backgroundColor: string; color: string; border?: string } {
  switch (status) {
    case 'APPROVED':
      return { backgroundColor: 'rgba(63,107,79,0.1)', color: 'var(--color-success)' };
    case 'GENERATED':
      return { backgroundColor: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
    case 'VALIDATED':
      return { backgroundColor: 'rgba(154,123,79,0.1)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' };
    case 'INVALIDATED':
      return { backgroundColor: 'rgba(176,65,62,0.1)', color: 'var(--color-error)' };
    case 'SUPERSEDED':
      return { backgroundColor: 'rgba(166,106,45,0.1)', color: 'var(--color-warning)' };
    default:
      return { backgroundColor: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
  }
}

export function BomStatusBadge({ status }: BomStatusBadgeProps) {
  const style = getStatusStyle(status);

  return (
    <span
      data-testid={`bom-status-badge-${status.toLowerCase()}`}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '4px',
        backgroundColor: style.backgroundColor,
        color: style.color,
        border: style.border ?? 'none',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  );
}
