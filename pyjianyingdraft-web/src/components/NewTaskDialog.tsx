'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormHelperText,
  Grid2,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  PlayArrow as ExecuteIcon,
} from '@mui/icons-material';
import { CozeWorkflow, CreateTaskRequest } from '@/types/coze';

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  workflow?: CozeWorkflow;
  availableWorkflows?: CozeWorkflow[];
  onCreate?: (taskData: CreateTaskRequest) => void;
  onExecute?: (taskData: CreateTaskRequest) => void;
  loading?: boolean;
}

const NewTaskDialog: React.FC<NewTaskDialogProps> = ({
  open,
  onClose,
  workflow,
  availableWorkflows = [],
  onCreate,
  onExecute,
  loading = false,
}) => {
  // 表单状态
  const [formData, setFormData] = useState<CreateTaskRequest>({
    name: '',
    description: '',
    workflow_id: '',
    workflow_name: '',
    input_parameters: {},
    tags: [],
    priority: 'medium',
    metadata: {},
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 初始化表单数据
  useEffect(() => {
    if (workflow) {
      setFormData({
        name: `${workflow.name} - 任务`,
        description: workflow.description || '',
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        input_parameters: {},
        tags: [],
        priority: 'medium',
        metadata: {},
      });
    } else {
      setFormData({
        name: '',
        description: '',
        workflow_id: '',
        workflow_name: '',
        input_parameters: {},
        tags: [],
        priority: 'medium',
        metadata: {},
      });
    }
    setTagInput('');
    setErrors({});
  }, [workflow, open]);

  // 处理表单字段变化
  const handleFieldChange = (field: keyof CreateTaskRequest) => (
    event: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  // 处理工作流选择
  const handleWorkflowChange = (workflowId: string) => {
    const selectedWorkflow = availableWorkflows.find(w => w.id === workflowId);
    if (selectedWorkflow) {
      setFormData(prev => ({
        ...prev,
        workflow_id: workflowId,
        workflow_name: selectedWorkflow.name,
        name: prev.name || `${selectedWorkflow.name} - 任务`,
      }));
    }
  };

  // 添加标签
  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  // 删除标签
  const handleDeleteTag = (tagToDelete: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToDelete) || [],
    }));
  };

  // 处理输入参数（JSON格式）
  const handleInputParametersChange = (value: string) => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      setFormData(prev => ({
        ...prev,
        input_parameters: parsed,
      }));
      if (errors.input_parameters) {
        setErrors(prev => ({
          ...prev,
          input_parameters: '',
        }));
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        input_parameters: '输入参数格式不正确，请使用有效的JSON格式',
      }));
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = '任务名称不能为空';
    }

    if (!formData.workflow_id) {
      newErrors.workflow_id = '请选择工作流';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  // 处理创建任务
  const handleCreate = () => {
    if (!validateForm()) return;

    const taskData: CreateTaskRequest = {
      ...formData,
      input_parameters: formData.input_parameters || {},
    };

    onCreate?.(taskData);
  };

  // 处理执行任务
  const handleExecute = () => {
    if (!validateForm()) return;

    const taskData: CreateTaskRequest = {
      ...formData,
      input_parameters: formData.input_parameters || {},
    };

    onExecute?.(taskData);
  };

  // 获取当前选中的工作流信息
  const selectedWorkflow = availableWorkflows.find(w => w.id === formData.workflow_id);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 500 }
      }}
    >
      <DialogTitle>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          {workflow ? '基于工作流创建任务' : '创建新任务'}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Grid2 container spacing={3}>
          {/* 基本信息 */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <TextField
              label="任务名称"
              value={formData.name}
              onChange={handleFieldChange('name')}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name}
              disabled={loading}
            />
          </Grid2>

          <Grid2 size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth required error={!!errors.workflow_id}>
              <InputLabel>工作流</InputLabel>
              <Select
                value={formData.workflow_id}
                onChange={(e) => handleWorkflowChange(e.target.value)}
                disabled={!!workflow || loading}
              >
                {availableWorkflows.map((wf) => (
                  <MenuItem key={wf.id} value={wf.id}>
                    {wf.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.workflow_id && (
                <FormHelperText error>{errors.workflow_id}</FormHelperText>
              )}
            </FormControl>
          </Grid2>

          <Grid2 size={12}>
            <TextField
              label="任务描述"
              value={formData.description}
              onChange={handleFieldChange('description')}
              fullWidth
              multiline
              rows={3}
              disabled={loading}
            />
          </Grid2>

          {/* 优先级 */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>优先级</InputLabel>
              <Select
                value={formData.priority}
                onChange={handleFieldChange('priority')}
                disabled={loading}
              >
                <MenuItem value="low">低</MenuItem>
                <MenuItem value="medium">中</MenuItem>
                <MenuItem value="high">高</MenuItem>
              </Select>
            </FormControl>
          </Grid2>

          {/* 标签 */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                标签
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="输入标签"
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button
                  size="small"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || loading}
                  startIcon={<AddIcon />}
                >
                  添加
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {formData.tags?.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleDeleteTag(tag)}
                    size="small"
                    disabled={loading}
                  />
                ))}
              </Box>
            </Box>
          </Grid2>

          {/* 输入参数 */}
          <Grid2 size={12}>
            <TextField
              label="输入参数 (JSON格式)"
              value={JSON.stringify(formData.input_parameters, null, 2)}
              onChange={(e) => handleInputParametersChange(e.target.value)}
              fullWidth
              multiline
              rows={4}
              error={!!errors.input_parameters}
              helperText={errors.input_parameters || '例如: {"param1": "value1", "param2": 123}'}
              disabled={loading}
            />
          </Grid2>

          {/* 工作流信息 */}
          {selectedWorkflow && (
            <Grid2 size={12}>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  工作流信息
                </Typography>
                <Typography variant="body2">
                  <strong>名称:</strong> {selectedWorkflow.name}
                </Typography>
                {selectedWorkflow.description && (
                  <Typography variant="body2">
                    <strong>描述:</strong> {selectedWorkflow.description}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>版本:</strong> {selectedWorkflow.version}
                </Typography>
              </Alert>
            </Grid2>
          )}
        </Grid2>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={handleCreate}
          variant="outlined"
          startIcon={<SaveIcon />}
          disabled={loading}
        >
          仅保存
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          startIcon={<ExecuteIcon />}
          disabled={loading}
        >
          保存并执行
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewTaskDialog;