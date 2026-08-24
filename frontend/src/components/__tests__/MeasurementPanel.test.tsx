import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MeasurementPanel } from '@/components/MeasurementPanel';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { ProjectSnapshot } from '@/types/database';

vi.mock('@/lib/supabase', () => ({
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  }),
}));

const snapshot: ProjectSnapshot = {
  snapshot_id: 'snap-1',
  project_id: 'proj-1',
  template_id: 'tmpl-1',
  snapshot_data: {
    wall_geometry: {
      type: 'L_SHAPE',
      base_width_mm: 3000,
      base_height_mm: 2400,
      segment_a_width_mm: 1200,
      segment_b_width_mm: 900,
    },
    consultant_permissions: [
      {
        permission_id: 'perm-1',
        template_id: 'tmpl-1',
        parameter_key: 'WALL_WIDTH',
        parameter_type: 'DIMENSION',
        edit_mode: 'RESTRICTED',
        min_value: 2400,
        max_value: 3600,
        allowed_values: null,
      },
      {
        permission_id: 'perm-2',
        template_id: 'tmpl-1',
        parameter_key: 'WALL_HEIGHT',
        parameter_type: 'DIMENSION',
        edit_mode: 'FREE',
        min_value: null,
        max_value: null,
        allowed_values: null,
      },
    ],
  },
  snapshot_hash: 'hash-1',
  rule_set_id: 'ruleset-1',
  created_at: '2024-01-01',
};

describe('MeasurementPanel', () => {
  let updateMeasurements: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateMeasurements = vi.fn().mockResolvedValue(undefined);
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({
      currentSnapshot: snapshot,
      wallGeometry: 'L_SHAPE',
      measurements: {
        measurement_id: 'm-1',
        project_id: 'proj-1',
        wall_width_mm: 3000,
        wall_height_mm: 2400,
      } as never,
      updateMeasurements,
    });
  });

  it('shows the frozen adaptation range and design default', () => {
    render(<MeasurementPanel />);

    expect(screen.getByText('2400 - 3600 mm')).toBeInTheDocument();
    expect(screen.getByTestId('default-wall_width_mm')).toHaveTextContent('3000 mm');
  });

  it('keeps intermediate keystrokes and persists the final in-range value', () => {
    render(<MeasurementPanel />);
    const input = screen.getByTestId('input-wall-width') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '3' } });
    expect(input.value).toBe('3');
    fireEvent.change(input, { target: { value: '32' } });
    fireEvent.change(input, { target: { value: '320' } });
    expect(input.value).toBe('320');
    expect(updateMeasurements).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '3200' } });
    expect(updateMeasurements).toHaveBeenCalledWith({ wall_width_mm: 3200 });
  });

  it('reports an out-of-range value on blur instead of silently dropping it', () => {
    render(<MeasurementPanel />);
    const input = screen.getByTestId('input-wall-width');

    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input, { target: { value: '5000' } });

    expect(updateMeasurements).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-wall_width_mm')).toHaveTextContent('3600');
  });

  it('locks adaptable fields that have no frozen permission', () => {
    render(<MeasurementPanel />);

    expect(screen.getByTestId('field-locked-segment_a_width_mm')).toBeInTheDocument();
    expect(screen.getByTestId('input-segment-a')).toBeDisabled();
    expect(screen.getByTestId('input-segment-b')).toBeDisabled();
  });
});
