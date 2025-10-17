/**
 * 剪映草稿相关的TypeScript类型定义
 * 对应FastAPI服务端返回的数据结构
 */

/**
 * 时间范围
 */
export interface Timerange {
  /** 开始时间(微秒) */
  start: number;
  /** 持续时长(微秒) */
  duration: number;
  /** 开始时间(秒) */
  start_seconds: number;
  /** 持续时长(秒) */
  duration_seconds: number;
}

/**
 * 片段信息
 */
export interface SegmentInfo {
  /** 片段ID */
  id: string;
  /** 素材ID */
  material_id: string;
  /** 目标时间范围 */
  target_timerange: Timerange;
  /** 源时间范围 */
  source_timerange?: Timerange;
  /** 播放速度 */
  speed?: number;
  /** 音量 (0.0-1.0) */
  volume?: number;
  /** 片段类型(可选) */
  type?: string;
  /** 片段名称(可选) */
  name?: string;
}

/**
 * 轨道类型
 */
export type TrackType = 'video' | 'audio' | 'text' | 'effect' | 'filter' | 'sticker';

/**
 * 轨道信息
 */
export interface TrackInfo {
  /** 轨道ID */
  id: string;
  /** 轨道名称 */
  name: string;
  /** 轨道类型 */
  type: TrackType;
  /** 渲染索引 */
  render_index: number;
  /** 片段数量 */
  segment_count: number;
  /** 片段列表 */
  segments: SegmentInfo[];
}

/**
 * 素材类型
 */
export type MaterialType = 'video' | 'audio' | 'text' | 'image' | 'effect' | 'filter' | 'transition' | 'sticker' | 'extract_music' | 'subtitle' | 'photo';

/**
 * 素材信息
 */
export interface MaterialInfo {
  /** 素材ID */
  id: string;
  /** 素材类型 */
  type: MaterialType;
  /** 素材名称 */
  name?: string;
  /** 文件路径 */
  path?: string;
  /** 时长(微秒) */
  duration?: number;
  /** 时长(秒) */
  duration_seconds?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 额外属性 */
  [key: string]: any;
}

/**
 * 草稿信息
 */
export interface DraftInfo {
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
  /** 帧率 */
  fps: number;
  /** 总时长(微秒) */
  duration: number;
  /** 总时长(秒) */
  duration_seconds: number;
  /** 轨道总数 */
  track_count: number;
  /** 轨道列表 */
  tracks: TrackInfo[];
}

/**
 * 素材统计信息
 */
export interface MaterialStatistics {
  /** 素材总数 */
  total_count: number;
  /** 按类型分类的素材数量 */
  by_type: Record<MaterialType, number>;
  /** 视频素材数 */
  videos?: number;
  /** 音频素材数 */
  audios?: number;
  /** 文本素材数 */
  texts?: number;
  /** 图片素材数 */
  images?: number;
}

/**
 * 轨道统计信息
 */
export interface TrackStatistics {
  /** 轨道总数 */
  total_count: number;
  /** 按类型分类的轨道数量 */
  by_type: Record<TrackType, number>;
  /** 视频轨道数 */
  video_tracks?: number;
  /** 音频轨道数 */
  audio_tracks?: number;
  /** 文本轨道数 */
  text_tracks?: number;
}

/**
 * 复合片段信息
 */
export interface SubdraftInfo {
  /** 复合片段ID */
  id: string;
  /** 复合片段名称 */
  name: string;
  /** 类型 */
  type: string;
  /** 组合ID */
  combination_id?: string;
  /** 草稿信息 */
  draft_info: DraftInfo;
  /** 素材统计 */
  material_stats?: MaterialStatistics;
}

/**
 * API错误响应
 */
export interface ApiError {
  /** 错误消息 */
  detail: string;
}
