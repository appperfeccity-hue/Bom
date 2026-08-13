import { TemplateStatus } from '@/types/database';

interface TemplateStatusBadgeProps {
  status: TemplateStatus;
}

const statusStyles: Record<TemplateStatus, { backgroundColor: string; color: string }> = {
  [TemplateStatus.DRAFT]: { backgroundColor: '#9e9e9e', color: '#ffffff' },
  [TemplateStatus.ACTIVE]: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  [TemplateStatus.RETIRED]: { backgroundColor: '#fff3e0', color: '#e65100' },
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
