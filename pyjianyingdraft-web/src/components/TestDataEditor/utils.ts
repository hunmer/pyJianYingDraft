/**
 * TestDataEditor 纯逻辑工具函数（无 React 依赖）
 */

import type { RuleGroupTestRequest } from '@/types/rule';

/** 规则的最小结构（用于轨道类型映射） */
interface RuleLike {
  type: string;
  title: string;
  material_ids?: string[];
}

/** 素材的最小结构（用于轨道类型映射） */
interface MaterialLike {
  id: string;
  type: string;
}

/** 素材类型 → 轨道类型映射表 */
const MATERIAL_TYPE_TO_TRACK: Record<string, string> = {
  video: 'video',
  image: 'video',
  photo: 'video',
  audio: 'audio',
  music: 'audio',
  extract_music: 'audio',
  sound: 'audio',
  text: 'text',
  subtitle: 'text',
  sticker: 'sticker',
  gif: 'sticker',
  effect: 'effect',
  video_effect: 'effect',
  filter: 'filter',
  transition: 'effect', // 转场效果通常放在特效轨道
};

/**
 * 根据规则与其首个素材类型推断轨道类型。
 * 提取自原 handleAddTracks 内联逻辑：默认使用规则 type，
 * 若首个素材类型可识别则覆盖为对应轨道类型。
 */
export function resolveTrackType(rule: RuleLike, materials?: MaterialLike[]): string {
  let trackType = rule.type;

  const firstMaterialId =
    rule.material_ids && rule.material_ids.length > 0 ? rule.material_ids[0] : null;

  if (firstMaterialId && materials && materials.length > 0) {
    const material = materials.find((m) => m.id === firstMaterialId);
    if (material) {
      const mapped = MATERIAL_TYPE_TO_TRACK[material.type];
      if (mapped) {
        trackType = mapped;
      } else {
        console.log('无法识别的素材类型:', material.type);
      }
    }
  }

  return trackType;
}

/**
 * 根据规则构建轨道对象。
 * id = 规则 type，title = 规则标题，type = 映射后的轨道类型。
 */
export function buildTrackFromRule(
  rule: RuleLike,
  materials?: MaterialLike[],
): { id: string; title: string; type: string } {
  return {
    id: rule.type,
    title: rule.title,
    type: resolveTrackType(rule, materials),
  };
}

/**
 * 通用 JSON 文件下载。
 * compress = true 时序列化为单行并转义反斜杠与双引号，便于嵌入另一段 JSON 字符串。
 */
export function downloadJSON(data: any, filename: string, compress: boolean) {
  let fileContent: string;

  if (compress) {
    const jsonString = JSON.stringify(data);
    fileContent = jsonString.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  } else {
    fileContent = JSON.stringify(data);
  }

  const blob = new Blob([fileContent], { type: 'text/plain' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

/**
 * 从完整请求载荷构建下载用载荷。
 * includeItems = false 时清空 testData.items（基础数据）。
 */
export function buildRequestPayload(
  fullRequestPayload: RuleGroupTestRequest,
  includeItems: boolean,
): any {
  const payload: any = {
    draft_config: fullRequestPayload.draft_config,
    ruleGroup: fullRequestPayload.ruleGroup,
    materials: fullRequestPayload.materials,
    testData: includeItems
      ? fullRequestPayload.testData
      : { ...fullRequestPayload.testData, items: [] },
  };

  if ((fullRequestPayload as any).segment_styles) {
    payload.segment_styles = (fullRequestPayload as any).segment_styles;
  }
  if ((fullRequestPayload as any).raw_segments) {
    payload.raw_segments = (fullRequestPayload as any).raw_segments;
  }
  if ((fullRequestPayload as any).raw_materials) {
    payload.raw_materials = (fullRequestPayload as any).raw_materials;
  }

  return payload;
}
