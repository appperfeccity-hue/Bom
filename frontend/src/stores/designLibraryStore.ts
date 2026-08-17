import { create } from 'zustand';
import type { Template, DesignFamilyMaster, WallGeometryType } from '@/types/database';
import { fromTable } from '@/lib/supabase';

// --- Types ---

export interface TemplateWithAvailability extends Template {
  availability: 'AVAILABLE' | 'BLOCKED';
  blockedReasons: string[];
  designFamilyName: string | null;
}

export interface DesignLibraryFilters {
  search: string;
  designFamilyId: string | null;
  wallGeometry: WallGeometryType | null;
  availability: 'ALL' | 'AVAILABLE' | 'BLOCKED';
}

// --- State / Actions / Store types ---

export interface DesignLibraryState {
  templates: TemplateWithAvailability[];
  filteredTemplates: TemplateWithAvailability[];
  designFamilies: DesignFamilyMaster[];
  filters: DesignLibraryFilters;
  selectedTemplateDetail: TemplateWithAvailability | null;
  isLoading: boolean;
  error: string | null;
}

export interface DesignLibraryActions {
  fetchTemplatesWithAvailability: () => Promise<void>;
  setSearchFilter: (text: string) => void;
  setDesignFamilyFilter: (id: string | null) => void;
  setWallGeometryFilter: (type: WallGeometryType | null) => void;
  setAvailabilityFilter: (status: 'ALL' | 'AVAILABLE' | 'BLOCKED') => void;
  selectTemplateForPreview: (template: TemplateWithAvailability) => void;
  clearPreview: () => void;
  reset: () => void;
}

export type DesignLibraryStore = DesignLibraryState & DesignLibraryActions;

const initialState: DesignLibraryState = {
  templates: [],
  filteredTemplates: [],
  designFamilies: [],
  filters: {
    search: '',
    designFamilyId: null,
    wallGeometry: null,
    availability: 'ALL',
  },
  selectedTemplateDetail: null,
  isLoading: false,
  error: null,
};

// --- Client-side filter logic ---

function filterTemplates(
  templates: TemplateWithAvailability[],
  filters: DesignLibraryFilters,
): TemplateWithAvailability[] {
  let result = templates;

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower)),
    );
  }

  if (filters.designFamilyId) {
    result = result.filter((t) => t.design_family_id === filters.designFamilyId);
  }

  if (filters.wallGeometry) {
    result = result.filter((t) => t.wall_geometry.type === filters.wallGeometry);
  }

  if (filters.availability !== 'ALL') {
    result = result.filter((t) => t.availability === filters.availability);
  }

  return result;
}

// --- Selector helper ---

/**
 * Groups templates by their design family name.
 * Templates with no design family are grouped under 'Uncategorized'.
 */
export function groupByDesignFamily(
  templates: TemplateWithAvailability[],
): Map<string, TemplateWithAvailability[]> {
  const grouped = new Map<string, TemplateWithAvailability[]>();

  for (const template of templates) {
    const key = template.designFamilyName ?? 'Uncategorized';
    const existing = grouped.get(key);
    if (existing) {
      existing.push(template);
    } else {
      grouped.set(key, [template]);
    }
  }

  return grouped;
}

// --- Store ---

