'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';

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
import type { TestData, TestDataset, RuleGroup, RawSegmentPayload, RawMaterialPayload, RuleGroupTestRequest } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';
import { EXAMPLE_TEST_DATA } from '@/config/defaultRules';
import { RuleGroupList } from './RuleGroupList';
import { DownloadProgressBar } from './DownloadProgressBar';

// 测试回调的返回类型：可以是请求载荷，也可以是包含task_id的响应
type TestCallbackResult = RuleGroupTestRequest | { task_id: string; [key: string]: any } | void;

interface TestDataEditorProps {
  /** 测试数据ID */
  testDataId: string;
  /** 测试回调(必需) - 返回完整的请求载荷或包含task_id的响应 */
  onTest: (testData: TestData) => Promise<TestCallbackResult> | TestCallbackResult;
  /** 当前规则组ID(用于关联数据集) */
  ruleGroupId?: string;
  /** 当前规则组(用于转换数据) */
  ruleGroup?: RuleGroup | null;
  /** 素材列表(用于提取素材属性) */
  materials?: MaterialInfo[];
  /** 可用的原始片段载荷(用于调试展示) */
  rawSegments?: RawSegmentPayload[] | undefined;
  /** 可用的原始素材载荷(用于调试展示) */
  rawMaterials?: RawMaterialPayload[] | undefined;
  /** 当前是否会在测试时启用原始片段模式 */
  useRawSegmentsHint?: boolean;
  /** 预设测试数据 */
  initialTestData?: TestData | null;
}

/**
 * 测试数据编辑器 - 完整页面组件
 * 功能与 TestDataDialog 保持一致
 */
export default function TestDataEditor({
  testDataId,
  onTest,
  ruleGroupId,
  ruleGroup,
  materials = [],
  rawSegments: _rawSegments,
  rawMaterials: _rawMaterials,
  useRawSegmentsHint,
  initialTestData = null,
}: TestDataEditorProps) {
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

  // 保存测试数据到localStorage
  useEffect(() => {
    if (testDataJson) {
      localStorage.setItem(`test-data-json-${testDataId}`, testDataJson);
    }
  }, [testDataJson, testDataId]);
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
          throw new Error(`素材项 ${index} 缺少 data 字段`);
        }
      });

      setTesting(true);
      const result = await onTest(testData);

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

  // 下载基础请求数据(items为空)
  const handleDownloadBaseRequestData = () => {
    if (!fullRequestPayload) {
      setError('没有可下载的请求数据');
      return;
    }

    // 提取所有必需和可选字段,testData 中的 items 设置为空数组
    const baseRequestPayload: any = {
      ruleGroup: fullRequestPayload.ruleGroup,
      materials: fullRequestPayload.materials,
      testData: {
        ...fullRequestPayload.testData,
        items: [],
      },
    };

    // 添加可选字段(如果存在)
    if (fullRequestPayload.segment_styles) {
      baseRequestPayload.segment_styles = fullRequestPayload.segment_styles;
    }
    if (fullRequestPayload.use_raw_segments !== undefined) {
      baseRequestPayload.use_raw_segments = fullRequestPayload.use_raw_segments;
    }
    if (fullRequestPayload.raw_segments) {
      baseRequestPayload.raw_segments = fullRequestPayload.raw_segments;
    }
    if (fullRequestPayload.raw_materials) {
      baseRequestPayload.raw_materials = fullRequestPayload.raw_materials;
    }
    if (fullRequestPayload.canvas_width !== undefined) {
      baseRequestPayload.canvas_width = fullRequestPayload.canvas_width;
    }
    if (fullRequestPayload.canvas_height !== undefined) {
      baseRequestPayload.canvas_height = fullRequestPayload.canvas_height;
    }
    if (fullRequestPayload.fps !== undefined) {
      baseRequestPayload.fps = fullRequestPayload.fps;
    }

    const fileContent = JSON.stringify(baseRequestPayload, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `base-request-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setSuccess('基础请求数据已下载');
    setTimeout(() => setSuccess(''), 2000);
    setDownloadMenuAnchor(null);
  };

  // 下载完整请求数据
  const handleDownloadFullRequestData = () => {
    if (!fullRequestPayload) {
      setError('没有可下载的请求数据');
      return;
    }

    // 提取所有必需和可选字段
    const filteredPayload: any = {
      ruleGroup: fullRequestPayload.ruleGroup,
      materials: fullRequestPayload.materials,
      testData: fullRequestPayload.testData,
    };

    // 添加可选字段(如果存在)
    if (fullRequestPayload.segment_styles) {
      filteredPayload.segment_styles = fullRequestPayload.segment_styles;
    }
    if (fullRequestPayload.use_raw_segments !== undefined) {
      filteredPayload.use_raw_segments = fullRequestPayload.use_raw_segments;
    }
    if (fullRequestPayload.raw_segments) {
      filteredPayload.raw_segments = fullRequestPayload.raw_segments;
    }
    if (fullRequestPayload.raw_materials) {
      filteredPayload.raw_materials = fullRequestPayload.raw_materials;
    }
    if (fullRequestPayload.canvas_width !== undefined) {
      filteredPayload.canvas_width = fullRequestPayload.canvas_width;
    }
    if (fullRequestPayload.canvas_height !== undefined) {
      filteredPayload.canvas_height = fullRequestPayload.canvas_height;
    }
    if (fullRequestPayload.fps !== undefined) {
      filteredPayload.fps = fullRequestPayload.fps;
    }

    const fileContent = JSON.stringify(filteredPayload, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `full-request-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setSuccess('完整请求数据已下载');
    setTimeout(() => setSuccess(''), 2000);
    setDownloadMenuAnchor(null);
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
          <RuleGroupList ruleGroup={ruleGroup ?? null} showTitle={true} materials={materials} />
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

          {/* Monaco 编辑器 */}
          <Box sx={{ flex: 1, p: 2, pt: 0, overflow: 'hidden' }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: '100%' }}>
              <MonacoEditor
                key={editorKey}
                height="100%"
                defaultLanguage="json"
                value={testDataJson}
                onChange={(value) => setTestDataJson(value || '')}
                theme="vs-light"
                loading={
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                }
                onMount={(editor, monaco) => {
                  console.log('[Monaco] 编辑器已挂载', { editor, monaco });
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  formatOnPaste: true,
                  formatOnType: true,
                  wordWrap: 'on',
                  wrappingIndent: 'indent',
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
    </Box>
  );
}
