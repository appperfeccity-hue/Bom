import type { MasterBomStatus, ActualBomStatus } from '@/types/database';

interface BomStatusBadgeProps {
  status: MasterBomStatus | ActualBomStatus | string;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'APPROVED':
      return '#4caf50';
    case 'GENERATED':
      return '#2196f3';
    case 'VALIDATED':
      return '#ff9800';
    case 'INVALIDATED':
    case 'SUPERSEDED':
      return '#f44336';
    default:
      return '#9e9e9e';
  }
}

export function BomStatusBadge({ status }: BomStatusBadgeProps) {
  const color = getStatusColor(status);

  return (
    <span
      data-testid={`bom-status-badge-${status.toLowerCase()}`}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '4px',
        backgroundColor: color,
        color: '#ffffff',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  );
}
