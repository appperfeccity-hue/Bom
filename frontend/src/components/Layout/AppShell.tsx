import { ReactNode } from 'react';
import { IconRail } from './IconRail';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell provides the application's root grid layout:
 * - 56px icon rail (left)
 * - 56px top bar (top)
 * - Flexible main content area (center)
 * - 24px status bar (bottom)
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <IconRail />
      <TopBar />
      <div className="main-area">
        {children}
      </div>
      <StatusBar />
    </div>
  );
}
