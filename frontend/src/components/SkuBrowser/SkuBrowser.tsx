import { useSkuStore } from '@/stores/skuStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import { SkuFilterBar } from './SkuFilterBar';
import { SkuGrid } from './SkuGrid';
import { SkuDetailPanel } from './SkuDetailPanel';

/**
 * SKU Browser panel - a right-side overlay panel for browsing and assigning SKUs to zones.
 * Only renders in DESIGNER mode when isBrowserOpen is true.
 */
export function SkuBrowser() {
  const isBrowserOpen = useSkuStore((s) => s.isBrowserOpen);
  const closeBrowser = useSkuStore((s) => s.closeBrowser);
  const selectedSkuId = useSkuStore((s) => s.selectedSkuId);
  const mode = useCanvasStore((s) => s.mode);

  // Only render in designer mode when browser is open
  if (!isBrowserOpen || mode !== CanvasMode.DESIGNER) return null;

  return (
    <div
      data-testid="sku-browser-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '440px',
        height: '100vh',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e0e0e0',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>SKU Browser</h3>
        <button
          onClick={closeBrowser}
          style={{
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666',
            lineHeight: 1,
            padding: '4px',
          }}
          data-testid="sku-browser-close-btn"
        >
          &times;
        </button>
      </div>

      {/* Filter Bar */}
      <SkuFilterBar />

      {/* Grid */}
      <SkuGrid />

      {/* Detail Panel (shown when a SKU is selected) */}
      {selectedSkuId && <SkuDetailPanel />}
    </div>
  );
}
