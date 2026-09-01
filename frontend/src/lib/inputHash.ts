import { sortKeysDeep } from '@/lib/snapshotBuilder';

/**
 * Compute a deterministic SHA-256 hash of BOM pipeline inputs.
 * Used as the input_hash parameter for save_actual_bom to detect
 * when the same pipeline inputs produce the same BOM.
 *
 * @param snapshotHash - The snapshot hash (from project_snapshot)
 * @param measurements - The measurements object used by the pipeline
 * @param configuration - The configuration data used by the pipeline
 * @returns hex-encoded SHA-256 hash string
 */
export async function computeInputHash(
  snapshotHash: string,
  measurements: Record<string, unknown>,
  configuration: Record<string, unknown>,
): Promise<string> {
  const canonical = JSON.stringify(
    sortKeysDeep({ snapshotHash, measurements, configuration }),
  );
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
