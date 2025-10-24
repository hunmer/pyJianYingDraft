'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timeline, TimelineEffect, TimelineRow, TimelineAction } from '@xzdarcy/react-timeline-editor';
import type { TrackInfo, SegmentInfo, MaterialInfo } from '@/types/draft';
import type { RuleGroup, TestData, SegmentStylesPayload, RawSegmentPayload, RawMaterialPayload, RuleGroupTestRequest } from '@/types/rule';
import { draftApi, ruleTestApi, tasksApi, type AllMaterialsResponse } from '@/lib/api';
import { Box, Paper, Typography, Chip, Tabs, Tab, Button, Divider, List, ListItem, ListItemText, Menu, MenuItem, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddBoxIcon from '@mui/icons-material/AddBox';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import IconButton from '@mui/material/IconButton';
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
      {value === index && <Box sx={{ p: 2, height: '100%' }}>{children}</Box>}
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
    onTest: (testData: any) => Promise<void> | void,
    context?: {
      ruleGroupId?: string;
      ruleGroup?: any;
      materials?: MaterialInfo[];
      rawSegments?: any[];
      rawMaterials?: any[];
      useRawSegmentsHint?: boolean;
      initialTestData?: TestData;
    }
  ) => void;
}
const cloneDeep = <T,>(value: T): T =>
  value === undefined ? (value as T) : JSON.parse(JSON.stringify(value));

const inferMaterialCategory = (material: Record<string, any>, trackType?: string): string => {
  const normalizedType = typeof material?.type === 'string' ? material.type.toLowerCase() : '';
  const trackMapping: Record<string, string> = {
    video: 'videos',
    audio: 'audios',
    text: 'texts',
    effect: 'effects',
    filter: 'filters',
    sticker: 'stickers',
  };
  if (trackType && trackMapping[trackType]) {
    return trackMapping[trackType];
  }
  if (normalizedType === 'speed') return 'speeds';
  if (normalizedType === 'canvas_color' || normalizedType === 'canvas_blur') return 'canvases';
  if (normalizedType === 'mask') return 'masks';
  if (normalizedType === 'material_animation') return 'material_animations';
  if (normalizedType === 'sound_channel_mapping') return 'sound_channel_mappings';
  if (normalizedType.includes('effect')) return 'effects';
  if (normalizedType.includes('filter')) return 'filters';
  if (normalizedType.includes('sticker')) return 'stickers';
  if (normalizedType.includes('text') || normalizedType === 'subtitle') return 'texts';
  if (normalizedType.includes('audio') || normalizedType === 'music' || normalizedType === 'sound') {
    return 'audios';
  }
  return trackMapping.video;
};

