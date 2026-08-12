import { useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { usePermissionEnforcement } from '@/canvas/permissions/usePermissionEnforcement';
import { useHistory } from '@/canvas/history/useHistory';

/**
 * Hook that wraps SKU removal with a permission check and history push.
 * Pushes current zones state to history before removal so undo restores
 * the previous state.
 */
export function useSkuRemove(): { removeSku: (zoneId: string) => void } {
  const history = useHistory();
  const { canEditZone } = usePermissionEnforcement();

  const removeSku = useCallback(
    (zoneId: string) => {
      if (!canEditZone(zoneId)) return;

      // Push current state to history before making changes
      const zones = useProjectStore.getState().zones;
      history.pushState(zones);

      // Execute the removal
      void useProjectStore.getState().removeSku(zoneId);
    },
    [canEditZone, history],
  );

  return { removeSku };
}
