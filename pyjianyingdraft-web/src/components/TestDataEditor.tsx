'use client';

import React, { useEffect, useMemo, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  ButtonGroup,
  Menu,
  MenuItem as MuiMenuItem,
  ListItemText,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MonacoEditor from '@/components/MonacoEditor';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import AddTrackIcon from '@mui/icons-material/AddRoad';
import HighlightIcon from '@mui/icons-material/Highlight';
import type { TestData, TestDataset, RuleGroup, RawSegmentPayload, RawMaterialPayload, RuleGroupTestRequest, SegmentStylesPayload } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';
import { EXAMPLE_TEST_DATA } from '@/config/defaultRules';
import { RuleGroupList } from './RuleGroupList';
import { DownloadProgressBar } from './DownloadProgressBar';
import { useSnapshots } from '@/hooks/useSnapshots';
import SnapshotManager from './SnapshotManager';
import PathReplacementDialog from './PathReplacementDialog';
import api from '@/lib/api';

// 测试回调的返回类型：可以是请求载荷，也可以是包含task_id的响应
type TestCallbackResult = RuleGroupTestRequest | { task_id: string; [key: string]: any } | void;

interface TestDataEditorProps {
  /** 测试数据ID */
  testDataId: string;
  /** 测试回调(可选) - 返回完整的请求载荷或包含task_id的响应。如果未提供，将使用内部默认实现 */
  onTest?: (testData: TestData) => Promise<TestCallbackResult> | TestCallbackResult;
  /** 当前规则组ID(用于关联数据集) */
  ruleGroupId?: string;
  /** 当前规则组(用于转换数据和内部测试) */
  ruleGroup?: RuleGroup | null;
  /** 素材列表(用于提取素材属性和内部测试) */
  materials?: MaterialInfo[];
  /** 可用的原始片段载荷(用于调试展示和内部测试) */
  rawSegments?: RawSegmentPayload[] | undefined;
  /** 可用的原始素材载荷(用于调试展示和内部测试) */
  rawMaterials?: RawMaterialPayload[] | undefined;
  /** 预设测试数据 */
  initialTestData?: TestData | null;
  /** 数据变化回调 */
  onDataChange?: (testData: TestData) => void;
  /** 草稿配置(用于内部测试，包含canvas尺寸和fps) */
  draftConfig?: {
    canvasWidth?: number;
    canvasHeight?: number;
    fps?: number;
  };
}

/** 暴露给父组件的方法 */
export interface TestDataEditorRef {
  /** 设置测试数据 */
  setTestData: (data: TestData) => void;
  /** 执行测试 */
  runTest: () => Promise<void>;
}

/**
 * 测试数据编辑器 - 完整页面组件
 * 功能与 TestDataDialog 保持一致
 */
const TestDataEditor = forwardRef<TestDataEditorRef, TestDataEditorProps>(({
  testDataId,
  onTest,
  ruleGroupId,
  ruleGroup,
  materials = [],
  rawSegments: _rawSegments,
  rawMaterials: _rawMaterials,
  initialTestData = null,
  onDataChange,
  draftConfig,
}, ref) => {
  const initialJson = useMemo(
    () => JSON.stringify(initialTestData ?? EXAMPLE_TEST_DATA, null, 2),
    [initialTestData],
  );
  const [testDataJson, setTestDataJson] = useState(() => {
    // 尝试从localStorage恢复上次的测试数据
    const stored = localStorage.getItem(`test-data-json-${testDataId}`);
    return stored || initialJson;
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testing, setTesting] = useState(false);
  const [fullRequestPayload, setFullRequestPayload] = useState<RuleGroupTestRequest | null>(null);
  const [editorKey, setEditorKey] = useState(0); // 用于强制重新渲染编辑器

  // 异步任务进度相关状态
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [showProgressInline, setShowProgressInline] = useState(false);

  // 下载菜单状态
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  const downloadMenuOpen = Boolean(downloadMenuAnchor);

  // 下载确认对话框状态
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [pendingDownloadData, setPendingDownloadData] = useState<{
    data: any;
    filename: string;
    type: 'base' | 'full';
  } | null>(null);

  // 高亮显示的规则类型
  const [highlightedTypes, setHighlightedTypes] = useState<Set<string>>(new Set());

  // 路径替换对话框状态
  const [pathReplacementDialogOpen, setPathReplacementDialogOpen] = useState(false);

  // 快照管理
  const {
    snapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    renameSnapshot,
  } = useSnapshots({
    storageKey: `test-data-${testDataId}`,
    maxSnapshots: 20,
    autoSaveCurrent: false, // 手动控制保存
  });

  // 当testDataId变化时,强制重新加载对应的测试数据
  useEffect(() => {
    const stored = localStorage.getItem(`test-data-json-${testDataId}`);
    // 如果有本地存储则使用本地存储,否则使用初始数据
    const newContent = stored || initialJson;
    setTestDataJson(newContent);
    // 强制重新渲染编辑器以确保内容更新
    setEditorKey(prev => prev + 1);
    console.log('[TestDataEditor] 加载测试数据:', { testDataId, hasStored: !!stored, contentLength: newContent.length });
  }, [testDataId, initialJson]);

  // 使用 ref 来跟踪上一次的 initialTestData，避免重复同步
  const prevInitialTestDataRef = React.useRef<string | null>(null);

  // 监听外部数据变化（用于发送测试功能）
  useEffect(() => {
    console.log('[TestDataEditor] 监听外部数据变化:', {
      testDataId,
      hasInitialTestData: !!initialTestData,
      initialTestData,
      currentTestDataJsonLength: testDataJson.length
    });

    if (initialTestData) {
      const newJson = JSON.stringify(initialTestData, null, 2);
      const prevJson = prevInitialTestDataRef.current;

      console.log('[TestDataEditor] 准备更新JSON数据:', {
        testDataId,
        newJsonLength: newJson.length,
        newJsonPreview: newJson.substring(0, 200) + (newJson.length > 200 ? '...' : ''),
        isNewData: prevJson !== newJson
      });

      // 只有当 initialTestData 真正变化时才更新（不依赖 testDataJson）
      if (prevJson !== newJson) {
        setTestDataJson(newJson);
        setEditorKey(prev => prev + 1); // 强制重新渲染编辑器
        prevInitialTestDataRef.current = newJson; // 记录当前值

        console.log('[TestDataEditor] 外部数据已更新:', {
          testDataId,
          dataLength: newJson.length,
          tracksCount: initialTestData.tracks?.length || 0,
          itemsCount: initialTestData.items?.length || 0
        });

        // 自动触发测试（延迟执行以确保数据已更新）
        setTimeout(() => {
          console.log('[TestDataEditor] 准备自动运行测试...');
          const testButton = document.querySelector('[data-testid="test-run-button"]') as HTMLButtonElement;
          if (testButton && !testButton.disabled) {
            console.log('[TestDataEditor] 自动点击测试按钮');
            testButton.click();
          } else {
            console.warn('[TestDataEditor] 测试按钮不可用或不存在', { testButton, disabled: testButton?.disabled });
          }
        }, 500);
      } else {
        console.log('[TestDataEditor] initialTestData 未变化，跳过更新');
      }
    }
  }, [initialTestData, testDataId]); // 移除 testDataJson 依赖

  // 保存测试数据到localStorage
  useEffect(() => {
    if (testDataJson) {
      localStorage.setItem(`test-data-json-${testDataId}`, testDataJson);

      // 通知数据变化
      if (onDataChange) {
        try {
          const testData: TestData = JSON.parse(testDataJson);
          onDataChange(testData);
        } catch (err) {
          console.warn('[TestDataEditor] JSON解析失败，无法通知数据变化:', err);
        }
      }
    }
  }, [testDataJson, testDataId, onDataChange]);
  // 数据集管理状态
  const [datasets, setDatasets] = useState<TestDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');

  // 从localStorage加载数据集 - 使用testDataId作为存储键
  const loadDatasets = useCallback(() => {
    try {
      const stored = localStorage.getItem(`test-datasets-${testDataId}`);
      if (stored) {
        const loadedDatasets = JSON.parse(stored) as TestDataset[];
        setDatasets(loadedDatasets);
      } else {
        // 如果没有存储的数据集,清空当前列表
        setDatasets([]);
      }
      // 重置选中的数据集
      setSelectedDatasetId('');
    } catch (err) {
      console.error('加载数据集失败:', err);
    }
  }, [testDataId]);

  // 加载数据集列表 - 当testDataId变化时重新加载
  useEffect(() => {
    if (testDataId) {
      loadDatasets();
    }
  }, [testDataId, loadDatasets]);



  // 保存数据集到localStorage - 使用testDataId作为存储键
  const saveDatasets = (updatedDatasets: TestDataset[]) => {
    try {
      localStorage.setItem(`test-datasets-${testDataId}`, JSON.stringify(updatedDatasets));
      setDatasets(updatedDatasets);
    } catch (err) {
      console.error('保存数据集失败:', err);
      setError('保存数据集失败');
    }
  };

  // 格式化JSON
  const handleFormatJson = () => {
    try {
      const testData: TestData = JSON.parse(testDataJson);
      const formattedJson = JSON.stringify(testData, null, 2);
      setTestDataJson(formattedJson);
      setSuccess('JSON格式化成功');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`JSON格式错误: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 一键添加轨道
  const handleAddTracks = () => {
    if (!ruleGroup || !ruleGroup.rules.length) {
      setError('没有可用的预设规则');
      return;
    }

    try {
      const testData: TestData = JSON.parse(testDataJson);

      // 根据规则组中的规则类型创建轨道
      const newTracks = ruleGroup.rules.map((rule) => {
        // 获取规则的第一个material_id
        const firstMaterialId = rule.material_ids && rule.material_ids.length > 0
          ? rule.material_ids[0]
          : null;

        let trackType = rule.type; // 默认使用规则类型

        // 如果有material_id，尝试从materials中找到对应素材并获取其type
        if (firstMaterialId && materials && materials.length > 0) {
          const material = materials.find(m => m.id === firstMaterialId);
          if (material) {
            // 根据素材类型映射到轨道类型
            switch (material.type) {
              case 'video':
              case 'image':
              case 'photo':
                trackType = 'video';
                break;
              case 'audio':
              case 'extract_music':
                trackType = 'audio';
                break;
              case 'text':
              case 'subtitle':
                trackType = 'text';
                break;
              case 'sticker':
                trackType = 'sticker';
                break;
              case 'effect':
                trackType = 'effect';
                break;
              case 'filter':
                trackType = 'filter';
                break;
              case 'transition':
                trackType = 'effect'; // 转场效果通常放在特效轨道
                break;
              default:
                // 如果无法识别类型，保持原来的rule.type
                break;
            }
          }
        }

        return {
          id: rule.type, // 使用type作为id
          title: rule.title, // 使用规则标题
          type: trackType, // 使用映射后的轨道类型
        };
      });

      // 更新testData的tracks字段
      const updatedTestData = {
        ...testData,
        tracks: newTracks,
      };

      const formattedJson = JSON.stringify(updatedTestData, null, 2);
      setTestDataJson(formattedJson);
      setSuccess(`已添加 ${newTracks.length} 个轨道`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`添加轨道失败: ${err.message}`);
    }
  };

  // 检测items中的type并更新高亮状态
  const updateHighlightTypes = useCallback(() => {
    if (!ruleGroup) {
      setHighlightedTypes(new Set());
      return;
    }

    try {
      const testData: TestData = JSON.parse(testDataJson);
      const itemTypes = new Set<string>();

      // 收集items中的所有type
      if (testData.items && Array.isArray(testData.items)) {
        testData.items.forEach((item) => {
          if (item.type) {
            itemTypes.add(item.type);
          }
        });
      }

      setHighlightedTypes(itemTypes);
    } catch (err) {
      // JSON解析失败时清空高亮
      setHighlightedTypes(new Set());
    }
  }, [testDataJson, ruleGroup]);

  // 当编辑器内容或规则组变化时更新高亮
  useEffect(() => {
    updateHighlightTypes();
  }, [testDataJson, ruleGroup, updateHighlightTypes]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    setTestData: (data: TestData) => {
      console.log('[TestDataEditor] setTestData 被调用:', data);
      const jsonString = JSON.stringify(data, null, 2);
      setTestDataJson(jsonString);
      // 强制重新渲染编辑器
      setEditorKey(prev => prev + 1);
      console.log('[TestDataEditor] 测试数据已设置');
    },
    runTest: async () => {
      console.log('[TestDataEditor] runTest 被调用');
      await handleTest();
    }
  }), [testDataJson]);

  // 内部默认测试实现（当未提供 onTest 回调时使用）
  const defaultTestHandler = useCallback(async (testData: TestData) => {
    if (!ruleGroup) {
      throw new Error('未提供规则组信息，无法执行测试');
    }

    // 验证规则类型
    const missingRules: string[] = [];
    testData.items.forEach((item) => {
      const ruleExists = ruleGroup.rules.some((rule) => rule.type === item.type);
      if (!ruleExists && !missingRules.includes(item.type)) {
        missingRules.push(item.type);
      }
    });

    if (missingRules.length > 0) {
      throw new Error(`以下规则类型在当前规则组中不存在: ${missingRules.join(', ')}`);
    }

    // 收集所需素材
    const requiredMaterialIds = new Set<string>();
    testData.items.forEach((item) => {
      const rule = ruleGroup.rules.find((r) => r.type === item.type);
      if (rule) {
        rule.material_ids.forEach((id) => requiredMaterialIds.add(id));
      }
    });

    const missingMaterials: string[] = [];
    const resolvedMaterials = Array.from(requiredMaterialIds).reduce<MaterialInfo[]>((acc, id) => {
      const material = materials?.find((m) => m.id === id);
      if (material) {
        acc.push(material);
      } else {
        missingMaterials.push(id);
      }
      return acc;
    }, []);

    if (missingMaterials.length > 0) {
      throw new Error(`以下素材在当前草稿中未找到: ${missingMaterials.join(', ')}`);
    }

    // 过滤相关的原始片段和素材
    const relevantRawSegments = (_rawSegments ?? []).filter((payload) => {
      const segmentMaterialId = payload.material_id ? String(payload.material_id) : undefined;
      return segmentMaterialId && requiredMaterialIds.has(segmentMaterialId);
    });
    const shouldUseRawSegments = relevantRawSegments.length > 0;
    const relevantRawMaterials = _rawMaterials?.filter((material) =>
      requiredMaterialIds.has(String(material.id)),
    );

    // 构建请求载荷
    const requestPayload: RuleGroupTestRequest = {
      ruleGroup: ruleGroup,
      materials: resolvedMaterials,
      testData,
      raw_segments: shouldUseRawSegments ? relevantRawSegments : undefined,
      raw_materials:
        shouldUseRawSegments && relevantRawMaterials && relevantRawMaterials.length > 0
          ? relevantRawMaterials
          : undefined,
      draft_config: {
        canvas_config: {
          canvas_width: draftConfig?.canvasWidth ?? 1920,
          canvas_height: draftConfig?.canvasHeight ?? 1080,
        },
        config: {
          maintrack_adsorb: false,
        },
        fps: draftConfig?.fps ?? 30,
      },
    };

    // 提交异步任务
    const response = await api.tasks.submit(requestPayload);
    console.log('[TestDataEditor] 异步任务已提交, task_id:', response.task_id);

    // 保存生成记录
    try {
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await api.generationRecords.create({
        record_id: recordId,
        task_id: response.task_id,
        rule_group_id: ruleGroup.id,
        rule_group_title: ruleGroup.title,
        rule_group: ruleGroup,
        draft_config: requestPayload.draft_config,
        materials: materials || [],
        test_data: testData,
        segment_styles: requestPayload.segment_styles,
        raw_segments: requestPayload.raw_segments,
        raw_materials: requestPayload.raw_materials,
      });
      console.log('[TestDataEditor] 生成记录已保存, record_id:', recordId);
    } catch (error) {
      console.error('[TestDataEditor] 保存生成记录失败:', error);
    }

    // 返回响应和请求载荷
    return {
      ...response,
      ...requestPayload,
    };
  }, [ruleGroup, materials, _rawSegments, _rawMaterials, draftConfig]);

  // 处理测试
  const handleTest = async () => {
    setError('');
    setSuccess('');

    try {
      const testData: TestData = JSON.parse(testDataJson);

      // 基本验证
      if (!testData.tracks || !Array.isArray(testData.tracks)) {
        throw new Error('测试数据必须包含 tracks 数组');
      }

      if (!testData.items || !Array.isArray(testData.items)) {
        throw new Error('测试数据必须包含 items 数组');
      }

      // 验证轨道
      testData.tracks.forEach((track, index) => {
        if (!track.id || !track.type) {
          throw new Error(`轨道 ${index} 缺少必要字段 (id 或 type)`);
        }
      });

      // 验证素材项
      testData.items.forEach((item, index) => {
        if (!item.type) {
          throw new Error(`素材项 ${index} 缺少 type 字段`);
        }
        if (!item.data || typeof item.data !== 'object') {
          item.data = {track: item.type}
        }
        if(!item.data.track){
          item.data.track = item.type
        }
      });

      setTesting(true);

      // 使用提供的 onTest 回调或默认实现
      const testHandler = onTest || defaultTestHandler;
      const result = await testHandler(testData);

      // 检查返回结果类型
      if (result && typeof result === 'object') {
        // 检查是否是异步任务提交的响应（包含task_id）
        if ('task_id' in result && typeof result.task_id === 'string') {
          const taskId = result.task_id;
          console.log('[TestDataEditor] 异步任务已提交, task_id:', taskId);
          setCurrentTaskId(taskId);
          setShowProgressInline(true);
          setSuccess(`✅ 异步任务已提交\n任务ID: ${taskId}`);
        }
        // 检查是否是完整的请求载荷
        if ('testData' in result) {
          setFullRequestPayload(result as RuleGroupTestRequest);
          setSuccess('测试请求已发送');
        } else {
          setSuccess('测试请求已发送');
        }
      } else {
        setSuccess('测试请求已发送');
      }
    } catch (err: any) {
      setError(err.message || '无效的JSON格式');
    } finally {
      setTesting(false);
    }
  };

  // 重置为示例数据
  const handleReset = () => {
    const resetJson = JSON.stringify(initialTestData ?? EXAMPLE_TEST_DATA, null, 2);
    setTestDataJson(resetJson);
    setSelectedDatasetId('');
    setError('');
    setSuccess('');
    setTesting(false);
    // 清除localStorage中的数据
    localStorage.removeItem(`test-data-json-${testDataId}`);
  };

  // 加载选中的数据集
  const handleLoadDataset = (datasetId: string) => {
    if (!datasetId) {
      // 恢复到初始数据
      setTestDataJson(initialJson);
      setSelectedDatasetId('');
      setError('');
      setSuccess('');
      return;
    }

    const dataset = datasets.find(d => d.id === datasetId);
    if (dataset) {
      setTestDataJson(JSON.stringify(dataset.data, null, 2));
      setSelectedDatasetId(datasetId);
      setSuccess(`已加载数据集: ${dataset.name}`);
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // 打开保存对话框
  const handleOpenSaveDialog = () => {
    setSaveDialogOpen(true);
    setDatasetName('');
    setDatasetDescription('');
  };

  // 保存当前数据集
  const handleSaveDataset = () => {
    setError('');

    if (!datasetName.trim()) {
      setError('请输入数据集名称');
      return;
    }

    try {
      const testData: TestData = JSON.parse(testDataJson);
      const now = new Date().toISOString();

      // 检查是否更新现有数据集
      const existingIndex = datasets.findIndex(d => d.name === datasetName.trim());

      let updatedDatasets: TestDataset[];
      if (existingIndex >= 0) {
        // 更新现有数据集
        updatedDatasets = [...datasets];
        updatedDatasets[existingIndex] = {
          ...updatedDatasets[existingIndex],
          data: testData,
          description: datasetDescription,
          updatedAt: now,
        };
        setSuccess(`数据集"${datasetName}"已更新`);
      } else {
        // 创建新数据集
        const newDataset: TestDataset = {
          id: `dataset-${Date.now()}`,
          name: datasetName.trim(),
          ruleGroupId: ruleGroupId || testDataId, // 使用ruleGroupId或testDataId作为关联
          data: testData,
          description: datasetDescription,
          createdAt: now,
          updatedAt: now,
        };
        updatedDatasets = [...datasets, newDataset];
        setSuccess(`数据集"${datasetName}"已保存`);
      }

      saveDatasets(updatedDatasets);
      setSaveDialogOpen(false);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || '保存失败: JSON格式无效');
    }
  };

  // 删除数据集
  const handleDeleteDataset = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (dataset && confirm(`确定要删除数据集"${dataset.name}"吗?`)) {
      const updatedDatasets = datasets.filter(d => d.id !== datasetId);
      saveDatasets(updatedDatasets);
      if (selectedDatasetId === datasetId) {
        setSelectedDatasetId('');
      }
      setSuccess('数据集已删除');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // 通用下载函数
  const downloadJSON = (data: any, filename: string, compress: boolean) => {
    let fileContent: string;

    if (compress) {
      // 压缩并转义:先序列化为JSON字符串,再转义为可嵌入的字符串(转义反斜杠和双引号)
      const jsonString = JSON.stringify(data);
      // 转义反斜杠和双引号,使其可以安全嵌入到另一个JSON字符串中
      fileContent = jsonString.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    } else {
      // 普通格式:紧凑的JSON,无换行
      fileContent = JSON.stringify(data);
    }

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  // 构建请求载荷(提取公共逻辑)
  const buildRequestPayload = (includeItems: boolean): any => {
    if (!fullRequestPayload) return null;
    const payload: any = {
      draft_config: fullRequestPayload.draft_config,
      ruleGroup: fullRequestPayload.ruleGroup,
      materials: fullRequestPayload.materials,
      testData: includeItems
        ? fullRequestPayload.testData
        : { ...fullRequestPayload.testData, items: [] },
    };

    // 添加可选字段(如果存在)
    if (fullRequestPayload.segment_styles) {
      payload.segment_styles = fullRequestPayload.segment_styles;
    }
    if (fullRequestPayload.raw_segments) {
      payload.raw_segments = fullRequestPayload.raw_segments;
    }
    if (fullRequestPayload.raw_materials) {
      payload.raw_materials = fullRequestPayload.raw_materials;
    }

    return payload;
  };

  // 打开下载确认对话框
  const openDownloadDialog = (type: 'base' | 'full') => {
    if (!fullRequestPayload) {
      setError('没有可下载的请求数据');
      return;
    }

    const includeItems = type === 'full';
    const data = buildRequestPayload(includeItems);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}-request-${timestamp}.txt`; // 使用txt后缀保存

    setPendingDownloadData({ data, filename, type });
    setDownloadDialogOpen(true);
    setDownloadMenuAnchor(null);
  };

  // 确认下载
  const handleConfirmDownload = (compress: boolean) => {
    if (!pendingDownloadData) return;

    downloadJSON(pendingDownloadData.data, pendingDownloadData.filename, compress);

    const typeText = pendingDownloadData.type === 'base' ? '基础' : '完整';
    const compressText = compress ? '(压缩并转义)' : '';
    setSuccess(`${typeText}请求数据已下载${compressText}`);
    setTimeout(() => setSuccess(''), 2000);

    setDownloadDialogOpen(false);
    setPendingDownloadData(null);
  };

  // 下载基础请求数据(items为空) - 打开路径替换对话框
  const handleDownloadBaseRequestData = () => {
    if (!fullRequestPayload) {
      setError('没有可下载的请求数据');
      return;
    }
    // 打开路径替换对话框
    setPathReplacementDialogOpen(true);
    setDownloadMenuAnchor(null);
  };

  // 处理路径替换确认
  const handlePathReplacementConfirm = (replacements: Record<string, string>) => {
    setPathReplacementDialogOpen(false);

    if (!fullRequestPayload) {
      setError('没有可下载的请求数据');
      return;
    }

    // 构建基础请求数据
    const data = buildRequestPayload(false); // items 为空

    // 应用路径替换
    if (data.materials && Array.isArray(data.materials)) {
      data.materials = data.materials.map((material: any) => {
        const materialCopy = { ...material };

        // 替换 material.path
        if (materialCopy.path && replacements[materialCopy.path]) {
          const newPath = replacements[materialCopy.path].trim();
          if (newPath) {
            materialCopy.path = newPath;
          }
        }

        // 替换 material.content.path
        if (materialCopy.content?.path && replacements[materialCopy.content.path]) {
          const newPath = replacements[materialCopy.content.path].trim();
          if (newPath) {
            materialCopy.content = {
              ...materialCopy.content,
              path: newPath,
            };
          }
        }

        return materialCopy;
      });
    }

    // 打开下载确认对话框
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `base-request-${timestamp}.txt`;

    setPendingDownloadData({ data, filename, type: 'base' });
    setDownloadDialogOpen(true);
  };

  // 下载完整请求数据
  const handleDownloadFullRequestData = () => {
    openDownloadDialog('full');
  };

  // 创建快照
  const handleCreateSnapshot = (name: string, description?: string) => {
    try {
      const testData: TestData = JSON.parse(testDataJson);
      createSnapshot(name, testData, description);
      setSuccess(`快照"${name}"已创建`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`创建快照失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 恢复快照
  const handleRestoreSnapshot = (snapshotId: string) => {
    try {
      const data = restoreSnapshot(snapshotId);
      const jsonString = JSON.stringify(data, null, 2);
      setTestDataJson(jsonString);
      setEditorKey(prev => prev + 1); // 强制重新渲染编辑器

      const snapshot = snapshots.find(s => s.id === snapshotId);
      setSuccess(`已恢复到快照: ${snapshot?.name}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`恢复快照失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 顶部标题栏 */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button size="small" onClick={handleReset} variant="outlined" startIcon={<RestartAltIcon />}>
              重置为示例数据
            </Button>
            <Typography variant="caption" color="text.secondary">
              实例ID: {testDataId}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SnapshotManager
              snapshots={snapshots}
              onCreateSnapshot={handleCreateSnapshot}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeleteSnapshot={deleteSnapshot}
              onRenameSnapshot={renameSnapshot}
            />
          </Box>
        </Box>
      </Paper>

      {/* 主内容区域 */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧规则组列表 */}
        <Box
          sx={{
            width: '280px',
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'auto',
            backgroundColor: 'grey.50',
            p: 2,
          }}
        >
          <RuleGroupList
            ruleGroup={ruleGroup ?? null}
            showTitle={true}
            materials={materials}
            highlightedTypes={highlightedTypes}
          />
        </Box>

        {/* 右侧编辑器区域 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 数据集选择器 */}
          {datasets.length > 0 && (
            <Box sx={{ p: 2, pb: 0, display: 'flex', gap: 1, alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
              <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
                <InputLabel>选择数据集</InputLabel>
                <Select
                  value={selectedDatasetId}
                  onChange={(e) => handleLoadDataset(e.target.value)}
                  label="选择数据集"
                >
                  <MenuItem value="">
                    <em>无</em>
                  </MenuItem>
                  {datasets.map((dataset) => (
                    <MenuItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                      {dataset.description && (
                        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                          - {dataset.description}
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedDatasetId && (
                <Tooltip title="删除当前数据集">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteDataset(selectedDatasetId)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}

          {/* 消息提示 */}
          <Box sx={{ p: 2, pb: datasets.length > 0 ? 2 : 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" onClose={() => setSuccess('')}>
                {success}
              </Alert>
            )}

            {/* 异步任务下载进度 */}
            {showProgressInline && currentTaskId && (
              <Box>
                <DownloadProgressBar
                  taskId={currentTaskId}
                  onComplete={(draftPath) => {
                    console.log('草稿生成完成:', draftPath);
                    setSuccess(`✅ 任务完成！草稿路径: ${draftPath}`);
                    setShowProgressInline(false);
                    setCurrentTaskId(null);
                  }}
                  onError={(error) => {
                    console.error('任务失败:', error);
                    setError(`❌ 任务失败: ${error}`);
                    setShowProgressInline(false);
                  }}
                  showDetails
                />
              </Box>
            )}
          </Box>

          {/* 编辑器工具栏 */}
          <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, alignItems: 'center', backgroundColor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
            <Tooltip title="格式化JSON">
              <IconButton
                size="small"
                onClick={handleFormatJson}
                color="primary"
              >
                <FormatAlignLeftIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="一键添加轨道">
              <IconButton
                size="small"
                onClick={handleAddTracks}
                color="secondary"
                disabled={!ruleGroup || !ruleGroup.rules.length}
              >
                <AddTrackIcon />
              </IconButton>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {highlightedTypes.size > 0 && `已匹配 ${highlightedTypes.size} 个规则类型`}
            </Typography>
          </Box>

          {/* CodeMirror 编辑器 */}
          <Box sx={{ flex: 1, p: 2, pt: 1, overflow: 'hidden' }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: '100%' }}>
              <MonacoEditor
                key={editorKey}
                height="100%"
                language="json"
                value={testDataJson}
                onChange={(value) => setTestDataJson(value || '')}
                theme="light"
                onMount={(view) => {
                  console.log('[CodeMirror] 编辑器已挂载', { view });
                }}
                options={{
                  lineNumbers: true,
                  lineWrapping: true,
                  tabSize: 2,
                }}
              />
            </Box>
          </Box>

          {/* 底部操作按钮 */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <ButtonGroup variant="outlined" disabled={!fullRequestPayload}>
                <Button
                  onClick={handleDownloadBaseRequestData}
                  startIcon={<DownloadIcon />}
                >
                  下载基础数据
                </Button>
                <Button
                  size="small"
                  onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}
                  aria-controls={downloadMenuOpen ? 'download-menu' : undefined}
                  aria-expanded={downloadMenuOpen ? 'true' : undefined}
                  aria-haspopup="menu"
                >
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>

              {/* 下载选项菜单 */}
              <Menu
                id="download-menu"
                anchorEl={downloadMenuAnchor}
                open={downloadMenuOpen}
                onClose={() => setDownloadMenuAnchor(null)}
                MenuListProps={{
                  'aria-labelledby': 'download-split-button',
                }}
              >
                <MuiMenuItem onClick={handleDownloadFullRequestData}>
                  <ListItemText
                    primary="下载完整数据"
                    secondary="包含请求的items"
                  />
                </MuiMenuItem>
              </Menu>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={handleOpenSaveDialog}
                variant="outlined"
                startIcon={<SaveIcon />}
              >
                保存数据集
              </Button>
              <Button
                onClick={handleTest}
                variant="contained"
                startIcon={<PlayArrowIcon />}
                disabled={testing}
                data-testid="test-run-button"
              >
                {testing ? '测试中...' : '运行测试'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 保存数据集对话框 */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>保存测试数据集</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <TextField
              label="数据集名称"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              fullWidth
              required
              autoFocus
              placeholder="例如: 示例视频数据"
            />
            <TextField
              label="描述(可选)"
              value={datasetDescription}
              onChange={(e) => setDatasetDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="简要描述这个数据集的用途"
            />
            <Alert severity="info">
              如果数据集名称已存在,将会更新现有数据集
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>取消</Button>
          <Button onClick={handleSaveDataset} variant="contained" startIcon={<SaveIcon />}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 下载确认对话框 */}
      <Dialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>下载JSON文件</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography>
              请选择下载格式:
            </Typography>
            <Alert severity="info">
              <Typography variant="body2" gutterBottom>
                <strong>普通格式:</strong> JSON紧凑单行,无换行
              </Typography>
              <Typography variant="body2">
                <strong>压缩并转义:</strong> JSON紧凑单行 + 转义所有双引号(\")
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadDialogOpen(false)}>取消</Button>
          <Button
            onClick={() => handleConfirmDownload(false)}
            variant="outlined"
          >
            普通格式
          </Button>
          <Button
            onClick={() => handleConfirmDownload(true)}
            variant="contained"
          >
            压缩并转义
          </Button>
        </DialogActions>
      </Dialog>

      {/* 路径替换对话框 */}
      <PathReplacementDialog
        open={pathReplacementDialogOpen}
        onClose={() => setPathReplacementDialogOpen(false)}
        materials={fullRequestPayload?.materials || []}
        onConfirm={handlePathReplacementConfirm}
      />
    </Box>
  );
});

TestDataEditor.displayName = 'TestDataEditor';

export default TestDataEditor;
