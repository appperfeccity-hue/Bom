import type { SaveStatus } from '@/types/canvas';

/**
 * Creates a debounced save function with optimistic locking support.
 * Manages save status transitions: unsaved -> saving -> saved | error.
 *
 * @param saveFn - The async function that performs the actual Supabase upsert.
 *                 Should include `version` in the WHERE clause for optimistic locking.
 * @param onStatusChange - Callback to update save status in the store.
 * @param delayMs - Debounce delay in milliseconds (default: 2000ms).
 */
export function createDebouncedSave(
  saveFn: (version: number) => Promise<{ version: number }>,
  onStatusChange: (status: SaveStatus) => void,
  delayMs: number = 2000,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedSave = (currentVersion: number) => {
    // Mark as unsaved immediately
    onStatusChange('unsaved');

    // Clear any pending save
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      timeoutId = null;
      onStatusChange('saving');

      try {
        await saveFn(currentVersion);
        onStatusChange('saved');
      } catch {
        onStatusChange('error');
      }
    }, delayMs);
  };

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = async (currentVersion: number) => {
    cancel();
    onStatusChange('saving');
    try {
      await saveFn(currentVersion);
      onStatusChange('saved');
    } catch {
      onStatusChange('error');
    }
  };

  return { debouncedSave, cancel, flush };
}
