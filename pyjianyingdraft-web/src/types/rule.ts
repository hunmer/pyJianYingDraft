/**
 * 规则组相关的类型定义
 */
import type { MaterialInfo } from './draft';

/**
 * 位置信息
 */
export interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 规则元数据
 */
export interface RuleMeta {
  /** 位置信息(可选) */
  position?: Position;
  /** 其他元数据(可扩展) */
  [key: string]: any;
}

/**
 * 单条规则定义
 */
export interface Rule {
  /** 规则类型(唯一标识) */
  type: string;
  /** 规则显示标题 */
  title: string;
  /** 关联的素材ID列表 */
  material_ids: string[];
  /** 规则元数据 */
  meta?: RuleMeta;
}

/**
 * 规则组
 */
export interface RuleGroup {
  /** 规则组ID */
  id: string;
  /** 规则组标题 */
  title: string;
  /** 规则列表 */
  rules: Rule[];
  /** 创建时间 */
  createdAt?: string;
  /** 最后修改时间 */
  updatedAt?: string;
}

/**
 * 测试数据 - 素材项
 */
export interface TestItem {
  /** 规则类型 */
  type: string;
  /** 数据内容 */
  data: {
    [key: string]: any;
  };
}

/**
 * 测试数据
 */
export interface TestData {
  /** 轨道列表 */
  tracks: Array<{
    id: string;
    title?: string;
    type: string;
  }>;
  /** 素材项列表 */
  items: TestItem[];
}

/**
 * 测试数据集 - 用于保存和管理测试数据
 */
export interface TestDataset {
  /** 数据集ID */
  id: string;
  /** 数据集名称 */
  name: string;
  /** 关联的规则组ID */
  ruleGroupId: string;
  /** 测试数据内容 */
  data: TestData;
  /** 数据集描述 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后修改时间 */
  updatedAt: string;
}

/**
 * 规则组测试请求
 */
/**
 * Ƭ����ʽӳ��
 */
export type SegmentStylesPayload = Record<string, Record<string, any>>;

/**
 * ԭʼƬ�λع�
 */
export interface RawSegmentPayload {
  track_id: string;
  track_type: string;
  track_name?: string;
  material_id?: string;
  segment: Record<string, any>;
  material?: Record<string, any>;
  material_category?: string;
  extra_materials?: Record<string, Record<string, any>[]>;
}

/**
 * 原始素材载荷
 */
export interface RawMaterialPayload {
  id: string;
  category: string;
  data: Record<string, any>;
}

/**
 * 草稿配置信息
 */
export interface DraftConfig {
  /** 画布配置 (canvas_width, canvas_height等) */
  canvas_config?: {
    canvas_width?: number;
    canvas_height?: number;
    [key: string]: any;
  };
  /** 通用配置 (maintrack_adsorb等) */
  config?: Record<string, any>;
  /** 帧率 */
  fps?: number;
  /** 其他自定义配置 */
  [key: string]: any;
}

export interface RuleGroupTestRequest {
  ruleGroup: RuleGroup;
  materials: MaterialInfo[];
  testData: TestData;
  segment_styles?: SegmentStylesPayload;
  use_raw_segments?: boolean;
  raw_segments?: RawSegmentPayload[];
  raw_materials?: RawMaterialPayload[];
  /** 草稿配置(会覆盖草稿JSON的对应字段) */
  draft_config?: DraftConfig;
  /** @deprecated 已废弃,使用 draft_config.canvas_config.canvas_width */
  canvas_width?: number;
  /** @deprecated 已废弃,使用 draft_config.canvas_config.canvas_height */
  canvas_height?: number;
  /** @deprecated 已废弃,使用 draft_config.fps */
  fps?: number;
}

/**
 * 规则组测试响应
 */
export interface RuleGroupTestResponse {
  status_code: number;
  draft_path: string;
  message?: string;
}
