import type { SegmentInfo, TrackInfo } from '@/types/draft';
import type { RuleGroup } from '@/types/rule';
import type { TimelineAction, TimelineRow } from '@xzdarcy/react-timeline-editor';

export const cloneRuleGroups = (groups: RuleGroup[]): RuleGroup[] =>
  groups.map((group) => ({
    ...group,
    rules: Array.isArray(group.rules) ? group.rules.map(rule => ({ ...rule })) : [],
  }));

export const cloneDeep = <T,>(value: T): T =>
  value === undefined ? (value as T) : JSON.parse(JSON.stringify(value));

/**
 * 将剪映片段转换为Timeline编辑器的Action格式
 */
export function segmentToAction(segment: SegmentInfo, trackType: string): TimelineAction {
  const startSeconds = segment.target_timerange.start_seconds;
  const endSeconds = startSeconds + segment.target_timerange.duration_seconds;

  return {
    id: segment.id,
    start: startSeconds,
    end: endSeconds,
    effectId: segment.material_id,
    // 自定义数据
    data: {
      name: segment.name || `片段`,
      type: trackType,
      speed: segment.speed,
      volume: segment.volume,
      material_id: segment.material_id,
    },
  } as TimelineAction;
}

/**
 * 将剪映轨道转换为Timeline编辑器的Row格式
 */
export function trackToRow(track: TrackInfo): TimelineRow {
  const actions = track.segments.map(seg => segmentToAction(seg, track.type));

  return {
    id: track.id,
    actions,
    // 自定义数据
    data: {
      name: track.name,
      type: track.type,
      render_index: track.render_index,
    },
  } as TimelineRow;
}
