// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFinalizationStore, FinalizationStep } from '@/stores/finalizationStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useAuthStore } from '@/stores/authStore';
import { CanvasMode, ProjectStatus } from '@/types/database';
import type { Project } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    schema: vi.fn(() => ({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

// Mock crypto.subtle.digest for SHA-256 computation in finalizationStore
const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
vi.stubGlobal('crypto', {
  subtle: {
    digest: mockDigest,
  },
  randomUUID: () => 'test-uuid-1234',
});

// Import after mocks
import { FinalizeButton } from '../FinalizeButton';
import { FinalizationConfirmDialog } from '../FinalizationConfirmDialog';
import { FinalizationSuccessPanel } from '../FinalizationSuccessPanel';
import { Toolbar } from '@/components/Toolbar';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  project_id: 'proj-1',
  customer_reference: 'Test Project',
  template_id: 'tpl-1',
  status: ProjectStatus.VALIDATED,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('Finalization Components', () => {
  beforeEach(() => {
    useFinalizationStore.setState({
      finalizationStep: FinalizationStep.IDLE,
      finalBomId: null,
      finalBomHash: null,
      finalizedAt: null,
      isLoading: false,
      error: null,
    });
    useProjectStore.setState({
      currentProject: makeProject(),
      currentTemplate: null,
      zones: [],
      zoneSku: new Map(),
    });
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'CONSULTANT',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('FinalizeButton', () => {
    it('renders when project status is VALIDATED and mode is CONSULTANT', () => {
      render(<FinalizeButton />);
      expect(screen.getByTestId('finalize-project-btn')).toBeInTheDocument();
      expect(screen.getByText('Finalize Project')).toBeInTheDocument();
    });

    it('does not render when project status is not VALIDATED', () => {
      useProjectStore.setState({
        currentProject: makeProject({ status: ProjectStatus.APPROVED }),
      });
      render(<FinalizeButton />);
      expect(screen.queryByTestId('finalize-project-btn')).not.toBeInTheDocument();
    });

    it('does not render when mode is DESIGNER', () => {
      useCanvasStore.setState({ mode: CanvasMode.DESIGNER });
      render(<FinalizeButton />);
      expect(screen.queryByTestId('finalize-project-btn')).not.toBeInTheDocument();
    });

    it('does not render when project status is FINALIZED', () => {
      useProjectStore.setState({
        currentProject: makeProject({ status: ProjectStatus.FINALIZED }),
      });
      render(<FinalizeButton />);
      expect(screen.queryByTestId('finalize-project-btn')).not.toBeInTheDocument();
    });

    it('calls startFinalization when clicked', () => {
      render(<FinalizeButton />);
      fireEvent.click(screen.getByTestId('finalize-project-btn'));
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.CONFIRMING);
    });
  });

  describe('FinalizationConfirmDialog', () => {
    it('does not render when finalizationStep is IDLE', () => {
      render(<FinalizationConfirmDialog />);
      expect(screen.queryByTestId('finalization-confirm-dialog')).not.toBeInTheDocument();
    });

    it('renders when finalizationStep is CONFIRMING', () => {
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.CONFIRMING });
      render(<FinalizationConfirmDialog />);
      expect(screen.getByTestId('finalization-confirm-dialog')).toBeInTheDocument();
    });

    it('shows irreversibility warning text', () => {
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.CONFIRMING });
      render(<FinalizationConfirmDialog />);
      expect(screen.getByTestId('finalization-warning')).toHaveTextContent(
        'This action is irreversible. Once finalized, the project BOM cannot be modified.',
      );
    });

    it('shows Cancel and Confirm Finalization buttons', () => {
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.CONFIRMING });
      render(<FinalizationConfirmDialog />);
      expect(screen.getByTestId('finalization-cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('finalization-confirm-btn')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm Finalization')).toBeInTheDocument();
    });

    it('clicking Cancel triggers cancelFinalization', () => {
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.CONFIRMING });
      render(<FinalizationConfirmDialog />);
      fireEvent.click(screen.getByTestId('finalization-cancel-btn'));
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.IDLE);
    });

    it('clicking Confirm triggers confirmFinalization', () => {
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.CONFIRMING });
      render(<FinalizationConfirmDialog />);
      fireEvent.click(screen.getByTestId('finalization-confirm-btn'));
      // After clicking, it should transition to FINALIZING (async flow starts)
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.FINALIZING);
    });

    it('shows error message when in ERROR state', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.ERROR,
        error: 'Something went wrong',
      });
      render(<FinalizationConfirmDialog />);
      expect(screen.getByTestId('finalization-error')).toHaveTextContent('Something went wrong');
    });

    it('shows Finalizing... text when loading', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.FINALIZING,
        isLoading: true,
      });
      render(<FinalizationConfirmDialog />);
      expect(screen.getByText('Finalizing...')).toBeInTheDocument();
    });
  });

  describe('FinalizationSuccessPanel', () => {
    it('does not render when finalizationStep is not SUCCESS', () => {
      render(<FinalizationSuccessPanel />);
      expect(screen.queryByTestId('finalization-success-panel')).not.toBeInTheDocument();
    });

    it('renders when finalizationStep is SUCCESS', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-uuid-123',
        finalBomHash: 'abcdef123456',
        finalizedAt: '2024-01-15T10:30:00Z',
      });
      render(<FinalizationSuccessPanel />);
      expect(screen.getByTestId('finalization-success-panel')).toBeInTheDocument();
    });

    it('displays final BOM hash', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-uuid-123',
        finalBomHash: 'abcdef123456',
        finalizedAt: '2024-01-15T10:30:00Z',
      });
      render(<FinalizationSuccessPanel />);
      expect(screen.getByTestId('finalization-bom-hash')).toHaveTextContent('abcdef123456');
    });

    it('displays finalized timestamp', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-uuid-123',
        finalBomHash: 'abcdef123456',
        finalizedAt: '2024-01-15T10:30:00Z',
      });
      render(<FinalizationSuccessPanel />);
      expect(screen.getByTestId('finalization-timestamp')).toHaveTextContent('2024-01-15T10:30:00Z');
    });

    it('displays final BOM ID', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-uuid-123',
        finalBomHash: 'abcdef123456',
        finalizedAt: '2024-01-15T10:30:00Z',
      });
      render(<FinalizationSuccessPanel />);
      expect(screen.getByTestId('finalization-bom-id')).toHaveTextContent('bom-uuid-123');
    });

    it('shows success icon', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-uuid-123',
        finalBomHash: 'abcdef123456',
        finalizedAt: '2024-01-15T10:30:00Z',
      });
      render(<FinalizationSuccessPanel />);
      expect(screen.getByTestId('finalization-success-icon')).toBeInTheDocument();
    });

    it('clicking Close calls reset', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-uuid-123',
        finalBomHash: 'abcdef123456',
        finalizedAt: '2024-01-15T10:30:00Z',
      });
      render(<FinalizationSuccessPanel />);
      fireEvent.click(screen.getByTestId('finalization-close-btn'));
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.IDLE);
    });
  });

  describe('Toolbar lock controls', () => {
    beforeEach(() => {
      useCanvasStore.setState({
        mode: CanvasMode.DESIGNER,
        viewport: { zoom: 1, panX: 0, panY: 0 },
        gridConfig: { snapEnabled: true, size: 10 },
        saveStatus: 'saved' as const,
        selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      });
      useProjectStore.setState({
        currentProject: makeProject({ status: ProjectStatus.FINALIZED }),
        currentTemplate: null,
        zones: [],
        zoneSku: new Map(),
      });
    });

    it('shows finalized lock badge when project is FINALIZED', () => {
      render(<Toolbar />);
      expect(screen.getByTestId('finalized-lock-badge')).toBeInTheDocument();
      expect(screen.getByText('Finalized (Immutable)')).toBeInTheDocument();
    });

    it('disables create zone button when FINALIZED', () => {
      render(<Toolbar />);
      const createBtn = screen.getByTestId('create-zone-btn');
      expect(createBtn).toBeDisabled();
    });

    it('disables delete zone button when FINALIZED', () => {
      render(<Toolbar />);
      const deleteBtn = screen.getByTestId('delete-zone-btn');
      expect(deleteBtn).toBeDisabled();
    });

    it('does not show finalized lock badge when project is not FINALIZED', () => {
      useProjectStore.setState({
        currentProject: makeProject({ status: ProjectStatus.VALIDATED }),
      });
      render(<Toolbar />);
      expect(screen.queryByTestId('finalized-lock-badge')).not.toBeInTheDocument();
    });
  });
});
