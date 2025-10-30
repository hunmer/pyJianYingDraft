'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Divider,
  Alert,
  Grid2,
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  PlayArrow as ExecuteIcon,
} from '@mui/icons-material';
import { CozeWorkflow, CreateTaskRequest } from '@/types/coze';

interface WorkflowQuickCreateTaskPanelProps {
  workflow: CozeWorkflow;
  parameters: Record<string, any>;
  onSave: (taskData: CreateTaskRequest) => void;
  onSaveAndExecute: (taskData: CreateTaskRequest) => void;
  loading?: boolean;
}

/**
 * 工作流快速创建任务面板
 *
 * 用于快速将当前对话框选择的工作流和编辑器中的参数保存为新任务
 * 隐藏工作流选择和参数编辑，只需填写任务基本信息
 */
const WorkflowQuickCreateTaskPanel: React.FC<WorkflowQuickCreateTaskPanelProps> = ({
  workflow,
  parameters,
  onSave,
  onSaveAndExecute,
  loading = false,
}) => {
  // 表单状态
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 初始化任务名称
  useEffect(() => {
    if (workflow) {
      const timestamp = new Date().toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      setTaskName(`${workflow.name} - ${timestamp}`);
      setDescription(workflow.description || '');
    }
  }, [workflow]);

  // 添加标签
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  // 删除标签
  const handleDeleteTag = (tagToDelete: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToDelete));
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!taskName.trim()) {
      newErrors.name = '任务名称不能为空';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  // 构建任务数据
  const buildTaskData = (): CreateTaskRequest => {
    return {
      name: taskName,
      description: description,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      input_parameters: parameters,
      tags: tags,
      priority: priority,
      metadata: {
        created_from: 'quick_create_panel',
        created_at: new Date().toISOString(),
      },
    };
  };

  // 处理保存
  const handleSave = () => {
    if (!validateForm()) return;
    onSave(buildTaskData());
  };

  // 处理保存并执行
  const handleSaveAndExecute = () => {
    if (!validateForm()) return;
    onSaveAndExecute(buildTaskData());
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 当前工作流信息 */}
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
        <Typography variant="subtitle2" gutterBottom>
          📋 将要创建的任务基于
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {workflow.icon_url && (
            <Box
              component="img"
              src={workflow.icon_url}
              alt={workflow.name}
              sx={{ width: 24, height: 24, borderRadius: 1 }}
            />
          )}
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {workflow.name}
          </Typography>
          <Chip
            label={`v${workflow.version}`}
            size="small"
            sx={{ bgcolor: 'primary.dark' }}
          />
        </Box>
      </Paper>

      {/* 任务基本信息表单 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Grid2 container spacing={2}>
          {/* 任务名称 */}
          <Grid2 size={12}>
            <TextField
              label="任务名称"
              value={taskName}
              onChange={(e) => {
                setTaskName(e.target.value);
                if (errors.name) {
                  setErrors(prev => ({ ...prev, name: '' }));
                }
              }}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || '输入一个有意义的任务名称'}
              disabled={loading}
            />
          </Grid2>

          {/* 任务描述 */}
          <Grid2 size={12}>
            <TextField
              label="任务描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="描述这个任务的目的和预期结果..."
              disabled={loading}
            />
          </Grid2>

          {/* 优先级 */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>优先级</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                disabled={loading}
              >
                <MenuItem value="low">🟢 低</MenuItem>
                <MenuItem value="medium">🟡 中</MenuItem>
                <MenuItem value="high">🔴 高</MenuItem>
              </Select>
            </FormControl>
          </Grid2>

          {/* 标签 */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                标签
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="输入标签"
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  fullWidth
                />
                <Button
                  size="small"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || loading}
                  variant="outlined"
                  startIcon={<AddIcon />}
                >
                  添加
                </Button>
              </Box>
            </Box>
          </Grid2>

          {/* 标签列表 */}
          {tags.length > 0 && (
            <Grid2 size={12}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleDeleteTag(tag)}
                    size="small"
                    disabled={loading}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid2>
          )}

          <Grid2 size={12}>
            <Divider />
          </Grid2>

          {/* 参数预览 */}
          <Grid2 size={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                📝 使用的输入参数
              </Typography>
              <Box
                component="pre"
                sx={{
                  mt: 1,
                  p: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  maxHeight: 150,
                }}
              >
                {JSON.stringify(parameters, null, 2)}
              </Box>
            </Paper>
          </Grid2>
        </Grid2>
      </Box>

      {/* 提示信息 */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          💡 <strong>快速创建说明：</strong>
          <br />
          • 工作流和参数已自动填充，无需手动选择
          <br />
          • 填写任务基本信息后可直接保存或执行
          <br />
          • 保存后可在任务管理中查看和管理
        </Typography>
      </Alert>

      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          onClick={handleSave}
          variant="outlined"
          startIcon={<SaveIcon />}
          disabled={loading}
          size="large"
        >
          仅保存
        </Button>
        <Button
          onClick={handleSaveAndExecute}
          variant="contained"
          startIcon={<ExecuteIcon />}
          disabled={loading}
          size="large"
        >
          保存并执行
        </Button>
      </Box>
    </Box>
  );
};

export default React.memo(WorkflowQuickCreateTaskPanel);
