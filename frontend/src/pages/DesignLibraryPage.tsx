import { DesignLibrary } from '@/components/ProjectCreation/DesignLibrary';

/**
 * DesignLibraryPage - standalone page wrapping the Design Library component.
 * Accessible to all authenticated users (Consultant, Designer, Admin).
 */
export function DesignLibraryPage() {
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
    </div>
  );
}
