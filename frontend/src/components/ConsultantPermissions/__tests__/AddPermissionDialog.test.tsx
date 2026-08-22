import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn(() => ({ insert: mockInsert })),
  isSupabaseConfigured: false,
}));

import { AddPermissionDialog } from '../AddPermissionDialog';
import { PERMISSION_PARAMETER_KEYS } from '@/lib/measurementModel';

describe('AddPermissionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the authoritative UPPERCASE parameter_key vocabulary', () => {
    render(<AddPermissionDialog templateId="tpl-1" onClose={vi.fn()} onAdded={vi.fn()} />);

    for (const key of PERMISSION_PARAMETER_KEYS) {
      expect(screen.getByRole('option', { name: key })).toBeInTheDocument();
    }
    expect(screen.queryByRole('option', { name: 'zone_width' })).not.toBeInTheDocument();
  });

  it('writes the baseline column shape for a LOCKED permission', async () => {
    const onAdded = vi.fn();
    render(<AddPermissionDialog templateId="tpl-1" onClose={vi.fn()} onAdded={onAdded} />);

    fireEvent.change(screen.getByTestId('parameter-name-select'), {
      target: { value: 'WALL_WIDTH' },
    });
    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
    expect(mockInsert).toHaveBeenCalledWith({
      template_id: 'tpl-1',
      parameter_key: 'WALL_WIDTH',
      parameter_type: 'DIMENSION',
      edit_mode: 'LOCKED',
      min_value: null,
      max_value: null,
      allowed_values: null,
    });
    expect(onAdded).toHaveBeenCalled();
  });

  it('writes min_value/max_value for a RESTRICTED dimension', async () => {
    render(<AddPermissionDialog templateId="tpl-1" onClose={vi.fn()} onAdded={vi.fn()} />);

    fireEvent.change(screen.getByTestId('parameter-name-select'), {
      target: { value: 'SEGMENT_A_WIDTH' },
    });
    fireEvent.change(screen.getByTestId('permission-type-select'), {
      target: { value: 'RESTRICTED' },
    });
    fireEvent.change(screen.getByTestId('min-value-input'), { target: { value: '400' } });
    fireEvent.change(screen.getByTestId('max-value-input'), { target: { value: '1800' } });
    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
    expect(mockInsert).toHaveBeenCalledWith({
      template_id: 'tpl-1',
      parameter_key: 'SEGMENT_A_WIDTH',
      parameter_type: 'DIMENSION',
      edit_mode: 'RESTRICTED',
      min_value: 400,
      max_value: 1800,
      allowed_values: null,
    });
  });

  it('writes allowed_values for a RESTRICTED option', async () => {
    render(<AddPermissionDialog templateId="tpl-1" onClose={vi.fn()} onAdded={vi.fn()} />);

    fireEvent.change(screen.getByTestId('parameter-name-select'), {
      target: { value: 'LIGHT_MOUNTING_TYPE' },
    });
    fireEvent.change(screen.getByTestId('permission-type-select'), {
      target: { value: 'RESTRICTED' },
    });
    fireEvent.change(screen.getByTestId('allowed-values-input'), {
      target: { value: 'PROFILE, COVE' },
    });
    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        parameter_key: 'LIGHT_MOUNTING_TYPE',
        parameter_type: 'OPTION',
        edit_mode: 'RESTRICTED',
        allowed_values: ['PROFILE', 'COVE'],
      }),
    );
  });
});
