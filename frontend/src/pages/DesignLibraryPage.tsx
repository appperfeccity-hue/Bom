import { DesignLibrary } from '@/components/ProjectCreation/DesignLibrary';
import { ProjectCreationWizard } from '@/components/ProjectCreation';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';

/**
 * DesignLibraryPage - standalone page wrapping the Design Library component.
 * Accessible to all authenticated users (Consultant, Designer, Admin).
 * Includes the ProjectCreationWizard overlay so template selection
 * triggers the project creation flow without navigating away.
 */
export function DesignLibraryPage() {
  const creationStep = useProjectCreationStore((s) => s.step);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'var(--color-canvas)',
      }}
      data-testid="design-library-page"
    >
      <DesignLibrary />

      {/* Project Creation Wizard appears as overlay when template is selected */}
      {creationStep !== CreationStep.IDLE && <ProjectCreationWizard />}
    </div>
  );
}
