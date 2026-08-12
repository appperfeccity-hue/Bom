import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useBomStore } from '@/stores/bomStore';
import { ErrorCode, ErrorSeverity, ErrorCategory } from '@/engines/errorCatalogue';
import type { PipelineError } from '@/engines/errorCatalogue';

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

import { ValidationResultsPanel } from '../ValidationResultsPanel';

const makeError = (overrides: Partial<PipelineError> = {}): PipelineError => ({
  code: ErrorCode.GEO_ZONE_OVERLAP,
  severity: ErrorSeverity.BLOCKING,
  category: ErrorCategory.GEOMETRY,
  message: 'Zones overlap each other',
  ...overrides,
});

const makeWarning = (overrides: Partial<PipelineError> = {}): PipelineError => ({
  code: ErrorCode.GEO_GAP_TOO_SMALL,
  severity: ErrorSeverity.WARNING,
  category: ErrorCategory.GEOMETRY,
  message: 'Gap between zones is smaller than recommended',
  ...overrides,
});

describe('ValidationResultsPanel', () => {
  beforeEach(() => {
    useBomStore.setState({
      pipelineStatus: 'idle',
      pipelineErrors: [],
      pipelineWarnings: [],
      pipelineProgress: null,
      pipelineOutputLines: [],
    });
  });

  it('should NOT render when pipelineStatus is idle', () => {
    render(<ValidationResultsPanel />);
    expect(screen.queryByTestId('validation-results-panel')).not.toBeInTheDocument();
  });

  it('should NOT render when pipelineStatus is running', () => {
    useBomStore.setState({ pipelineStatus: 'running' });
    render(<ValidationResultsPanel />);
    expect(screen.queryByTestId('validation-results-panel')).not.toBeInTheDocument();
  });

  it('should render SUCCESS badge when status is success', () => {
    useBomStore.setState({ pipelineStatus: 'success' });
    render(<ValidationResultsPanel />);
    expect(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-status-badge')).toHaveTextContent('SUCCESS');
  });

  it('should render BLOCKED badge when status is blocked', () => {
    useBomStore.setState({ pipelineStatus: 'blocked' });
    render(<ValidationResultsPanel />);
    expect(screen.getByTestId('pipeline-status-badge')).toHaveTextContent('BLOCKED');
  });

  it('should display blocking errors with error codes and messages', () => {
    const errors: PipelineError[] = [
      makeError({ code: ErrorCode.GEO_ZONE_OVERLAP, message: 'Zones overlap each other' }),
      makeError({ code: ErrorCode.GEO_ZONE_OUTSIDE_WALL, message: 'Zone is positioned outside the wall boundary' }),
    ];

    useBomStore.setState({
      pipelineStatus: 'blocked',
      pipelineErrors: errors,
    });

    render(<ValidationResultsPanel />);
    const errorItems = screen.getAllByTestId('pipeline-error-item');
    expect(errorItems).toHaveLength(2);
    expect(errorItems[0]).toHaveTextContent('[GEO_ZONE_OVERLAP] Zones overlap each other');
    expect(errorItems[1]).toHaveTextContent('[GEO_ZONE_OUTSIDE_WALL] Zone is positioned outside the wall boundary');
  });

  it('should display warnings with warning codes and messages', () => {
    const warnings: PipelineError[] = [
      makeWarning({ code: ErrorCode.GEO_GAP_TOO_SMALL, message: 'Gap between zones is smaller than recommended' }),
    ];

    useBomStore.setState({
      pipelineStatus: 'success',
      pipelineWarnings: warnings,
    });

    render(<ValidationResultsPanel />);
    const warningItems = screen.getAllByTestId('pipeline-warning-item');
    expect(warningItems).toHaveLength(1);
    expect(warningItems[0]).toHaveTextContent('[GEO_GAP_TOO_SMALL] Gap between zones is smaller than recommended');
  });

  it('should display both errors and warnings when both exist', () => {
    useBomStore.setState({
      pipelineStatus: 'blocked',
      pipelineErrors: [makeError()],
      pipelineWarnings: [makeWarning()],
    });

    render(<ValidationResultsPanel />);
    expect(screen.getAllByTestId('pipeline-error-item')).toHaveLength(1);
    expect(screen.getAllByTestId('pipeline-warning-item')).toHaveLength(1);
  });

  it('should not show errors section when there are no errors', () => {
    useBomStore.setState({
      pipelineStatus: 'success',
      pipelineErrors: [],
      pipelineWarnings: [makeWarning()],
    });

    render(<ValidationResultsPanel />);
    expect(screen.queryByTestId('pipeline-error-item')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pipeline-warning-item')).toHaveLength(1);
  });

  it('should not show warnings section when there are no warnings', () => {
    useBomStore.setState({
      pipelineStatus: 'blocked',
      pipelineErrors: [makeError()],
      pipelineWarnings: [],
    });

    render(<ValidationResultsPanel />);
    expect(screen.getAllByTestId('pipeline-error-item')).toHaveLength(1);
    expect(screen.queryByTestId('pipeline-warning-item')).not.toBeInTheDocument();
  });
});
