import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';

/**
 * Layout route component that wraps all authenticated routes with AppShell.
 * Provides the icon rail, top bar, and status bar around all protected content.
 */
export function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
