import { useEffect, useState, useRef } from 'react';
import type { SkuMaster } from '@/types/database';
import { supabase, fromTable } from '@/lib/supabase';

/**
 * Hook that resolves signed URLs for SKU RENDER assets given the zoneSku mapping.
 *
 * For each zone's SKU, it:
 * 1. Fetches the catalogue_asset file_reference for the RENDER type
 * 2. Generates a signed URL via supabase.storage
 * 3. Returns a Map<zoneId, signedUrl>
 *
 * Results are cached and refreshed when the zoneSku map changes.
 */
export function useSkuRenderUrls(zoneSku: Map<string, SkuMaster>): Map<string, string> {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());
  const fileRefCache = useRef<Map<string, string>>(new Map());
  const signedUrlCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function fetchUrls() {
      if (zoneSku.size === 0) {
        setUrlMap(new Map());
        return;
      }

      const newUrlMap = new Map<string, string>();
      const skuIds = Array.from(new Set(Array.from(zoneSku.values()).map((s) => s.sku_id)));

      // Fetch catalogue entries for SKUs we don't have cached file_references for
      const uncachedSkuIds = skuIds.filter((id) => !fileRefCache.current.has(id));

      if (uncachedSkuIds.length > 0) {
        try {
          // Get catalogue entries for the SKUs
          const { data: entries } = await fromTable('catalogue_entry')
            .select('catalogue_entry_id, sku_id')
            .in('sku_id', uncachedSkuIds);

          if (entries && entries.length > 0) {
            const entryIds = entries.map((e: Record<string, unknown>) => e.catalogue_entry_id as string);
            const entryToSku = new Map<string, string>(
              entries.map((e: Record<string, unknown>) => [e.catalogue_entry_id as string, e.sku_id as string])
            );

            // Get RENDER assets for those catalogue entries
            const { data: assets } = await fromTable('catalogue_asset')
              .select('catalogue_entry_id, file_reference')
              .in('catalogue_entry_id', entryIds)
              .eq('asset_type', 'RENDER')
              .eq('is_current', true);

            if (assets) {
              for (const asset of assets) {
                const skuId = entryToSku.get(asset.catalogue_entry_id as string);
                if (skuId) {
                  fileRefCache.current.set(skuId, asset.file_reference as string);
                }
              }
            }
          }
        } catch {
          // Silently fail - fallback text will be shown
        }
      }

      // Generate signed URLs for file references
      for (const [zoneId, sku] of zoneSku.entries()) {
        const fileRef = fileRefCache.current.get(sku.sku_id);
        if (!fileRef) continue;

        // Check if we already have a signed URL for this file reference
        if (signedUrlCache.current.has(fileRef)) {
          newUrlMap.set(zoneId, signedUrlCache.current.get(fileRef)!);
          continue;
        }

        try {
          const { data } = await supabase.storage
            .from('catalogue-assets')
            .createSignedUrl(fileRef, 3600);

          if (data?.signedUrl) {
            signedUrlCache.current.set(fileRef, data.signedUrl);
            newUrlMap.set(zoneId, data.signedUrl);
          }
        } catch {
          // Silently fail - fallback text will be shown
        }
      }

      if (!cancelled) {
        setUrlMap(newUrlMap);
      }
    }

    void fetchUrls();

    return () => {
      cancelled = true;
    };
  }, [zoneSku]);

  return urlMap;
}
