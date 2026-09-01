/**
 * BOM Engine Version
 *
 * Single constant identifying the current BOM calculation engine version.
 * Passed to save_actual_bom, stored on actual_bom.engine_version, inherited by final_bom.
 * Behaviour changes require a deliberate bump. Never derived from package.json.
 */
export const BOM_ENGINE_VERSION = '1.0.0';
