import { useEffect, useRef, useState } from 'react';
import { Layer, Image, Text } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import { useSkuRenderUrls } from '@/canvas/utils/useSkuRenderUrls';

interface SkuPlacementLayerProps {
  wallHeight: number;
}

/**
 * Renders SKU RENDER assets (PNG/JPEG) as Konva Image elements on zones
 * that have assigned SKUs. Falls back to displaying sku_code text when
 * no render asset is available or image loading fails.
 *
 * This layer is read-only (listening={false}) and respects the
 * CanvasLayer.SKU_PLACEMENT visibility toggle.
 */
export function SkuPlacementLayer({ wallHeight }: SkuPlacementLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.SKU_PLACEMENT]);
  const zones = useProjectStore((s) => s.zones);
  const zoneSku = useProjectStore((s) => s.zoneSku);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  const renderUrls = useSkuRenderUrls(zoneSku);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  // Load images when URLs change
  useEffect(() => {
    let cancelled = false;

    for (const [zoneId, url] of renderUrls.entries()) {
      // Skip if already loaded or already failed
      if (imageCache.current.has(url) || failedUrls.has(url)) continue;

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        imageCache.current.set(url, img);
        setLoadedImages((prev) => {
          const next = new Map(prev);
          next.set(zoneId, img);
          return next;
        });
      };
      img.onerror = () => {
        if (cancelled) return;
        setFailedUrls((prev) => new Set(prev).add(url));
      };
      img.src = url;
    }

    // Update loadedImages map for zones that already have cached images
    const updates = new Map<string, HTMLImageElement>();
    for (const [zoneId, url] of renderUrls.entries()) {
      const cached = imageCache.current.get(url);
      if (cached) {
        updates.set(zoneId, cached);
      }
    }
    if (updates.size > 0 && !cancelled) {
      setLoadedImages((prev) => {
        const next = new Map(prev);
        for (const [k, v] of updates) {
          next.set(k, v);
        }
        return next;
      });
    }

    return () => {
      cancelled = true;
    };
  }, [renderUrls, failedUrls]);

  if (!visible) return null;

  return (
    <Layer listening={false}>
      {zones.map((zone) => {
        const sku = zoneSku.get(zone.id);
        if (!sku) return null;

        const screenY = wallHeight - zone.y_mm - zone.height_mm;
        const url = renderUrls.get(zone.id);
        const img = url ? loadedImages.get(zone.id) : null;
        const hasFailed = url ? failedUrls.has(url) : false;

        // Render image if loaded
        if (img) {
          return (
            <Image
              key={`sku-img-${zone.id}`}
              x={zone.x_mm}
              y={screenY}
              width={zone.width_mm}
              height={zone.height_mm}
              image={img}
              listening={false}
            />
          );
        }

        // Fallback: show sku_code as text if no asset or load failed
        if (!url || hasFailed) {
          return (
            <Text
              key={`sku-text-${zone.id}`}
              x={zone.x_mm}
              y={screenY + zone.height_mm / 2 - 7}
              width={zone.width_mm}
              align="center"
              text={sku.sku_code}
              fontSize={14 / zoom}
              fill="#666666"
              listening={false}
            />
          );
        }

        // Still loading - render nothing (or could show placeholder)
        return null;
      })}
    </Layer>
  );
}
