'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timeline, TimelineEffect, TimelineRow, TimelineAction } from '@xzdarcy/react-timeline-editor';
import type { TrackInfo, SegmentInfo, MaterialInfo } from '@/types/draft';
import type { RuleGroup, TestData, SegmentStylesPayload, RawSegmentPayload, RawMaterialPayload, RuleGroupTestRequest } from '@/types/rule';
import { draftApi, ruleTestApi, tasksApi, generationRecordsApi, type AllMaterialsResponse } from '@/lib/api';
import { Button, Tooltip } from '@heroui/react';
import { Play, Plus, Eye, Download, Upload } from 'lucide-react';
import { RuleGroupSelector } from './RuleGroupSelector';
import { RuleGroupList } from './RuleGroupList';
import TestDataPage from './TestDataPage';
import { MaterialPreview } from './MaterialPreview';
import { AddToRuleGroupDialog } from './AddToRuleGroupDialog';
import { DownloadProgressBar } from './DownloadProgressBar';
import './timeline.css';
import { DEFAULT_RULES } from '@/config/defaultRules';

/**
 * Tab 面板组件
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`timeline-tabpanel-${index}`}
      aria-labelledby={`timeline-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {value === index && <div className="p-4 h-full">{children}</div>}
    </div>
  );
}

/**
 * 轨道类型对应的颜色
 */
const TRACK_COLORS: Record<string, string> = {
  video: '#1976d2',     // 蓝色
  audio: '#2e7d32',     // 绿色
  text: '#ed6c02',      // 橙色
  effect: '#9c27b0',    // 紫色
  filter: '#d32f2f',    // 红色
  sticker: '#0288d1',   // 青色
};
const cloneRuleGroups = (groups: RuleGroup[]): RuleGroup[] =>
  groups.map((group) => ({
    ...group,
    rules: Array.isArray(group.rules) ? group.rules.map(rule => ({ ...rule })) : [],
  }));

/**
 * Timeline组件的Props
 */
interface TimelineEditorProps {
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
const cloneDeep = <T,>(value: T): T =>
  value === undefined ? (value as T) : JSON.parse(JSON.stringify(value));

// 全局tooltip管理器 - 确保同时只显示一个tooltip
class TooltipManager {
  private static instance: TooltipManager;
  private currentTooltipId: string | null = null;
  private hideTimeout: NodeJS.Timeout | null = null;

  static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  // 注册新的tooltip
  registerTooltip(id: string) {
    // 如果已有tooltip显示，先关闭它
    if (this.currentTooltipId && this.currentTooltipId !== id) {
      this.clearTimeout();
      // 通知前一个tooltip关闭
      this.notifyTooltipHide(this.currentTooltipId);
    }
    this.currentTooltipId = id;
    this.clearTimeout();
  }

  // 设置隐藏超时
  setHideTimeout(id: string, callback: () => void, delay: number) {
    // 只有当前活跃的tooltip才能设置超时
    if (this.currentTooltipId === id) {
      this.clearTimeout();
      this.hideTimeout = setTimeout(() => {
        if (this.currentTooltipId === id) {
          this.currentTooltipId = null;
          callback();
        }
      }, delay);
    }
  }

  // 取消隐藏超时
  clearTimeout() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  // 主动关闭tooltip
  closeTooltip(id: string) {
    if (this.currentTooltipId === id) {
      this.clearTimeout();
      this.currentTooltipId = null;
    }
  }

  // 通知特定tooltip关闭（用于被新tooltip替换时）
  private notifyTooltipHide(id: string) {
    // 这里可以通过事件或回调机制通知对应的组件
    // 为简化实现，我们将在组件内部检查id是否匹配
  }

  // 检查是否是当前活跃的tooltip
  isActive(id: string): boolean {
    return this.currentTooltipId === id;
  }
}

/**
 * 将剪映片段转换为Timeline编辑器的Action格式
 */
function segmentToAction(segment: SegmentInfo, trackType: string): TimelineAction {
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
function trackToRow(track: TrackInfo): TimelineRow {
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

/**
 * 自定义渲染片段
 */
const CustomAction: React.FC<{
  action: TimelineAction;
  row: TimelineRow;
  isSelected?: boolean;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent, action: TimelineAction, row: TimelineRow) => void;
  material?: MaterialInfo;
  selectedRuleGroup?: RuleGroup | null;
  isHighlighted?: boolean;
}> = ({ action, row, isSelected = false, onClick, onContextMenu, material, selectedRuleGroup, isHighlighted = false }) => {
  const trackType = (row as any).data?.type || 'video';
  const color = TRACK_COLORS[trackType] || '#666';
  const name = (action as any).data?.name || '未命名';
  const speed = (action as any).data?.speed;
  const volume = (action as any).data?.volume;

  // 状态：控制Tooltip的显示和位置
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
  const tooltipManager = React.useRef(TooltipManager.getInstance());
  const tooltipId = React.useRef<string | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event, action, row);
  };

  const handleMouseEnter = (event: React.MouseEvent) => {
    // 生成唯一的tooltip ID
    const id = `${action.id}-${action.start}`;
    tooltipId.current = id;

    // 注册新的tooltip（这会自动关闭其他tooltip）
    tooltipManager.current.registerTooltip(id);

    // 设置Tooltip位置为鼠标右上角（向右偏移15px，y轴不偏移）
    setTooltipPosition({
      x: event.clientX + 15,
      y: event.clientY
    });
    setTooltipOpen(true);
  };

  const handleMouseLeave = (event: React.MouseEvent) => {
    if (!tooltipId.current) return;

    // 设置隐藏超时，让用户有时间移动到Tooltip内容
    tooltipManager.current.setHideTimeout(tooltipId.current, () => {
      // 只有当前活跃的tooltip才能关闭
      if (tooltipManager.current.isActive(tooltipId.current!)) {
        setTooltipOpen(false);
      }
    }, 300);
  };

