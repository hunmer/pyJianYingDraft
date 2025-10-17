/**
 * 规则组相关的类型定义
 */

/**
 * 输入字段定义
 */
export interface RuleInput {
  /** 字段类型 */
  type: 'string' | 'number' | 'boolean' | 'image';
  /** 字段描述 */
  desc: string;
  /** 默认值(可选) */
  value?: any;
}

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
  /** 输入字段定义 */
  inputs: {
    [key: string]: RuleInput;
  };
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
 * 测试数据 - 轨道信息
 */
export interface TestTrack {
  id: string;
  type: 'video' | 'audio' | 'text' | 'effect' | 'filter' | 'sticker';
}

/**
 * 测试数据 - 时间轴信息
 */
export interface TestTimeline {
  track: string;
  start: number;
  duration: number;
}

/**
 * 测试数据 - 位置信息
 */
export interface TestPosition {
  x?: number;
  y?: number;
  scale?: number;
}

/**
 * 测试数据 - 素材项元数据
 */
export interface TestItemMeta {
  timeline: TestTimeline;
  position?: TestPosition;
  [key: string]: any;
}

/**
 * 测试数据 - 素材项
 */
export interface TestItem {
  /** 规则类型 */
  type: string;
  /** 元数据 */
  meta: TestItemMeta;
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
  tracks: TestTrack[];
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
