import { TemplateStatus } from '@/types/database';

interface TemplateStatusBadgeProps {
  status: TemplateStatus;
}

const statusStyles: Record<TemplateStatus, { backgroundColor: string; color: string }> = {
  [TemplateStatus.DRAFT]: { backgroundColor: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' },
  [TemplateStatus.ACTIVE]: { backgroundColor: 'rgba(63,107,79,0.1)', color: 'var(--color-success)' },
  [TemplateStatus.RETIRED]: { backgroundColor: 'rgba(166,106,45,0.1)', color: 'var(--color-warning)' },
};

export function TemplateStatusBadge({ status }: TemplateStatusBadgeProps) {
  const style = statusStyles[status];

  return (
    <span
      data-testid="template-status-badge"
      style={{
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: style.backgroundColor,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}