  const handleTooltipMouseEnter = () => {
    // 鼠标进入Tooltip内容区域时，取消关闭倒计时
    if (tooltipId.current) {
      tooltipManager.current.clearTimeout();
    }
  };

  const handleTooltipMouseLeave = () => {
    // 鼠标离开Tooltip内容区域时，立即关闭
    if (tooltipId.current) {
      tooltipManager.current.closeTooltip(tooltipId.current);
      setTooltipOpen(false);
    }
  };

  // 监听其他tooltip的显示，关闭当前tooltip
  React.useEffect(() => {
    const checkActive = () => {
      if (tooltipId.current && !tooltipManager.current.isActive(tooltipId.current)) {
        setTooltipOpen(false);
      }
    };

    const interval = setInterval(checkActive, 50);
    return () => clearInterval(interval);
  }, []);

  // 组件卸载时清理
  React.useEffect(() => {
    return () => {
      if (tooltipId.current) {
        tooltipManager.current.closeTooltip(tooltipId.current);
      }
    };
  }, []);

  // 检查素材是否在当前规则组中
  const rulesUsingMaterial = selectedRuleGroup?.rules.filter(rule =>
    material?.id && rule.material_ids.includes(material.id)
  ) || [];
  const isInRuleGroup = rulesUsingMaterial.length > 0;

  // 检查素材是否在任意规则组中（用于判断背景颜色）
  const isInAnyRuleGroup = React.useMemo(() => {
    if (!material?.id || !selectedRuleGroup) return false;
    return selectedRuleGroup.rules.some(rule => rule.material_ids.includes(material.id));
  }, [material?.id, selectedRuleGroup]);

  // 创建悬浮预览内容
  const tooltipContent = material ? (
    <div className="max-w-[300px]">
      <MaterialPreview material={material} />
      <div className="mt-2 text-xs text-[var(--muted-foreground)] block">
        {material.name || name}
      </div>
      {material.path && (
        <div className="text-xs text-[var(--muted-foreground)] opacity-70 block break-all">
          {material.path}
        </div>
      )}
      {selectedRuleGroup && (
        <div className="mt-2 pt-2 border-t border-white/30">
          {isInRuleGroup ? (
            <>
              <div className="text-xs text-green-400 block font-semibold">
                ✓ 已添加到规则组: {selectedRuleGroup.title}
              </div>
              {rulesUsingMaterial.map((rule, index) => (
                <div key={index} className="text-xs text-gray-300 block ml-2">
                  • {rule.title || '未命名'}({rule.type})
                </div>
              ))}
            </>
          ) : (
            <div className="text-xs text-yellow-400 block">
              未添加到当前规则组
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    name
  );

  return (
    <div
      style={{
        position: 'fixed',
        left: tooltipPosition.x,
        top: tooltipPosition.y,
        zIndex: 50,
        pointerEvents: 'none',
        opacity: tooltipOpen ? 1 : 0,
        transition: 'opacity 0.15s',
      }}
    >
      {tooltipOpen && (
        <div
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            maxWidth: 320,
            padding: 6,
            borderRadius: 4,
            pointerEvents: 'auto',
          }}
        >
          {tooltipContent}
        </div>
      )}
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: isInAnyRuleGroup ? color : `${color}99`,
          color: 'white',
          borderRadius: 4,
          padding: 2,
          overflow: 'hidden',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          cursor: 'pointer',
          border: isSelected
            ? '2px solid #fff'
            : isHighlighted
              ? '3px solid #FFD700'
              : '2px solid transparent',
          boxShadow: isSelected
            ? '0 0 0 2px rgba(25, 118, 210, 0.5)'
            : isHighlighted
              ? '0 0 0 3px rgba(255, 215, 0, 0.3)'
              : 'none',
          transition: 'all 0.2s ease',
          opacity: isInAnyRuleGroup ? 1 : 0.7,
        }}
        className="hover:opacity-90"
      >
        <div className="text-xs text-white font-medium truncate">
          {name}
        </div>
      </div>
    </div>
  );
};

/**
 * Timeline编辑器组件
 */
