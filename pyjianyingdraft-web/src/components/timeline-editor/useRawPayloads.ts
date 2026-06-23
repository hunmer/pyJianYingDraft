import { useMemo } from 'react';
import type { RawMaterialPayload, RawSegmentPayload } from '@/types/rule';
import type { AllMaterialsResponse } from '@/lib/api';
import { cloneDeep } from './utils';

/**
 * 解析原始草稿/分类素材数据，生成素材查找表与原始载荷
 */
export function useRawPayloads(
  rawMaterials: AllMaterialsResponse | null | undefined,
  rawDraft: Record<string, any> | undefined,
) {
  const materialLookup = useMemo(() => {
    const map = new Map<string, { category: string; data: Record<string, any> }>();

    const registerItems = (category: string, items: unknown) => {
      if (!Array.isArray(items)) {
        return;
      }
      items.forEach((item) => {
        if (!item || typeof item !== 'object') {
          return;
        }
        const rawItem = item as Record<string, any>;
        const candidateId = rawItem.id ?? rawItem.material_id;
        if (!candidateId) {
          return;
        }
        const key = String(candidateId);
        if (!map.has(key)) {
          map.set(key, { category, data: rawItem });
        }
      });
    };

    if (rawMaterials) {
      Object.entries(rawMaterials).forEach(([category, info]) => {
        if (!info) {
          return;
        }
        registerItems(category, info.items);
      });
    } else if (rawDraft && typeof rawDraft === 'object') {
      const materialsSection = (rawDraft as Record<string, any>).materials;
      if (materialsSection && typeof materialsSection === 'object') {
        Object.entries(materialsSection as Record<string, unknown>).forEach(([category, items]) => {
          registerItems(category, items);
        });
      }
    }

    return map;
  }, [rawMaterials, rawDraft]);

  const rawMaterialPayloads = useMemo<RawMaterialPayload[] | undefined>(() => {
    if (materialLookup.size === 0) {
      return undefined;
    }
    return Array.from(materialLookup.entries()).map(([id, entry]) => ({
      id,
      category: entry.category,
      data: cloneDeep(entry.data),
    }));
  }, [materialLookup]);

  const rawSegmentPayloads = useMemo<RawSegmentPayload[] | undefined>(() => {
    if (!rawDraft || typeof rawDraft !== 'object' || !Array.isArray((rawDraft as any).tracks)) {
      return undefined;
    }
    const payloads: RawSegmentPayload[] = [];
    (rawDraft as any).tracks.forEach((track: any) => {
      if (!track || typeof track !== 'object') {
        return;
      }
      const trackIdValue = track.id;
      if (trackIdValue === undefined || trackIdValue === null) {
        return;
      }
      const trackId = String(trackIdValue);
      const trackType = typeof track.type === 'string' ? track.type : 'video';
      const trackName = typeof track.name === 'string' ? track.name : undefined;
      const segments = Array.isArray(track.segments) ? track.segments : [];
      segments.forEach((segment: any) => {
        if (!segment || typeof segment !== 'object') {
          return;
        }
        const materialIdValue = segment.material_id;
        const materialId =
          materialIdValue === undefined || materialIdValue === null ? undefined : String(materialIdValue);

        let materialCategory: string | undefined;
        let materialData: Record<string, any> | undefined;
        if (materialId) {
          const materialInfo = materialLookup.get(materialId);
          if (materialInfo) {
            materialCategory = materialInfo.category;
            materialData = cloneDeep(materialInfo.data);
          }
        }

        let extraMaterials: Record<string, Record<string, any>[]> | undefined;
        const extraRefs = Array.isArray(segment.extra_material_refs) ? segment.extra_material_refs : [];
        extraRefs.forEach((ref: any) => {
          if (ref === undefined || ref === null) {
            return;
          }
          const refId = String(ref);
          const refInfo = materialLookup.get(refId);
          if (!refInfo) {
            return;
          }
          if (!extraMaterials) {
            extraMaterials = {};
          }
          if (!extraMaterials[refInfo.category]) {
            extraMaterials[refInfo.category] = [];
          }
          extraMaterials[refInfo.category].push(cloneDeep(refInfo.data));
        });

        payloads.push({
          track_id: trackId,
          track_type: trackType,
          track_name: trackName,
          material_id: materialId,
          segment: cloneDeep(segment),
          material: materialData,
          material_category: materialCategory,
          extra_materials: extraMaterials,
        });
      });
    });
    return payloads.length > 0 ? payloads : undefined;
  }, [rawDraft, materialLookup]);

  return { materialLookup, rawMaterialPayloads, rawSegmentPayloads };
}