export const useDesignLibraryStore = create<DesignLibraryStore>((set, get) => ({
  ...initialState,

  fetchTemplatesWithAvailability: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch ACTIVE templates and design families in parallel
      const [templatesResult, familiesResult] = await Promise.all([
        fromTable('template').select('*').eq('status', 'ACTIVE'),
        fromTable('design_family_master').select('*'),
      ]);

      if (templatesResult.error) throw templatesResult.error;
      if (familiesResult.error) throw familiesResult.error;

      const rawTemplates = (templatesResult.data ?? []) as Template[];
      const designFamilies = (familiesResult.data ?? []) as DesignFamilyMaster[];

      // Build a lookup map for design family names
      const familyNameMap = new Map<string, string>();
      for (const family of designFamilies) {
        familyNameMap.set(family.design_family_id, family.name);
      }

      // Fetch zone data for all templates
      const templateIds = rawTemplates.map((t) => t.template_id);

      let templatesWithAvailability: TemplateWithAvailability[];

      if (templateIds.length === 0) {
        templatesWithAvailability = [];
      } else {
        // Fetch all zones for active templates
        const { data: zonesData, error: zonesError } = await fromTable('template_zone')
          .select('zone_id, template_id')
          .in('template_id', templateIds);
        if (zonesError) throw zonesError;

        const zones = (zonesData ?? []) as Array<{ zone_id: string; template_id: string }>;
        const zoneIds = zones.map((z) => z.zone_id);

        // Build template -> zone_ids map
        const templateZonesMap = new Map<string, string[]>();
        for (const zone of zones) {
          const existing = templateZonesMap.get(zone.template_id);
          if (existing) {
            existing.push(zone.zone_id);
          } else {
            templateZonesMap.set(zone.template_id, [zone.zone_id]);
          }
        }

        // Fetch zone SKU assignments
        let zoneSkuData: Array<{ zone_id: string; sku_id: string }> = [];
        if (zoneIds.length > 0) {
          const { data: zsData, error: zsError } = await fromTable('template_zone_sku')
            .select('zone_id, sku_id')
            .in('zone_id', zoneIds);
          if (zsError) throw zsError;
          zoneSkuData = (zsData ?? []) as Array<{ zone_id: string; sku_id: string }>;
        }

        // Collect unique SKU IDs
        const allSkuIds = [...new Set(zoneSkuData.map((zs) => zs.sku_id))];

        // Fetch SKU master status and catalogue entry status
        let skuStatusMap = new Map<string, { skuStatus: string; skuCode: string }>();
        let catalogueStatusMap = new Map<string, string>();

        if (allSkuIds.length > 0) {
          const [skuResult, catalogueResult] = await Promise.all([
            fromTable('sku_master')
              .select('sku_id, sku_code, status')
              .in('sku_id', allSkuIds),
            fromTable('catalogue_entry')
              .select('sku_id, status')
              .in('sku_id', allSkuIds),
          ]);

          if (skuResult.error) throw skuResult.error;
          if (catalogueResult.error) throw catalogueResult.error;

          for (const sku of (skuResult.data ?? []) as Array<{ sku_id: string; sku_code: string; status: string }>) {
            skuStatusMap.set(sku.sku_id, { skuStatus: sku.status, skuCode: sku.sku_code });
          }

          for (const entry of (catalogueResult.data ?? []) as Array<{ sku_id: string; status: string }>) {
            catalogueStatusMap.set(entry.sku_id, entry.status);
          }
        }

        // Build zone -> sku_ids map
        const zoneSkuMap = new Map<string, string[]>();
        for (const zs of zoneSkuData) {
          const existing = zoneSkuMap.get(zs.zone_id);
          if (existing) {
            existing.push(zs.sku_id);
          } else {
            zoneSkuMap.set(zs.zone_id, [zs.sku_id]);
          }
        }

        // Compute availability for each template
        templatesWithAvailability = rawTemplates.map((template) => {
          const blockedReasons: string[] = [];
          const tplZoneIds = templateZonesMap.get(template.template_id) ?? [];

          for (const zoneId of tplZoneIds) {
            const skuIds = zoneSkuMap.get(zoneId) ?? [];
            for (const skuId of skuIds) {
              const skuInfo = skuStatusMap.get(skuId);
              if (!skuInfo) {
                blockedReasons.push(`SKU ${skuId} not found in catalogue`);
                continue;
              }

              if (skuInfo.skuStatus !== 'ACTIVE') {
                blockedReasons.push(`SKU ${skuInfo.skuCode} is ${skuInfo.skuStatus}`);
              }

              const catStatus = catalogueStatusMap.get(skuId);
              if (!catStatus) {
                blockedReasons.push(`SKU ${skuInfo.skuCode} has no catalogue entry`);
              } else if (catStatus !== 'READY') {
                blockedReasons.push(`SKU ${skuInfo.skuCode} catalogue is ${catStatus}`);
              }
            }
          }

          const availability: 'AVAILABLE' | 'BLOCKED' = blockedReasons.length > 0 ? 'BLOCKED' : 'AVAILABLE';
          const designFamilyName = template.design_family_id
            ? familyNameMap.get(template.design_family_id) ?? null
            : null;

          return {
            ...template,
            availability,
            blockedReasons,
            designFamilyName,
          };
        });
      }

      const { filters } = get();
      set({
        templates: templatesWithAvailability,
        filteredTemplates: filterTemplates(templatesWithAvailability, filters),
        designFamilies,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  setSearchFilter: (text: string) => {
    set((state) => {
      const filters = { ...state.filters, search: text };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  setDesignFamilyFilter: (id: string | null) => {
    set((state) => {
      const filters = { ...state.filters, designFamilyId: id };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  setWallGeometryFilter: (type: WallGeometryType | null) => {
    set((state) => {
      const filters = { ...state.filters, wallGeometry: type };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  setAvailabilityFilter: (status: 'ALL' | 'AVAILABLE' | 'BLOCKED') => {
    set((state) => {
      const filters = { ...state.filters, availability: status };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  selectTemplateForPreview: (template: TemplateWithAvailability) => {
    set({ selectedTemplateDetail: template });
  },

  clearPreview: () => {
    set({ selectedTemplateDetail: null });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