const buildSegmentJson = (segment: SegmentInfo, track: TrackInfo): Record<string, any> => {
  const base = segment.style ? cloneDeep(segment.style) : {};
  const targetRange =
    typeof base.target_timerange === 'object'
      ? { ...base.target_timerange }
      : {};
  targetRange.start = segment.target_timerange.start;
  targetRange.duration = segment.target_timerange.duration;
  base.target_timerange = targetRange;

  if (segment.source_timerange) {
    const sourceRange =
      typeof base.source_timerange === 'object'
        ? { ...base.source_timerange }
        : {};
    sourceRange.start = segment.source_timerange.start;
    sourceRange.duration = segment.source_timerange.duration;
    base.source_timerange = sourceRange;
  }

  base.id = segment.id;
  base.material_id = segment.material_id;

  if (segment.speed !== undefined) {
    base.speed = segment.speed;
  }
  if (segment.volume !== undefined) {
    base.volume = segment.volume;
  }
  if (segment.name && base.name === undefined) {
    base.name = segment.name;
  }
  if (base.track_render_index === undefined && typeof track.render_index === 'number') {
    base.track_render_index = track.render_index;
  }
  if (base.render_index === undefined && typeof track.render_index === 'number') {
    base.render_index = track.render_index;
  }

  return base;
};



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
}> = ({ action, row, isSelected = false, onClick, onContextMenu, material }) => {
  const trackType = (row as any).data?.type || 'video';
  const color = TRACK_COLORS[trackType] || '#666';
  const name = (action as any).data?.name || '未命名';
  const speed = (action as any).data?.speed;
  const volume = (action as any).data?.volume;

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event, action, row);
  };

  // 创建悬浮预览内容
  const tooltipContent = material ? (
    <Box sx={{ maxWidth: 300 }}>
      <MaterialPreview material={material} />
      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
        {material.name || name}
      </Typography>
      {material.path && (
        <Typography variant="caption" sx={{ color: 'grey.400', display: 'block', wordBreak: 'break-all' }}>
          {material.path}
        </Typography>
      )}
    </Box>
  ) : (
    name
  );

  return (
    <Tooltip
      title={tooltipContent}
      placement="top"
      arrow
      enterDelay={500}
      componentsProps={{
        tooltip: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            maxWidth: 320,
            p: 1.5,
          }
        }
      }}
    >
      <Box
        onClick={onClick}
        onContextMenu={handleContextMenu}
        sx={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          color: 'white',
          borderRadius: 1,
          padding: 0.5,
          overflow: 'hidden',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          cursor: 'pointer',
          border: isSelected ? '2px solid #fff' : '2px solid transparent',
          boxShadow: isSelected ? '0 0 0 2px rgba(25, 118, 210, 0.5)' : 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            opacity: 0.9,
            transform: 'scale(1.02)',
          },
        }}
      >
        <Typography variant="caption" noWrap sx={{ color: 'white', fontWeight: 500 }}>
          {name}
        </Typography>
      </Box>
    </Tooltip>
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

    console.log('异步提交测试数据:', testData);
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
        use_raw_segments: shouldUseRawSegments,
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

      // 提交异步任务
      const response = await tasksApi.submit(requestPayload);
      setCurrentTaskId(response.task_id);
      setAsyncDialogOpen(true);
      setTestResult(`✅ 异步任务已提交\n任务ID: ${response.task_id}\n\n提示: 你可以在下载管理页面查看实时下载进度`);

      // 返回完整的请求载荷供下载使用
      return requestPayload;
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
        use_raw_segments: shouldUseRawSegments,
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

      // 返回完整的请求载荷供下载使用
      return requestPayload;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '测试失败';
      setTestResult(`测试失败: ${message}`);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  return (
    <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
      {/* 顶部按钮栏 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'grey.100'
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => {
              const panel = document.querySelector('.timeline-left-panel') as HTMLElement | null;
              if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
              }
            }}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5
            }}
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5
            }}
          >
            <FileUploadIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              const panel = document.querySelector('.timeline-right-panel') as HTMLElement | null;
              if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
              }
            }}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box
        className="timeline-editor-main-container"
        sx={{
          display: 'flex',
          height: '500px',
          position: 'relative', // 添加相对定位,使菜单相对于此容器定位
        }}
      >
        {/* 左侧轨道列表 */}
        <Box
          className="timeline-left-panel"
          sx={{
            width: '80px',
            height: '100%',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 顶部按钮栏 - 与时间标尺高度对齐 */}
          <Box
            sx={{
              height: '42px', // 与时间标尺高度一致
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              gap: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              轨道列表
            </Typography>
          </Box>

          {/* 可滚动的轨道列表 */}
          <Box
            ref={trackListRef}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (timelineRef.current?.setScrollTop) {
                timelineRef.current.setScrollTop(target.scrollTop);
              }
            }}
            sx={{
              flex: 1,
              overflow: 'auto',
              backgroundColor: 'grey.50',
              position: 'relative',
            }}
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
                <Box
                  key={row.id}
                  sx={{
                    height: '36px',  // 与 Timeline rowHeight 一致
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.25,  // 上下内边距增加间距
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      backgroundColor: 'grey.100',
                    },
                  }}
                >
                  <Chip
                    label={typeLabels[trackType] || trackType}
                    size="small"
                    sx={{
                      backgroundColor: color,
                      color: 'white',
                      fontWeight: 500,
                      fontSize: '10px',
                      height: '20px',
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* 右侧时间轴 */}
        <Box
          className="timeline-editor-container"
          sx={{ flex: 1, height: '100%', overflow: 'auto' }}
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
                  onClick={() => {
                    setSelectedActionId(action.id);
                    setActiveTab(0); // 切换到素材信息 tab
                  }}
                  onContextMenu={handleContextMenu}
                  material={material}
                />
              );
            }}
            getScaleRender={(scale) => (
              <Box sx={{ textAlign: 'center', fontSize: '12px', color: '#333', fontWeight: 500 }}>
                {scale.toFixed(1)}s
              </Box>
            )}
          />
        </Box>

        {/* 右侧信息面板 */}
        <Box
          className="timeline-right-panel"
          sx={{
            width: '300px',
            height: '100%',
            borderLeft: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: '42px' }}
          >
            <Tab label="素材信息" sx={{ minHeight: '42px' }} />
            <Tab label="规则组" sx={{ minHeight: '42px' }} />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            {selectedActionId ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  素材详情
                </Typography>
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
                    return <Typography variant="body2">未找到片段信息</Typography>;
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
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">名称</Typography>
                          <Typography variant="body2">{actionData?.name || '未命名'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">轨道类型</Typography>
                          <Typography variant="body2">{rowData?.type || '未知'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">时间范围</Typography>
                          <Typography variant="body2">
                            {action.start.toFixed(2)}s - {action.end.toFixed(2)}s
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">持续时长</Typography>
                          <Typography variant="body2">
                            {(action.end - action.start).toFixed(2)}s
                          </Typography>
                        </Box>
                        {actionData?.speed && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">播放速度</Typography>
                            <Typography variant="body2">{actionData.speed}x</Typography>
                          </Box>
                        )}
                        {actionData?.volume !== undefined && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">音量</Typography>
                            <Typography variant="body2">{Math.round(actionData.volume * 100)}%</Typography>
                          </Box>
                        )}
                        {material && (
                          <>
                            <Box>
                              <Typography variant="caption" color="text.secondary">素材ID</Typography>
                              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '11px' }}>
                                {material.id}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">素材类型</Typography>
                              <Typography variant="body2">{material.type}</Typography>
                            </Box>
                            {material.path && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">文件路径</Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '11px' }}>
                                  {material.path}
                                </Typography>
                              </Box>
                            )}
                            {material.width && material.height && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">分辨率</Typography>
                                <Typography variant="body2">
                                  {material.width} × {material.height}
                                </Typography>
                              </Box>
                            )}
                            {material.duration_seconds && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">素材时长</Typography>
                                <Typography variant="body2">
                                  {material.duration_seconds.toFixed(2)}s
                                </Typography>
                              </Box>
                            )}
                          </>
                        )}
                      </Box>

                      {/* 素材预览 */}
                      {material && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              素材预览
                            </Typography>
                            <MaterialPreview material={material} />
                          </Box>
                        </>
                      )}

                      {/* 添加到规则组按钮 */}
                      {material && (
                        <>
                          <Divider />
                          <Button
                            variant="outlined"
                            startIcon={<AddBoxIcon />}
                            onClick={() => setAddToRuleGroupDialogOpen(true)}
                            fullWidth
                          >
                            添加到规则组
                          </Button>
                        </>
                      )}
                    </>
                  );
                })()}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  请点击时间轴上的片段查看详情
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

              <Divider />

              {/* 测试按钮 */}
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => {
                  const testDataId = `test_data_${Date.now()}`;
                  handleTestDataSelect(
                    testDataId,
                    '测试数据',
                    handleTestData,
                    {
                      ruleGroupId: selectedRuleGroup?.id,
                      ruleGroup: selectedRuleGroup,
                      materials: materials,
                      rawSegments: rawSegmentPayloads,
                      rawMaterials: rawMaterialPayloads,
                      useRawSegmentsHint: Boolean(rawSegmentPayloads && rawSegmentPayloads.length > 0),
                    }
                  );
                }}
                fullWidth
              >
                测试规则数据
              </Button>

              {/* 异步提交按钮 */}
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<CloudUploadIcon />}
                onClick={() => {
                  const testDataId = `test_data_${Date.now()}`;
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
                      useRawSegmentsHint: Boolean(rawSegmentPayloads && rawSegmentPayloads.length > 0),
                    }
                  );
                }}
                fullWidth
              >
                异步提交任务
              </Button>

              {/* 测试结果显示 */}
              {testResult && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: testResult.includes('失败') || testResult.includes('不存在') ? 'error.light' : 'success.light',
                    color: testResult.includes('失败') || testResult.includes('不存在') ? 'error.dark' : 'success.dark'
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {testResult}
                  </Typography>
                </Paper>
              )}

              <Divider />

              {/* 规则列表 */}
              <RuleGroupList
                ruleGroup={selectedRuleGroup}
                materials={Array.isArray(materials) ? materials : []}
                onSuccess={handleRuleGroupRuleSave}
              />
            </Box>
          </TabPanel>
        </Box>

        {/* 右键菜单 */}
        <Menu
          open={contextMenu !== null}
          onClose={handleCloseContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
          disableScrollLock={true}
          sx={{
            '& .MuiPaper-root': {
              maxHeight: '300px',
            }
          }}
        >
          <MenuItem onClick={handleAddToRuleGroupFromContextMenu}>
            <AddBoxIcon sx={{ mr: 1 }} fontSize="small" />
            添加到规则组
          </MenuItem>
          <MenuItem onClick={handleOpenPreviewFile}>
            <VisibilityIcon sx={{ mr: 1 }} fontSize="small" />
            打开预览文件
          </MenuItem>
        </Menu>
      </Box>

      {/* 轨道类型切换按钮 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        gap: 1,
        flexWrap: 'wrap',
        padding: '10px',
        maxWidth: 'calc(100% - 16px)'
      }}>
        {Object.entries(TRACK_COLORS).map(([type, color]) => {
          const isHidden = hiddenTrackTypes.includes(type);
          return (
            <Chip
              key={type}
              label={type}
              size="small"
              onClick={() => {
                setHiddenTrackTypes(prev =>
                  isHidden
                    ? prev.filter(t => t !== type)
                    : [...prev, type]
                );
              }}
              sx={{
                backgroundColor: isHidden ? '#999' : color,
                color: 'white',
                fontSize: '11px',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8
                }
              }}
            />
          );
        })}
      </Box>

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
      <Dialog
        open={asyncDialogOpen}
        onClose={() => setAsyncDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>异步任务进度</DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsyncDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TimelineEditor;
