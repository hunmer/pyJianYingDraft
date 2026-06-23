import type { TrackInfo, MaterialInfo } from '@/types/draft';
import type { RuleGroup, TestData } from '@/types/rule';
import type { AllMaterialsResponse } from '@/lib/api';

/**
 * Timeline组件的Props
 */
export interface TimelineEditorProps {
  /** 轨道数据 */
  tracks: TrackInfo[];
  /** 素材数据(可选,不传则不显示素材) */
  materials?: MaterialInfo[];
  /** 原始素材详细信息 */
  materialDetails?: Record<string, { category: string; data: Record<string, any> }>;
  /** 草稿时长(秒) */
  duration: number;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 轨道变化回调 */
  onChange?: (tracks: TrackInfo[]) => void;
  /** 草稿原始JSON */
  rawDraft?: Record<string, any>;
  /** 分类素材原始数据 */
  rawMaterials?: AllMaterialsResponse | null;
  /** 画布宽度 */
  canvasWidth?: number;
  /** 画布高度 */
  canvasHeight?: number;
  /** 帧率 */
  fps?: number;
  /** 草稿文件路径 */
  draftPath?: string;
  /** 规则组变化回调 */
  onRuleGroupsChange?: (ruleGroups: RuleGroup[]) => void;
  /** 初始规则组 */
  initialRuleGroups?: RuleGroup[] | null;
  /** 处理测试数据选择回调(必需) */
  handleTestDataSelect: (
    testDataId: string,
    label: string,
    onTest: (testData: any) => Promise<any> | any,
    context?: {
      ruleGroupId?: string;
      ruleGroup?: any;
      materials?: MaterialInfo[];
      rawSegments?: any[];
      rawMaterials?: any[];
      initialTestData?: TestData;
    }
  ) => void;
  /** 草稿信息 */
  draftInfo?: {
    duration: number;
    duration_seconds: number;
    track_count: number;
    width: number;
    height: number;
    fps: number;
  };
}
