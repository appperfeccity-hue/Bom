import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: '⊞' },
  { id: 'sku-master', label: 'SKU Master', path: '/admin/skus', icon: '◉' },
  { id: 'catalogue', label: 'Catalogue', path: '/admin/catalogue', icon: '☰' },
  { id: 'templates', label: 'Templates', path: '/canvas', icon: '◧' },
  { id: 'design-library', label: 'Design Library', path: '/design-library', icon: '◈' },
  { id: 'projects', label: 'Projects', path: '/projects', icon: '▦' },
  { id: 'settings', label: 'Settings', path: '/admin', icon: '⚙' },
];

const TOOLTIP_DELAY = 300;

export function IconRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup tooltip timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback((id: string) => {
    setHoveredItem(id);
    timerRef.current = setTimeout(() => {
      setTooltipVisible(true);
    }, TOOLTIP_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHoveredItem(null);
    setTooltipVisible(false);
  }, []);

  const isActive = (item: NavItem): boolean => {
    const { pathname } = location;
    // Exact match for root path
    if (item.path === '/') return pathname === '/';
    // Exact match for specific paths to avoid ambiguity
    if (item.path === '/canvas') return pathname === '/canvas';
    if (item.path === '/projects') return pathname === '/projects';
    // Prefix match for admin sub-routes
    return pathname.startsWith(item.path);
  };

  return (
    <nav className="icon-rail" data-testid="icon-rail" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`icon-rail__item${isActive(item) ? ' icon-rail__item--active' : ''}`}
          onClick={() => navigate(item.path)}
          onMouseEnter={() => handleMouseEnter(item.id)}
          onMouseLeave={handleMouseLeave}
          data-testid={`icon-rail-${item.id}`}
          aria-label={item.label}
          type="button"
        >
          <span style={{ fontSize: '18px' }}>{item.icon}</span>
          {hoveredItem === item.id && (
            <span
              className={`icon-rail__tooltip${tooltipVisible ? ' icon-rail__tooltip--visible' : ''}`}
            >
              {item.label}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
