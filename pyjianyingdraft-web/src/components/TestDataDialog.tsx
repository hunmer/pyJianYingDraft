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
  Tabs,
  Tab,
  Paper,
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
import { Divider } from '@mui/material';

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
      id={`test-data-tabpanel-${index}`}
      {...other}
      style={{ flex: 1, overflow: 'auto' }}
    >
      {value === index && <Box sx={{ p: 2, height: '100%' }}>{children}</Box>}
    </div>
  );
}

interface TestDataDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 测试回调 */
  onTest: (testData: TestData) => void;
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
  const [activeTab, setActiveTab] = useState(0);
  const [testDataJson, setTestDataJson] = useState(JSON.stringify(EXAMPLE_TEST_DATA, null, 2));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 数据集管理状态
  const [datasets, setDatasets] = useState<TestDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');

  // 测试结果状态
  const [testResultJson, setTestResultJson] = useState<string>('');

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

  // 根据规则转换输入数据为素材属性
  const transformTestDataToMaterials = (testData: TestData): any[] => {
    if (!ruleGroup) {
      throw new Error('未选择规则组');
    }

    const results: any[] = [];

    testData.items.forEach((item, index) => {
      // 查找对应的规则
      const rule = ruleGroup.rules.find(r => r.type === item.type);
      if (!rule) {
        throw new Error(`未找到规则类型: ${item.type} (素材项 ${index})`);
      }

      // 遍历规则的素材ID列表
      rule.material_ids.forEach(materialId => {
        // 查找对应的素材
        const material = materials.find(m => m.id === materialId);
        if (!material) {
          console.warn(`未找到素材: ${materialId}`);
          return;
        }

        // 克隆素材属性
        const clonedMaterial = JSON.parse(JSON.stringify(material));

        // 用输入数据覆盖对应字段
        Object.keys(item.data).forEach(key => {
          if (key in clonedMaterial) {
            clonedMaterial[key] = item.data[key];
          } else {
            // 如果字段不存在于素材中,添加到素材属性中
            clonedMaterial[key] = item.data[key];
          }
        });

        // 添加元数据信息(时间轴、位置等)
        if (item.meta) {
          clonedMaterial._meta = item.meta;
        }

        results.push(clonedMaterial);
      });
    });

    return results;
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
  const handleTest = () => {
    setError('');
    setSuccess('');
    setTestResultJson('');

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
        if (!item.meta || !item.meta.timeline) {
          throw new Error(`素材项 ${index} 缺少 meta.timeline 字段`);
        }
        if (!item.data) {
          throw new Error(`素材项 ${index} 缺少 data 字段`);
        }
      });

      // 执行数据转换
      const transformedResults = transformTestDataToMaterials(testData);
      setTestResultJson(JSON.stringify(transformedResults, null, 2));

      setSuccess(`测试通过! 已转换 ${transformedResults.length} 个素材`);
      onTest(testData);

      // 切换到测试结果Tab
      setActiveTab(2);
    } catch (err: any) {
      setError(err.message || '无效的JSON格式');
    }
  };

  // 重置为示例数据
  const handleReset = () => {
    setTestDataJson(JSON.stringify(EXAMPLE_TEST_DATA, null, 2));
    setSelectedDatasetId('');
    setError('');
    setSuccess('');
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

            <Box sx={{ px: 2, pt: ruleGroupId && datasets.length > 0 ? 2 : 0 }}>
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="数据说明" />
                <Tab label="测试结果" />
              </Tabs>
            </Box>

          <TabPanel value={activeTab} index={0}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Editor
              height="450px"
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
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              <Typography variant="body2">
                测试结果展示了输入数据根据规则转换后的素材属性。每个输入项会根据规则的 material_ids 克隆对应素材,并用输入数据覆盖素材字段。
              </Typography>
            </Alert>

            {testResultJson ? (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Editor
                  height="450px"
                  defaultLanguage="json"
                  value={testResultJson}
                  theme="vs-light"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    wrappingIndent: 'indent',
                  }}
                />
              </Box>
            ) : (
              <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary">
                  请先在"JSON 编辑器"标签页运行测试,查看转换结果
                </Typography>
              </Paper>
            )}
          </Box>
        </TabPanel>
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
              <Button onClick={handleTest} variant="contained" startIcon={<PlayArrowIcon />}>
                运行测试
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
