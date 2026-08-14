import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePublishStore } from '@/stores/publishStore';
import { PublishStep } from '@/stores/publishStore';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    upsert: () => Promise.resolve({ error: null }),
    in: () => Promise.resolve({ data: [], error: null }),
  }),
}));

import { ValidationGateIndicator } from '@/components/PublishWorkflow/ValidationGateIndicator';

describe('ValidationGateIndicator', () => {
  beforeEach(() => {
    usePublishStore.setState({
      currentStep: PublishStep.IDLE,
      validationResults: [],
      isLoading: false,
      error: null,
    });
  });

  it('renders nothing when there are no validation results', () => {
    const { container } = render(<ValidationGateIndicator />);
    expect(container.innerHTML).toBe('');
  });

  it('shows green badge when all validation gates pass', () => {
    usePublishStore.setState({
      validationResults: [
        { gate: 'Zone SKU Assignment', passed: true, message: 'All zones have a primary SKU' },
        { gate: 'Zone Overlaps', passed: true, message: 'No overlaps detected' },
      ],
    });

    render(<ValidationGateIndicator />);
    const badge = screen.getByTestId('publish-gate-indicator');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ backgroundColor: 'var(--color-success)' });
    expect(badge).toHaveTextContent('\u2713');
  });

  it('shows red badge with count when validation gates fail', () => {
    usePublishStore.setState({
      validationResults: [
        { gate: 'Zone SKU Assignment', passed: false, message: '2 zones missing SKU' },
        { gate: 'Zone Overlaps', passed: true, message: 'No overlaps detected' },
        { gate: 'Zone Constraints', passed: false, message: 'Zone exceeds boundary' },
      ],
    });

    render(<ValidationGateIndicator />);
    const badge = screen.getByTestId('publish-gate-indicator');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ backgroundColor: 'var(--color-error)' });
    expect(badge).toHaveTextContent('2');
  });

  it('shows red badge with count of 1 when a single gate fails', () => {
    usePublishStore.setState({
      validationResults: [
        { gate: 'Zone SKU Assignment', passed: true, message: 'All zones have a SKU' },
        { gate: 'Zone Overlaps', passed: false, message: 'Overlapping zones detected' },
      ],
    });

    render(<ValidationGateIndicator />);
    const badge = screen.getByTestId('publish-gate-indicator');
    expect(badge).toHaveStyle({ backgroundColor: 'var(--color-error)' });
    expect(badge).toHaveTextContent('1');
  });
});
