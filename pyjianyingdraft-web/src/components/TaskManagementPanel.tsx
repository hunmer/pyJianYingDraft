'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid2,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  DeleteSweep as ClearAllIcon,
} from '@mui/icons-material';
import { Task, TaskStatus, ExecutionStatus, CozeWorkflow, CreateTaskRequest } from '@/types/coze';
import TaskCard from './TaskCard';
import NewTaskDialog from './NewTaskDialog';
import { useCoZone } from '@/hooks/useCoZone';

interface TaskManagementPanelProps {
  workflowId?: string;
  onTaskExecute?: (task: Task) => void;
}

const TaskManagementPanel: React.FC<TaskManagementPanelProps> = ({
  workflowId,
  onTaskExecute,
}) => {
  const {
    tasks,
    selectedWorkflow,
    workflows,
    taskLoading,
    taskExecuting,
    refreshTasks,
    createTask,
    executeTask,
    deleteTask,
  } = useCoZone();

  // 状态管理
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [executionStatusFilter, setExecutionStatusFilter] = useState<ExecutionStatus | ''>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'executedAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 刷新任务列表
  const handleRefresh = useCallback(async () => {
    try {
      await refreshTasks?.(workflowId);
    } catch (error) {
      console.error('刷新任务列表失败:', error);
    }
  }, [refreshTasks, workflowId]);

  // 初始加载
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  // 筛选和排序任务
  useEffect(() => {
    let filtered = [...tasks];

    // 按工作流筛选
    if (workflowId) {
      filtered = filtered.filter(task => task.workflow_id === workflowId);
    }

    // 按状态筛选
    if (statusFilter) {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // 按执行状态筛选
    if (executionStatusFilter) {
      filtered = filtered.filter(task => task.execution_status === executionStatusFilter);
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'executedAt':
          aValue = a.executedAt ? new Date(a.executedAt).getTime() : 0;
          bValue = b.executedAt ? new Date(b.executedAt).getTime() : 0;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredTasks(filtered);
  }, [tasks, workflowId, statusFilter, executionStatusFilter, sortBy, sortOrder]);

  // 处理任务执行
  const handleTaskExecute = useCallback(async (task: Task) => {
    try {
      if (task.status === TaskStatus.EXECUTING) {
        return; // 正在执行中，不处理
      }

      const result = await executeTask?.({
        task_id: task.id,
        workflow_id: task.workflow_id,
        input_parameters: task.input_parameters,
        save_as_task: false, // 使用现有任务
      });

      if (result) {
        // 刷新任务列表
        await handleRefresh();
        onTaskExecute?.(task);
      }
    } catch (error) {
      console.error('执行任务失败:', error);
    }
  }, [executeTask, handleRefresh, onTaskExecute]);

  // 处理任务查看
  const handleTaskView = useCallback((task: Task) => {
    setSelectedTask(task);
    // 这里可以打开查看对话框或导航到详情页面
    console.log('查看任务:', task);
  }, []);

  // 处理任务删除
  const handleTaskDelete = useCallback((task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteTask = useCallback(async () => {
    if (!taskToDelete) return;

    try {
      await deleteTask?.(taskToDelete.id);
      await handleRefresh();
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  }, [deleteTask, handleRefresh, taskToDelete]);

  // 处理创建新任务
  const handleCreateTask = useCallback(async (taskData: CreateTaskRequest) => {
    try {
      await createTask?.(taskData);
      setNewTaskDialogOpen(false);
      await handleRefresh();
    } catch (error) {
      console.error('创建任务失败:', error);
    }
  }, [createTask, handleRefresh]);

  // 处理创建并执行任务
  const handleCreateAndExecute = useCallback(async (taskData: CreateTaskRequest) => {
    try {
      // 先创建任务
      const newTask = await createTask?.(taskData);

      if (newTask) {
        // 然后执行任务
        await executeTask?.({
          workflow_id: taskData.workflow_id,
          input_parameters: taskData.input_parameters,
          save_as_task: true,
          task_name: taskData.name,
          task_description: taskData.description,
        });
      }

      setNewTaskDialogOpen(false);
      await handleRefresh();
    } catch (error) {
      console.error('创建并执行任务失败:', error);
    }
  }, [createTask, executeTask, handleRefresh]);

  // 切换排序
  const toggleSort = (field: 'createdAt' | 'executedAt' | 'name') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 清除筛选
  const clearFilters = () => {
    setStatusFilter('');
    setExecutionStatusFilter('');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* 标题和操作栏 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          任务管理
          {workflowId && (
            <Chip
              label={selectedWorkflow?.name || '工作流任务'}
              size="small"
              sx={{ ml: 2 }}
            />
          )}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="刷新">
            <IconButton onClick={handleRefresh} disabled={taskLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="清除筛选">
            <IconButton onClick={clearFilters} disabled={!statusFilter && !executionStatusFilter}>
              <ClearAllIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 筛选栏 */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ minWidth: 60 }}>
              筛选:
            </Typography>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>任务状态</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
                label="任务状态"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value={TaskStatus.DRAFT}>未执行</MenuItem>
                <MenuItem value={TaskStatus.EXECUTING}>执行中</MenuItem>
                <MenuItem value={TaskStatus.COMPLETED}>已完成</MenuItem>
                <MenuItem value={TaskStatus.FAILED}>执行失败</MenuItem>
                <MenuItem value={TaskStatus.CANCELLED}>已取消</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>执行状态</InputLabel>
              <Select
                value={executionStatusFilter}
                onChange={(e) => setExecutionStatusFilter(e.target.value as ExecutionStatus | '')}
                label="执行状态"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value={ExecutionStatus.PENDING}>等待中</MenuItem>
                <MenuItem value={ExecutionStatus.RUNNING}>运行中</MenuItem>
                <MenuItem value={ExecutionStatus.SUCCESS}>成功</MenuItem>
                <MenuItem value={ExecutionStatus.FAILED}>失败</MenuItem>
                <MenuItem value={ExecutionStatus.TIMEOUT}>超时</MenuItem>
                <MenuItem value={ExecutionStatus.CANCELLED}>已取消</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle2" sx={{ minWidth: 60, ml: 2 }}>
              排序:
            </Typography>

            <Button
              size="small"
              onClick={() => toggleSort('createdAt')}
              variant={sortBy === 'createdAt' ? 'contained' : 'outlined'}
              startIcon={<SortIcon />}
            >
              创建时间 {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>

            <Button
              size="small"
              onClick={() => toggleSort('executedAt')}
              variant={sortBy === 'executedAt' ? 'contained' : 'outlined'}
              startIcon={<SortIcon />}
            >
              执行时间 {sortBy === 'executedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>

            <Button
              size="small"
              onClick={() => toggleSort('name')}
              variant={sortBy === 'name' ? 'contained' : 'outlined'}
              startIcon={<SortIcon />}
            >
              名称 {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 任务统计 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          共 {filteredTasks.length} 个任务
          {statusFilter && ` · 状态: ${statusFilter}`}
          {executionStatusFilter && ` · 执行状态: ${executionStatusFilter}`}
          {workflowId && ' · 当前工作流'}
        </Typography>
      </Box>

      {/* 任务列表 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {taskLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : filteredTasks.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              暂无任务
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {workflowId ? '当前工作流还没有任务' : '还没有创建任何任务'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewTaskDialogOpen(true)}
            >
              创建第一个任务
            </Button>
          </Box>
        ) : (
          <Grid2 container spacing={3}>
            {filteredTasks.map((task) => (
              <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={task.id}>
                <TaskCard
                  task={task}
                  onExecute={handleTaskExecute}
                  onView={handleTaskView}
                  onDelete={handleTaskDelete}
                />
              </Grid2>
            ))}
          </Grid2>
        )}
      </Box>

      {/* 浮动添加按钮 */}
      <Fab
        color="primary"
        aria-label="添加任务"
        sx={{ position: 'absolute', bottom: 24, right: 24 }}
        onClick={() => setNewTaskDialogOpen(true)}
        disabled={taskLoading}
      >
        <AddIcon />
      </Fab>

      {/* 新建任务对话框 */}
      <NewTaskDialog
        open={newTaskDialogOpen}
        onClose={() => setNewTaskDialogOpen(false)}
        workflow={selectedWorkflow}
        availableWorkflows={workflows}
        onCreate={handleCreateTask}
        onExecute={handleCreateAndExecute}
        loading={taskLoading}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>确认删除任务</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除任务 "{taskToDelete?.name}" 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={confirmDeleteTask} color="error" variant="contained">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TaskManagementPanel;