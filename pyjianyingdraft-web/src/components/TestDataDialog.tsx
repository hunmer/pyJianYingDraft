'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import Editor from '@monaco-editor/react';
import type { TestData, TestDataset, RuleGroup } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';
import { EXAMPLE_TEST_DATA } from '@/config/defaultRules';
import { RuleGroupList } from './RuleGroupList';

interface TestDataDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 测试回调 */
  onTest: (testData: TestData) => Promise<void> | void;
  /** 当前规则组ID(用于关联数据集) */
  ruleGroupId?: string;
  /** 当前规则组(用于转换数据) */
  ruleGroup?: RuleGroup | null;
  /** 素材列表(用于提取素材属性) */
  materials?: MaterialInfo[];
}

/**
 * 测试数据对话框组件
 */
export const TestDataDialog: React.FC<TestDataDialogProps> = ({
  open,
  onClose,
  onTest,
  ruleGroupId,
  ruleGroup,
  materials = []
}) => {
  const [testDataJson, setTestDataJson] = useState(JSON.stringify(EXAMPLE_TEST_DATA, null, 2));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testing, setTesting] = useState(false);

  // 数据集管理状态
  const [datasets, setDatasets] = useState<TestDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');

  // 加载数据集列表
  useEffect(() => {
    if (open && ruleGroupId) {
      loadDatasets();
    }
  }, [open, ruleGroupId]);

  // 从localStorage加载数据集
  const loadDatasets = () => {
    try {
      const stored = localStorage.getItem(`test-datasets-${ruleGroupId}`);
      if (stored) {
        const loadedDatasets = JSON.parse(stored) as TestDataset[];
        setDatasets(loadedDatasets);
      }
    } catch (err) {
      console.error('加载数据集失败:', err);
    }
  };

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
      await onTest(testData);
      setSuccess('测试请求已发送, 请在右侧查看结果');
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
      // 选择空数据集时,清空textarea和select
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

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">测试规则数据</Typography>
            <Button size="small" onClick={handleReset} variant="outlined">
              重置为示例数据
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', height: '600px' }}>
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
            <RuleGroupList ruleGroup={ruleGroup} showTitle={true} materials={materials} />
          </Box>

          {/* 右侧内容区域 */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 数据集选择器 */}
            {ruleGroupId && datasets.length > 0 && (
              <Box sx={{ p: 2, pb: 0, display: 'flex', gap: 1, alignItems: 'center' }}>
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
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, p: 2, pt: ruleGroupId && datasets.length > 0 ? 2 : 0 }}>
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

              <Alert severity="info">
                <Typography variant="body2">
                  使用 `tracks` 和 `items` 来描述测试数据。每个 `item` 仅包含 `type` 与 `data`，例如 `track`、`start`、`duration` 等信息全部放在 `data` 中。
                </Typography>
              </Alert>

              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', flex: 1 }}>
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
          </Box>
        </DialogContent>

        <DialogActions>
          <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={onClose}>取消</Button>
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
        </DialogActions>
      </Dialog>

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
    </>
  );
};

export default TestDataDialog;
