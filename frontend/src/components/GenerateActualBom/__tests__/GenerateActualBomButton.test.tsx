import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useBomStore } from '@/stores/bomStore';
import { CanvasMode, ProjectStatus } from '@/types/database';
import type { Project } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  supabase: {},
  isSupabaseConfigured: false,
}));

import { GenerateActualBomButton } from '../GenerateActualBomButton';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Test Project',
  template_id: 'tpl-1',
  status: ProjectStatus.VALIDATED,
  client_name: 'Client',
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
  ...overrides,
});

describe('GenerateActualBomButton', () => {
  beforeEach(() => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentProject: makeProject() });
    useBomStore.setState({
      pipelineStatus: 'idle',
      pipelineErrors: [],
      pipelineWarnings: [],
      pipelineProgress: null,
      pipelineOutputLines: [],
    });
  });

  it('should render in CONSULTANT mode', () => {
    render(<GenerateActualBomButton />);
    expect(screen.getByTestId('generate-actual-bom-btn')).toBeInTheDocument();
    expect(screen.getByText('Generate Actual BOM')).toBeInTheDocument();
  });

  it('should NOT render in DESIGNER mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });
    render(<GenerateActualBomButton />);
    expect(screen.queryByTestId('generate-actual-bom-btn')).not.toBeInTheDocument();
  });

  it('should call runPipeline on click', () => {
    const mockRunPipeline = vi.fn().mockResolvedValue(undefined);
    useBomStore.setState({ runPipeline: mockRunPipeline } as unknown as Parameters<typeof useBomStore.setState>[0]);

    render(<GenerateActualBomButton />);
    fireEvent.click(screen.getByTestId('generate-actual-bom-btn'));

    expect(mockRunPipeline).toHaveBeenCalledWith('proj-1', 'proj-1');
  });

  it('should be disabled while pipeline is running', () => {
    useBomStore.setState({ pipelineStatus: 'running' });

    render(<GenerateActualBomButton />);
    const btn = screen.getByTestId('generate-actual-bom-btn');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });

  it('should be enabled when pipeline is idle', () => {
    render(<GenerateActualBomButton />);
    const btn = screen.getByTestId('generate-actual-bom-btn');
    expect(btn).not.toBeDisabled();
  });

  it('should be enabled when pipeline is success', () => {
    useBomStore.setState({ pipelineStatus: 'success' });

    render(<GenerateActualBomButton />);
    const btn = screen.getByTestId('generate-actual-bom-btn');
    expect(btn).not.toBeDisabled();
  });
});