export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  tracks,
  materials = [],
  materialDetails = {},
  duration,
  readOnly = true,
  rawDraft,
  rawMaterials,
  onChange,
  canvasWidth,
  canvasHeight,
  fps,
  draftPath,
  onRuleGroupsChange,
  initialRuleGroups,
  handleTestDataSelect,
  draftInfo,
}) => {
  const [data, setData] = useState<TimelineRow[]>([]);
  const [scaleWidth, setScaleWidth] = useState(160); // 默认刻度宽度
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null); // 选中的片段ID
  const [activeTab, setActiveTab] = useState(0); // 当前激活的Tab
  const [ruleGroups, setRuleGroups] = useState<RuleGroup[]>([]);
  const selectedRuleGroupIdRef = useRef<string | null>(null);
  const [savingRuleGroups, setSavingRuleGroups] = useState(false);
  const hasInitializedRuleGroups = useRef(false);
  const initialRuleGroupsSignatureRef = useRef<string | null>(null);
  const timelineRef = useRef<any>(null);
  const trackListRef = useRef<HTMLDivElement>(null); // 左侧轨道列表引用

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

  // 规则组相关状态
  const [selectedRuleGroup, setSelectedRuleGroup] = useState<RuleGroup | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [addToRuleGroupDialogOpen, setAddToRuleGroupDialogOpen] = useState(false);
  const [fullRequestPayload, setFullRequestPayload] = useState<RuleGroupTestRequest | null>(null); // 完整的API请求载荷
  const [hiddenTrackTypes, setHiddenTrackTypes] = useState<string[]>([]); // 隐藏的轨道类型

  // 短暂描边状态
  const [highlightedActionIds, setHighlightedActionIds] = useState<Set<string>>(new Set());

  // 异步任务相关状态
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [asyncDialogOpen, setAsyncDialogOpen] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    action: TimelineAction | null;
    row: TimelineRow | null;
  } | null>(null);

  useEffect(() => {
    selectedRuleGroupIdRef.current = selectedRuleGroup?.id ?? null;
  }, [selectedRuleGroup]);

  useEffect(() => {
    hasInitializedRuleGroups.current = false;
    initialRuleGroupsSignatureRef.current = null;
  }, [draftPath]);

  const applyRuleGroups = useCallback(
    (groups: RuleGroup[]) => {
      const normalized = cloneRuleGroups(groups);
      setRuleGroups(normalized);
      const desiredId = selectedRuleGroupIdRef.current;
      const nextSelected =
        (desiredId && normalized.find(group => group.id === desiredId)) || normalized[0] || null;
      selectedRuleGroupIdRef.current = nextSelected?.id ?? null;
      setSelectedRuleGroup(nextSelected);
      initialRuleGroupsSignatureRef.current = JSON.stringify(normalized);
      onRuleGroupsChange?.(cloneRuleGroups(normalized));
    },
    [onRuleGroupsChange],
  );

  const persistRuleGroups = useCallback(
    async (nextGroups: RuleGroup[]) => {
      const snapshot = cloneRuleGroups(ruleGroups);
      const normalizedNext = cloneRuleGroups(nextGroups);
      applyRuleGroups(normalizedNext);
      if (!draftPath) {
        return;
      }
      setSavingRuleGroups(true);
      try {
        await draftApi.setDraftRuleGroups(draftPath, normalizedNext);
      } catch (error) {
        console.error('保存草稿规则组失败:', error);
        applyRuleGroups(snapshot);
        const message = error instanceof Error ? error.message : String(error);
        alert(`保存规则组失败: ${message}`);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setSavingRuleGroups(false);
      }
    },
    [applyRuleGroups, draftPath, ruleGroups],
  );

  const handleRuleGroupRuleSave = useCallback(
    async (updatedRuleGroup: RuleGroup) => {
      const exists = ruleGroups.some(group => group.id === updatedRuleGroup.id);
      const nextGroups = exists
        ? ruleGroups.map(group => (group.id === updatedRuleGroup.id ? updatedRuleGroup : group))
        : [...ruleGroups, updatedRuleGroup];
      selectedRuleGroupIdRef.current = updatedRuleGroup.id;
      await persistRuleGroups(nextGroups);
    },
    [ruleGroups, persistRuleGroups],
  );

  // 处理规则点击事件，短暂描边相关片段
  const handleRuleClick = useCallback((rule: Rule) => {
    // 查找规则中所有素材ID对应的片段
    const newHighlightedActionIds = new Set<string>();

    console.log('[Timeline] handleRuleClick:', {
      rule: rule.title,
      materialIds: rule.material_ids,
      totalRows: data.length,
      rowsWithActions: data.filter(row => row.actions && row.actions.length > 0).length
    });

    rule.material_ids.forEach(materialId => {
      data.forEach(row => {
        // 检查 row.actions 是否存在且不为空
        if (row.actions && Array.isArray(row.actions) && row.actions.length > 0) {
          row.actions.forEach(action => {
            // 检查 action 的 material_id（在 data 中存储为 effectId）
            if ((action as any).data?.material_id === materialId || action.effectId === materialId) {
              newHighlightedActionIds.add(action.id);
              console.log('[Timeline] 找到匹配的 action:', {
                actionId: action.id,
                materialId,
                effectId: action.effectId,
                rowData: (action as any).data
              });
            }
          });
        } else {
          console.log('[Timeline] 跳过空轨道或无效轨道:', {
            rowId: row.id,
            actionsCount: row.actions?.length || 0,
            rowData: (row as any).data
          });
        }
      });
    });

    console.log('[Timeline] 最终高亮的 action IDs:', Array.from(newHighlightedActionIds));

    // 设置高亮状态
    setHighlightedActionIds(newHighlightedActionIds);

    // 3秒后自动清除高亮
    setTimeout(() => {
      setHighlightedActionIds(new Set());
    }, 3000);
  }, [data]);

  useEffect(() => {
    if (initialRuleGroups !== undefined && initialRuleGroups !== null) {
      const signature = JSON.stringify(initialRuleGroups);
      if (initialRuleGroupsSignatureRef.current === signature) {
        hasInitializedRuleGroups.current = true;
        return;
      }
      initialRuleGroupsSignatureRef.current = signature;
      hasInitializedRuleGroups.current = true;
      if (initialRuleGroups.length > 0) {
        applyRuleGroups(initialRuleGroups);
      }
      return;
    }

    if (hasInitializedRuleGroups.current) {
      return;
    }

    if (!draftPath) {
      hasInitializedRuleGroups.current = true;
      return;
    }

    let cancelled = false;
    const fetchRuleGroups = async () => {
      try {
        const response = await draftApi.getDraftRuleGroups(draftPath);
        if (cancelled) {
          return;
        }
        hasInitializedRuleGroups.current = true;
        initialRuleGroupsSignatureRef.current = null;
        const groups = response.rule_groups ?? [];
        if (groups.length > 0) {
          applyRuleGroups(groups);
        }
      } catch (error) {
        console.error('加载草稿规则组失败:', error);
        if (!cancelled) {
          hasInitializedRuleGroups.current = true;
          initialRuleGroupsSignatureRef.current = null;
        }
      }
    };

    fetchRuleGroups();

    return () => {
      cancelled = true;
    };
  }, [draftPath, initialRuleGroups, applyRuleGroups]);

  // 将轨道数据转换为Timeline格式，并过滤隐藏的轨道类型
  useEffect(() => {
    const rows = tracks
      .filter(track => !hiddenTrackTypes.includes(track.type))
      .map(trackToRow);
    setData(rows);
  }, [tracks, hiddenTrackTypes]);

  // 创建素材效果映射(用于显示素材名称等)
  const effects: Record<string, TimelineEffect> = materials.reduce((acc, material) => {
    acc[material.id] = {
      id: material.id,
      name: material.name || `素材 ${material.id.slice(0, 8)}`,
    };
    return acc;
  }, {} as Record<string, TimelineEffect>);

  // 处理鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      const delta = e.deltaY > 0 ? -20 : 20; // 滚轮向下缩小,向上放大
      setScaleWidth(prev => Math.max(10, Math.min(400, prev + delta))); // 限制在60-400px之间
    }
  };

  // 在整个编辑器容器上阻止 Ctrl+滚轮的默认行为
  useEffect(() => {
    const handleWheelCapture = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        wheelEvent.preventDefault();
      }
    };

    const container = document.querySelector('.timeline-editor-main-container');
    if (container) {
      container.addEventListener('wheel', handleWheelCapture, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheelCapture);
      };
    }
  }, []);

  // 处理右键菜单
  const handleContextMenu = (event: React.MouseEvent, action: TimelineAction, row: TimelineRow) => {
    event.preventDefault();
    event.stopPropagation(); // 阻止事件冒泡

    // 使用全局坐标,因为 anchorPosition 需要全局坐标
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      action,
      row,
    });
  };

  // 关闭右键菜单
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // 从右键菜单打开预览文件
  const handleOpenPreviewFile = () => {
    if (!contextMenu || !contextMenu.action) {
      handleCloseContextMenu();
      return;
    }

    const material = materials.find(m => m.id === contextMenu.action!.effectId);
    if (material && material.path) {
      // 检查是否在 Electron 环境
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.openFile) {
        (window as any).electron.fs.openFile(material.path).catch((err: Error) => {
          console.error('打开文件失败:', err);
          alert(`打开文件失败: ${err.message}`);
        });
      } else {
        alert('此功能仅在 Electron 环境下可用');
      }
    } else {
      alert('未找到素材文件路径');
    }
    handleCloseContextMenu();
  };

  // 从右键菜单添加到规则组
  const handleAddToRuleGroupFromContextMenu = () => {
    if (!contextMenu || !contextMenu.action) {
      handleCloseContextMenu();
      return;
    }

    const material = materials.find(m => m.id === contextMenu.action!.effectId);
    if (material) {
      setSelectedActionId(contextMenu.action.id);
      setAddToRuleGroupDialogOpen(true);
    }
    handleCloseContextMenu();
  };

  // 处理异步任务提交
  const handleAsyncSubmit = async (testData: TestData) => {
    if (!selectedRuleGroup) {
      const message = '请先选择规则组';
      setTestResult(message);
      throw new Error(message);
    }

    console.log('提交测试数据:', testData);
    console.log('当前规则组:', selectedRuleGroup);

    // 验证测试数据中的规则类型是否都存在于规则组中
    const missingRules: string[] = [];
    testData.items.forEach((item) => {
      const ruleExists = selectedRuleGroup.rules.some((rule) => rule.type === item.type);
      if (!ruleExists && !missingRules.includes(item.type)) {
        missingRules.push(item.type);
      }
    });

    if (missingRules.length > 0) {
      const message = `以下规则类型在当前规则组中不存在: ${missingRules.join(', ')}`;
      setTestResult(message);
      throw new Error(message);
    }

    // 预先构建素材样式映射
    const materialStyleMap = new Map<string, Record<string, any>>();
    tracks.forEach((track) => {
      track.segments.forEach((segment) => {
        if (!segment.material_id) return;
        const stylePayload: Record<string, any> = segment.style ? { ...segment.style } : {};
        if (segment.volume !== undefined && stylePayload.volume === undefined) {
          stylePayload.volume = segment.volume;
        }
        if (segment.speed !== undefined && stylePayload.speed === undefined) {
          stylePayload.speed = segment.speed;
        }
        if (Object.keys(stylePayload).length === 0) return;
        const existing = materialStyleMap.get(segment.material_id);
        const next = { ...(existing ?? {}) };
        if (!next[track.id]) {
          next[track.id] = stylePayload;
        }
        if (!next.__default__) {
          next.__default__ = stylePayload;
        }
        materialStyleMap.set(segment.material_id, next);
      });
    });

    // 收集测试所需的素材ID
    const requiredMaterialIds = new Set<string>();
    testData.items.forEach((item) => {
      const rule = selectedRuleGroup.rules.find((r) => r.type === item.type);
      if (rule) {
        rule.material_ids.forEach((id) => requiredMaterialIds.add(id));
      }
    });

    const missingMaterials: string[] = [];
    const segmentStylesPayload: SegmentStylesPayload = {};
    const resolvedMaterials = Array.from(requiredMaterialIds).reduce<MaterialInfo[]>((acc, id) => {
      const material = materials?.find((m) => m.id === id);
      if (material) {
        const styleMap = materialStyleMap.get(id);
        if (styleMap) {
          segmentStylesPayload[id] = styleMap;
        }
        acc.push(material);
      } else {
        missingMaterials.push(id);
      }
      return acc;
    }, []);

    if (missingMaterials.length > 0) {
      const message = `以下素材在当前草稿中未找到: ${missingMaterials.join(', ')}`;
      setTestResult(message);
      throw new Error(message);
    }

    const relevantRawSegments = (rawSegmentPayloads ?? []).filter((payload) => {
      const segmentMaterialId = payload.material_id ? String(payload.material_id) : undefined;
      if (segmentMaterialId && requiredMaterialIds.has(segmentMaterialId)) {
        return true;
      }
      const refs = Array.isArray(payload.segment?.extra_material_refs)
        ? payload.segment.extra_material_refs
          .filter((ref: any) => ref !== undefined && ref !== null)
          .map((ref: any) => String(ref))
        : [];
      return refs.some((refId) => requiredMaterialIds.has(refId));
    });
    const shouldUseRawSegments = relevantRawSegments.length > 0;
    const relevantRawMaterials = rawMaterialPayloads?.filter((material) =>
      requiredMaterialIds.has(String(material.id)),
    );

    try {
      setTestResult('异步任务提交中...');

      // 构建完整的请求载荷
      const requestPayload = {
        ruleGroup: selectedRuleGroup,
        materials: resolvedMaterials,
        testData,
        segment_styles: Object.keys(segmentStylesPayload).length > 0 ? segmentStylesPayload : undefined,
        raw_segments: shouldUseRawSegments ? relevantRawSegments : undefined,
        raw_materials:
          shouldUseRawSegments && relevantRawMaterials && relevantRawMaterials.length > 0
            ? relevantRawMaterials
            : undefined,
        draft_config: {
          canvas_config: {
            canvas_width: canvasWidth,
            canvas_height: canvasHeight,
          },
          config: {
            maintrack_adsorb: false,
          },
          fps: fps,
        },
      };

      // 保存完整载荷
      setFullRequestPayload(requestPayload);

      // 生成唯一的记录ID
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 提交异步任务
      const response = await tasksApi.submit(requestPayload);
      console.log('[Timeline] 异步任务已提交, task_id:', response.task_id);

      // 保存生成记录到后端
      try {
        await generationRecordsApi.create({
          record_id: recordId,
          task_id: response.task_id,
          rule_group_id: selectedRuleGroup.id,
          rule_group_title: selectedRuleGroup.title,
          rule_group: selectedRuleGroup,
          draft_config: requestPayload.draft_config,
          materials: materials || [],
          test_data: testData,
          segment_styles: requestPayload.segment_styles,
          raw_segments: requestPayload.raw_segments,
          raw_materials: requestPayload.raw_materials,
        });
        console.log('[Timeline] 生成记录已保存, record_id:', recordId);
      } catch (error) {
        console.error('[Timeline] 保存生成记录失败:', error);
        // 即使保存失败也不影响主流程
      }

      setCurrentTaskId(response.task_id);
      setAsyncDialogOpen(true);
      setTestResult(`✅ 异步任务已提交\n任务ID: ${response.task_id}\n记录ID: ${recordId}\n\n提示: 你可以在下载管理页面查看实时下载进度`);

      // 保存完整载荷供下载使用
      setFullRequestPayload(requestPayload);

      // 返回包含task_id、record_id和完整请求载荷的响应，供TestDataEditor显示进度和下载
      return {
        ...response,
        ...requestPayload,
        record_id: recordId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '异步任务提交失败';
      setTestResult(`异步任务提交失败: ${message}`);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  // 处理测试数据
  const handleTestData = async (testData: TestData) => {
    if (!selectedRuleGroup) {
      const message = '请先选择规则组';
      setTestResult(message);
      throw new Error(message);
    }

    console.log('测试数据:', testData);
    console.log('当前规则组:', selectedRuleGroup);

    // 验证测试数据中的规则类型是否都存在于规则组中
    const missingRules: string[] = [];
    testData.items.forEach((item) => {
      const ruleExists = selectedRuleGroup.rules.some((rule) => rule.type === item.type);
      if (!ruleExists && !missingRules.includes(item.type)) {
        missingRules.push(item.type);
      }
    });

    if (missingRules.length > 0) {
      const message = `以下规则类型在当前规则组中不存在: ${missingRules.join(', ')}`;
      setTestResult(message);
      throw new Error(message);
    }

    // 预先构建素材样式映射，按素材ID与轨道ID关联
    const materialStyleMap = new Map<string, Record<string, any>>();
    tracks.forEach((track) => {
      track.segments.forEach((segment) => {
        if (!segment.material_id) {
          return;
        }
        const stylePayload: Record<string, any> = segment.style ? { ...segment.style } : {};
        if (segment.volume !== undefined && stylePayload.volume === undefined) {
          stylePayload.volume = segment.volume;
        }
        if (segment.speed !== undefined && stylePayload.speed === undefined) {
          stylePayload.speed = segment.speed;
        }
        if (Object.keys(stylePayload).length === 0) {
          return;
        }
        const existing = materialStyleMap.get(segment.material_id);
        const next = { ...(existing ?? {}) };
        if (!next[track.id]) {
          next[track.id] = stylePayload;
        }
        if (!next.__default__) {
          next.__default__ = stylePayload;
        }
        materialStyleMap.set(segment.material_id, next);
      });
    });

    // 收集测试所需的素材ID
    const requiredMaterialIds = new Set<string>();
    testData.items.forEach((item) => {
      const rule = selectedRuleGroup.rules.find((r) => r.type === item.type);
      if (rule) {
        rule.material_ids.forEach((id) => requiredMaterialIds.add(id));
      }
    });

    const missingMaterials: string[] = [];
    const segmentStylesPayload: SegmentStylesPayload = {};
    const resolvedMaterials = Array.from(requiredMaterialIds).reduce<MaterialInfo[]>((acc, id) => {
      const material = materials?.find((m) => m.id === id);
      if (material) {
        const styleMap = materialStyleMap.get(id);
        if (styleMap) {
          segmentStylesPayload[id] = styleMap;
        }
        acc.push(material);
      } else {
        missingMaterials.push(id);
      }
      return acc;
    }, []);

    if (missingMaterials.length > 0) {
      const message = `以下素材在当前草稿中未找到: ${missingMaterials.join(', ')}`;
      setTestResult(message);
      throw new Error(message);
    }

    const relevantRawSegments = (rawSegmentPayloads ?? []).filter((payload) => {
      const segmentMaterialId = payload.material_id ? String(payload.material_id) : undefined;
      if (segmentMaterialId && requiredMaterialIds.has(segmentMaterialId)) {
        return true;
      }
      const refs = Array.isArray(payload.segment?.extra_material_refs)
        ? payload.segment.extra_material_refs
          .filter((ref: any) => ref !== undefined && ref !== null)
          .map((ref: any) => String(ref))
        : [];
      return refs.some((refId) => requiredMaterialIds.has(refId));
    });
    const shouldUseRawSegments = relevantRawSegments.length > 0;
    const relevantRawMaterials = rawMaterialPayloads?.filter((material) =>
      requiredMaterialIds.has(String(material.id)),
    );

    try {
      setTestResult('测试请求处理中...');

      // 构建完整的请求载荷
      const requestPayload = {
        ruleGroup: selectedRuleGroup,
        materials: resolvedMaterials,
        testData,
        segment_styles: Object.keys(segmentStylesPayload).length > 0 ? segmentStylesPayload : undefined,
        raw_segments: shouldUseRawSegments ? relevantRawSegments : undefined,
        raw_materials:
          shouldUseRawSegments && relevantRawMaterials && relevantRawMaterials.length > 0
            ? relevantRawMaterials
            : undefined,
        draft_config: {
          canvas_config: {
            canvas_width: canvasWidth,
            canvas_height: canvasHeight,
          },
          config: {
            maintrack_adsorb: false,
          },
          fps: fps,
        },
      };

      // 保存完整载荷供下载使用
      setFullRequestPayload(requestPayload);

      // 发送请求
      const response = await ruleTestApi.runTest(requestPayload);
      const status = response.status_code;
      const path = response.draft_path || '未知';
      const extra = response.message ? ` | ${response.message}` : '';
      setTestResult(`状态码: ${status} | 草稿目录: ${path}${extra}`);

      // 保存完整载荷供下载使用
      setFullRequestPayload(requestPayload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '测试失败';
      setTestResult(`测试失败: ${message}`);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-md">
      {/* 顶部按钮栏 */}
      <div className="flex justify-between items-center p-2 border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="flex gap-1">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={() => {
              const panel = document.querySelector('.timeline-left-panel') as HTMLElement | null;
              if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
              }
            }}
          >
            <Eye size={18} />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button isIconOnly variant="ghost" size="sm">
            <Download size={18} />
          </Button>
          <Button isIconOnly variant="ghost" size="sm">
            <Upload size={18} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={() => {
              const panel = document.querySelector('.timeline-right-panel') as HTMLElement | null;
              if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
              }
            }}
          >
            <Eye size={18} />
          </Button>
        </div>
      </div>

      <div
        className="timeline-editor-main-container flex flex-1 relative overflow-hidden"
      >
        {/* 左侧轨道列表 */}
        <div
          className="timeline-left-panel flex flex-col h-full border-r border-[var(--border)]"
          style={{ width: '80px' }}
        >
          {/* 顶部按钮栏 - 与时间标尺高度对齐 */}
          <div
            className="flex items-center px-3 gap-2 border-b border-[var(--border)] bg-[var(--muted)]"
            style={{ height: '42px' }}
          >
            <div className="text-xs font-semibold text-[var(--muted-foreground)]">
              轨道列表
            </div>
          </div>

          {/* 可滚动的轨道列表 */}
          <div
            ref={trackListRef}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (timelineRef.current?.setScrollTop) {
                timelineRef.current.setScrollTop(target.scrollTop);
              }
            }}
            className="flex-1 overflow-auto relative bg-[var(--background)]"
          >

            {data.map((row) => {
              const trackData = (row as any).data;
              const trackType = trackData?.type || 'video';
              const color = TRACK_COLORS[trackType] || '#666';

              const typeLabels: Record<string, string> = {
                video: '视频',
                audio: '音频',
                text: '文本',
                effect: '特效',
                filter: '滤镜',
                sticker: '贴纸',
              };

              return (
                <div
                  key={row.id}
                  className="flex items-center gap-1 px-3 py-1 border-b border-[var(--border)] hover:bg-[var(--muted)]"
                  style={{ height: '36px' }}
                >
                  <span
                    className="text-white font-medium text-[10px] px-2 rounded leading-5"
                    style={{ backgroundColor: color, height: '20px' }}
                  >
                    {typeLabels[trackType] || trackType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧时间轴 */}
        <div
          className="timeline-editor-container flex-1 h-full overflow-auto"
          onWheel={handleWheel}
        >
          <Timeline
            ref={timelineRef}
            editorData={data}
            effects={effects}
            onChange={(data) => {
              if (!readOnly && onChange) {
                // 这里可以将Timeline数据转回TrackInfo格式
                // 目前先设置为只读模式,避免复杂的双向转换
                console.log('Timeline changed:', data);
              }
            }}
            // Timeline配置
            scale={1}  // 时间刻度(每个刻度代表1秒)
            scaleWidth={scaleWidth}  // 动态时间刻度宽度(支持滚轮缩放)
            scaleSplitCount={10}  // 每个刻度细分10个单元
            startLeft={0}  // 左侧不留空间(已有独立轨道列表)
            rowHeight={36}  // 轨道高度(增加间距)
            autoScroll={true}  // 拖拽时自动滚动
            // 禁用拖动功能
            disableDrag={true}  // 禁止拖动片段
            dragLine={false}  // 禁用拖拽辅助线
            hideCursor={readOnly}  // 只读模式隐藏光标
            // 滚动同步
            onScroll={(params) => {
              if (trackListRef.current) {
                trackListRef.current.scrollTop = params.scrollTop;
              }
            }}
            // 自定义渲染器
            getActionRender={(action, row) => {
              const material = materials.find(m => m.id === action.effectId);
              return (
                <CustomAction
                  action={action}
                  row={row}
                  isSelected={selectedActionId === action.id}
                  isHighlighted={highlightedActionIds.has(action.id)}
                  onClick={() => {
                    setSelectedActionId(action.id);
                    setActiveTab(0); // 切换到素材信息 tab
                  }}
                  onContextMenu={handleContextMenu}
                  material={material}
                  selectedRuleGroup={selectedRuleGroup}
                />
              );
            }}
            getScaleRender={(scale) => (
              <div className="text-center text-xs text-gray-700 font-medium">
                {scale.toFixed(1)}s
              </div>
            )}
          />
        </div>

        {/* 右侧信息面板 */}
        <div
          className="timeline-right-panel flex flex-col h-full border-l border-[var(--border)] bg-[var(--card)]"
          style={{ width: '300px' }}
        >
          <div className="flex border-b border-[var(--border)]" style={{ minHeight: '42px' }}>
            <button
              onClick={() => setActiveTab(0)}
              className={`px-4 text-sm font-medium border-b-2 ${activeTab === 0 ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted-foreground)]'}`}
              style={{ minHeight: '42px' }}
            >
              素材信息
            </button>
            <button
              onClick={() => setActiveTab(1)}
              className={`px-4 text-sm font-medium border-b-2 ${activeTab === 1 ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted-foreground)]'}`}
              style={{ minHeight: '42px' }}
            >
              规则组
            </button>
          </div>

          <TabPanel value={activeTab} index={0}>
            {selectedActionId ? (
              <div className="flex flex-col gap-4">
                <div className="text-sm font-semibold">
                  素材详情
                </div>
                {(() => {
                  // 查找选中的片段
                  let selectedAction: TimelineAction | null = null;
                  let selectedRow: TimelineRow | null = null;
                  data.forEach(row => {
                    const action = row.actions.find(a => a.id === selectedActionId);
                    if (action) {
                      selectedAction = action;
                      selectedRow = row;
                    }
                  });

                  if (!selectedAction || !selectedRow) {
                    return <div className="text-sm">未找到片段信息</div>;
                  }

                  // 创建局部常量以避免类型推断问题
                  const action = selectedAction as TimelineAction;
                  const row = selectedRow as TimelineRow;

                  const actionData = (action as any).data;
                  const rowData = (row as any).data;

                  // 查找素材信息
                  const material = materials.find(m => m.id === action.effectId);

                  return (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <div>
                          <div className="text-xs text-[var(--muted-foreground)]">名称</div>
                          <div className="text-sm">{actionData?.name || '未命名'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--muted-foreground)]">轨道类型</div>
                          <div className="text-sm">{rowData?.type || '未知'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--muted-foreground)]">时间范围</div>
                          <div className="text-sm">
                            {action.start.toFixed(2)}s - {action.end.toFixed(2)}s
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--muted-foreground)]">持续时长</div>
                          <div className="text-sm">
                            {(action.end - action.start).toFixed(2)}s
                          </div>
                        </div>
                        {actionData?.speed && (
                          <div>
                            <div className="text-xs text-[var(--muted-foreground)]">播放速度</div>
                            <div className="text-sm">{actionData.speed}x</div>
                          </div>
                        )}
                        {actionData?.volume !== undefined && (
                          <div>
                            <div className="text-xs text-[var(--muted-foreground)]">音量</div>
                            <div className="text-sm">{Math.round(actionData.volume * 100)}%</div>
                          </div>
                        )}
                        {material && (
                          <>
                            <div>
                              <div className="text-xs text-[var(--muted-foreground)]">素材ID</div>
                              <div className="text-sm break-all" style={{ fontSize: '11px' }}>
                                {material.id}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-[var(--muted-foreground)]">素材类型</div>
                              <div className="text-sm">{material.type}</div>
                            </div>
                            {material.path && (
                              <div>
                                <div className="text-xs text-[var(--muted-foreground)]">文件路径</div>
                                <div className="text-sm break-all" style={{ fontSize: '11px' }}>
                                  {material.path}
                                </div>
                              </div>
                            )}
                            {material.width && material.height && (
                              <div>
                                <div className="text-xs text-[var(--muted-foreground)]">分辨率</div>
                                <div className="text-sm">
                                  {material.width} × {material.height}
                                </div>
                              </div>
                            )}
                            {material.duration_seconds && (
                              <div>
                                <div className="text-xs text-[var(--muted-foreground)]">素材时长</div>
                                <div className="text-sm">
                                  {material.duration_seconds.toFixed(2)}s
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* 规则组状态信息 */}
                      {material && selectedRuleGroup && (
                        <>
                          <div className="border-b border-[var(--border)]" />
                          <div>
                            <div className="text-sm font-semibold">
                              规则组状态
                            </div>
                            {(() => {
                              const rulesUsingMaterial = selectedRuleGroup.rules.filter(rule =>
                                rule.material_ids.includes(material.id)
                              );
                              const isInRuleGroup = rulesUsingMaterial.length > 0;

                              return (
                                <div className="flex flex-col gap-1">
                                  <div>
                                    <div className="text-xs text-[var(--muted-foreground)]">当前规则组</div>
                                    <div className="text-sm">{selectedRuleGroup.title}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-[var(--muted-foreground)]">状态</div>
                                    <div
                                      className="text-sm font-semibold"
                                      style={{ color: isInRuleGroup ? '#16a34a' : '#d97706' }}
                                    >
                                      {isInRuleGroup ? '✓ 已添加' : '未添加'}
                                    </div>
                                  </div>
                                  {isInRuleGroup && rulesUsingMaterial.length > 0 && (
                                    <div>
                                      <div className="text-xs text-[var(--muted-foreground)]">使用此素材的规则</div>
                                      {rulesUsingMaterial.map((rule, index) => (
                                        <div key={index} className="text-sm ml-2">
                                          • {rule.title}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      )}

                      {/* 素材预览 */}
                      {material && (
                        <>
                          <div className="border-b border-[var(--border)]" />
                          <div>
                            <div className="text-sm font-semibold">
                              素材预览
                            </div>
                            <MaterialPreview material={material} />
                          </div>
                        </>
                      )}

                      {/* 添加到规则组按钮 */}
                      {material && (
                        <>
                          <div className="border-b border-[var(--border)]" />
                          <Button
                            variant="outlined"
                            startContent={<Plus size={16} />}
                            onPress={() => setAddToRuleGroupDialogOpen(true)}
                            fullWidth
                          >
                            {selectedRuleGroup && selectedRuleGroup.rules.some(rule => rule.material_ids.includes(material.id))
                              ? '修改规则组配置'
                              : '添加到规则组'
                            }
                          </Button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-sm text-[var(--muted-foreground)]">
                  请点击时间轴上的片段查看详情
                </div>
              </div>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <div className="flex flex-col gap-4">
              {/* 规则组选择器 */}
              <RuleGroupSelector
                value={selectedRuleGroup}
                onChange={setSelectedRuleGroup}
                ruleGroups={ruleGroups}
                onRuleGroupsChange={(groups) => {
                  persistRuleGroups(groups).catch(() => {
                    /* 错误已在 persistRuleGroups 中处理 */
                  });
                }}
                onSaveToDraft={async (groups) => {
                  await persistRuleGroups(groups).then(() => {
                    setTestResult('规则组已保存到草稿目录');
                    setActiveTab(1);
                  }).catch(() => {
                    /* 错误已在 persistRuleGroups 中处理 */
                  });
                }}
                loading={savingRuleGroups}
              />

              <div className="border-b border-[var(--border)]" />

              {/* 提交按钮 */}
              <Button
                variant="outlined"
                startContent={<Upload size={16} />}
                onPress={() => {
                  const testDataId = selectedRuleGroup?.id ?? `test_data_${Date.now()}`;
                  handleTestDataSelect(
                    testDataId,
                    '异步测试数据',
                    handleAsyncSubmit,
                    {
                      ruleGroupId: selectedRuleGroup?.id,
                      ruleGroup: selectedRuleGroup,
                      materials: materials,
                      rawSegments: rawSegmentPayloads,
                      rawMaterials: rawMaterialPayloads,
                    }
                  );
                }}
                fullWidth
              >
                提交任务
              </Button>

              {/* 测试结果显示 */}
              {testResult && (
                <div
                  className="p-4 rounded-md text-sm"
                  style={{
                    backgroundColor: (testResult.includes('失败') || testResult.includes('不存在')) ? '#fef2f2' : '#f0fdf4',
                    color: (testResult.includes('失败') || testResult.includes('不存在')) ? '#991b1b' : '#166534',
                  }}
                >
                  <div className="whitespace-pre-wrap">
                    {testResult}
                  </div>
                </div>
              )}

              <div className="border-b border-[var(--border)]" />

              {/* 规则列表 */}
              <RuleGroupList
                ruleGroup={selectedRuleGroup}
                materials={Array.isArray(materials) ? materials : []}
                onSuccess={handleRuleGroupRuleSave}
                onRuleClick={handleRuleClick}
              />
            </div>
          </TabPanel>
        </div>

        {/* 右键菜单 */}
        {contextMenu !== null && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={handleCloseContextMenu}
              onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
            />
            <div
              className="fixed z-50 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg py-1"
              style={{ left: contextMenu.mouseX, top: contextMenu.mouseY, maxHeight: '300px' }}
            >
              <button
                onClick={handleAddToRuleGroupFromContextMenu}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)]"
              >
                <Plus size={16} />
                添加到规则组
              </button>
              <button
                onClick={handleOpenPreviewFile}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)]"
              >
                <Eye size={16} />
                打开预览文件
              </button>
            </div>
          </>
        )}
      </div>

      {/* 轨道类型切换按钮和草稿信息 */}
      <div className="flex justify-between items-center gap-4 flex-wrap p-2.5 border-t border-[var(--border)] bg-[var(--muted)]">
        {/* 左侧：轨道类型切换按钮 */}
        <div className="flex gap-1 flex-wrap">
          {Object.entries(TRACK_COLORS).map(([type, color]) => {
            const isHidden = hiddenTrackTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  setHiddenTrackTypes(prev =>
                    isHidden
                      ? prev.filter(t => t !== type)
                      : [...prev, type]
                  );
                }}
                className="text-white text-[11px] px-2 py-0.5 rounded hover:opacity-80"
                style={{ backgroundColor: isHidden ? '#999' : color }}
              >
                {type}
              </button>
            );
          })}
        </div>

        {/* 右侧：草稿信息 */}
        {draftInfo && (
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              时长: {draftInfo.duration_seconds.toFixed(2)}s
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              轨道: {draftInfo.track_count}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              分辨率: {draftInfo.width}×{draftInfo.height}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              FPS: {draftInfo.fps}
            </span>
          </div>
        )}
      </div>

      {/* 测试数据页面 */}
      {testDialogOpen && (
        <TestDataPage
          open={true}
          onClose={() => setTestDialogOpen(false)}
          onSave={handleTestData}
        />
      )}

      {/* 添加到规则组对话框 */}
      <AddToRuleGroupDialog
        open={addToRuleGroupDialogOpen}
        onClose={() => setAddToRuleGroupDialogOpen(false)}
        material={(() => {
          // 查找当前选中片段的素材
          if (!selectedActionId) return null;
          let selectedAction: TimelineAction | null = null;
          data.forEach(row => {
            const action = row.actions.find(a => a.id === selectedActionId);
            if (action) {
              selectedAction = action;
            }
          });
          if (!selectedAction) return null;
          return materials.find(m => m.id === selectedAction!.effectId) || null;
        })()}
        ruleGroup={selectedRuleGroup}
        editingRule={null}
        onSaveRuleGroup={handleRuleGroupRuleSave}
        onSuccess={(updatedRuleGroup) => {
          setSelectedRuleGroup(updatedRuleGroup);
          setTestResult(`规则添加成功！规则组 "${updatedRuleGroup.title}" 现在共有 ${updatedRuleGroup.rules.length} 条规则`);
          setActiveTab(1);
        }}
      />

      {/* 异步任务进度对话框 */}
      {asyncDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAsyncDialogOpen(false)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-md p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-4">异步任务进度</div>
            {currentTaskId && (
              <DownloadProgressBar
                taskId={currentTaskId}
                onComplete={(draftPath) => {
                  console.log('草稿生成完成:', draftPath);
                  setTestResult(`✅ 任务完成！草稿路径: ${draftPath}`);
                  setAsyncDialogOpen(false);
                }}
                onError={(error) => {
                  console.error('任务失败:', error);
                  setTestResult(`❌ 任务失败: ${error}`);
                }}
                showDetails
              />
            )}
            <div className="flex justify-end mt-4">
              <Button onPress={() => setAsyncDialogOpen(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineEditor;
