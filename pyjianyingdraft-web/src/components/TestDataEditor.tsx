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
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Editor from '@monaco-editor/react';
import DownloadIcon from '@mui/icons-material/Download';
import type { TestData, TestDataset, RuleGroup, RawSegmentPayload, RawMaterialPayload, RuleGroupTestRequest } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';
import { EXAMPLE_TEST_DATA } from '@/config/defaultRules';
import { RuleGroupList } from './RuleGroupList';

interface TestDataEditorProps {
  /** 测试数据ID */
  testDataId: string;
  /** 测试回调(必需) - 返回完整的请求载荷 */
  onTest: (testData: TestData) => Promise<RuleGroupTestRequest | void> | RuleGroupTestRequest | void;
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
  const [testDataJson, setTestDataJson] = useState(initialJson);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testing, setTesting] = useState(false);
  const [fullRequestPayload, setFullRequestPayload] = useState<RuleGroupTestRequest | null>(null);

  useEffect(() => {
    setTestDataJson(initialJson);
  }, [initialJson]);
  // 数据集管理状态
  const [datasets, setDatasets] = useState<TestDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');

  // 从localStorage加载数据集
  const loadDatasets = useCallback(() => {
    try {
      const stored = localStorage.getItem(`test-datasets-${ruleGroupId}`);
      if (stored) {
        const loadedDatasets = JSON.parse(stored) as TestDataset[];
        setDatasets(loadedDatasets);
      }
    } catch (err) {
      console.error('加载数据集失败:', err);
    }
  }, [ruleGroupId]);

  // 加载数据集列表
  useEffect(() => {
    if (ruleGroupId) {
      loadDatasets();
    }
  }, [ruleGroupId, loadDatasets]);

  

  // 保存数据集到localStorage
  const saveDatasets = (updatedDatasets: TestDataset[]) => {
    try {
      localStorage.setItem(`test-datasets-${ruleGroupId}`, JSON.stringify(updatedDatasets));
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

      // 如果回调返回了完整的请求载荷,保存它以供下载
      if (result && typeof result === 'object' && 'testData' in result) {
        setFullRequestPayload(result);
      }

      setSuccess('测试请求已发送');
    } catch (err: any) {
      setError(err.message || '无效的JSON格式');
    } finally {
      setTesting(false);
    }
  };

  // 重置为示例数据
  const handleReset = () => {
    setTestDataJson(JSON.stringify(EXAMPLE_TEST_DATA, null, 2));
    setSelectedDatasetId('');
    setError('');
    setSuccess('');
    setTesting(false);
  };

  // 加载选中的数据集
  const handleLoadDataset = (datasetId: string) => {
    if (!datasetId) {
      setTestDataJson('');
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

    if (!ruleGroupId) {
      setError('未选择规则组');
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
          ruleGroupId: ruleGroupId,
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

  // 下载完整请求数据
  const handleDownloadRequestData = () => {
    if (!fullRequestPayload) {
      setError('没有可下载的请求数据');
      return;
    }

    const fileContent = JSON.stringify(fullRequestPayload, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `full-request-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setSuccess('请求数据已下载');
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 顶部标题栏 */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button size="small" onClick={handleReset} variant="outlined" startIcon={<RestartAltIcon />}>
            重置为示例数据
          </Button>
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
          {ruleGroupId && datasets.length > 0 && (
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
          <Box sx={{ p: 2, pb: ruleGroupId && datasets.length > 0 ? 2 : 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
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
          </Box>

          {/* Monaco 编辑器 */}
          <Box sx={{ flex: 1, p: 2, pt: 0, overflow: 'hidden' }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: '100%' }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={testDataJson}
                onChange={(value) => setTestDataJson(value || '')}
                theme="vs-light"
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
              <Button
                variant="outlined"
                onClick={handleDownloadRequestData}
                disabled={!fullRequestPayload}
                startIcon={<DownloadIcon />}
              >
                下载完整请求数据
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {ruleGroupId && (
                <Button
                  onClick={handleOpenSaveDialog}
                  variant="outlined"
                  startIcon={<SaveIcon />}
                >
                  保存数据集
                </Button>
              )}
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
