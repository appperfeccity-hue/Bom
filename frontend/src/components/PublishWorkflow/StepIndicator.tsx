import { PublishStep } from '@/stores/publishStore';

interface StepIndicatorProps {
  currentStep: PublishStep;
}

const STEPS = [
  { label: 'Validate', completedAfter: [PublishStep.VALIDATION_RESULTS, PublishStep.GENERATING_BOM, PublishStep.BOM_GENERATED, PublishStep.APPROVING_BOM, PublishStep.BOM_APPROVED, PublishStep.PUBLISHING, PublishStep.PUBLISHED] },
  { label: 'Generate BOM', completedAfter: [PublishStep.BOM_GENERATED, PublishStep.APPROVING_BOM, PublishStep.BOM_APPROVED, PublishStep.PUBLISHING, PublishStep.PUBLISHED] },
  { label: 'Approve BOM', completedAfter: [PublishStep.BOM_APPROVED, PublishStep.PUBLISHING, PublishStep.PUBLISHED] },
  { label: 'Publish', completedAfter: [PublishStep.PUBLISHED] },
];

const ACTIVE_STEPS: Record<string, number> = {
  [PublishStep.VALIDATING]: 0,
  [PublishStep.VALIDATION_RESULTS]: 0,
  [PublishStep.GENERATING_BOM]: 1,
  [PublishStep.BOM_GENERATED]: 1,
  [PublishStep.APPROVING_BOM]: 2,
  [PublishStep.BOM_APPROVED]: 2,
  [PublishStep.PUBLISHING]: 3,
  [PublishStep.PUBLISHED]: 3,
};

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const activeIndex = ACTIVE_STEPS[currentStep] ?? 0;

  return (
    <div
      data-testid="publish-step-indicator"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        gap: '4px',
      }}
    >
      {STEPS.map((step, index) => {
        const isCompleted = step.completedAfter.includes(currentStep);
        const isActive = index === activeIndex && !isCompleted;

        return (
          <div
            key={step.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flex: 1,
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: isCompleted
                  ? '#4caf50'
                  : isActive
                    ? '#1976d2'
                    : '#e0e0e0',
                color: isCompleted || isActive ? '#ffffff' : '#666666',
                flexShrink: 0,
              }}
            >
              {isCompleted ? '\u2713' : index + 1}
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                color: isCompleted
                  ? '#4caf50'
                  : isActive
                    ? '#1976d2'
                    : '#999999',
                whiteSpace: 'nowrap',
              }}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: isCompleted ? '#4caf50' : '#e0e0e0',
                  marginLeft: '4px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
