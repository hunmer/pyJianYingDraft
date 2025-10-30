'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompletedIcon,
  Error as FailedIcon,
  Cancel as CancelledIcon,
  AccessTime as PendingIcon,
} from '@mui/icons-material';
import { Task, TaskStatus, ExecutionStatus } from '@/types/coze';

interface TaskCardProps {
  task: Task;
  onExecute?: (task: Task) => void;
  onView?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onExecute,
  onView,
  onDelete,
}) => {
  // 获取状态图标和颜色
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DRAFT:
        return <ScheduleIcon />;
      case TaskStatus.EXECUTING:
        return <PendingIcon />;
      case TaskStatus.COMPLETED:
        return <CompletedIcon />;
      case TaskStatus.FAILED:
        return <FailedIcon />;
      case TaskStatus.CANCELLED:
        return <CancelledIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DRAFT:
        return 'default';
      case TaskStatus.EXECUTING:
        return 'warning';
      case TaskStatus.COMPLETED:
        return 'success';
      case TaskStatus.FAILED:
        return 'error';
      case TaskStatus.CANCELLED:
        return 'default';
      default:
        return 'default';
    }
  };

  const getExecutionStatusColor = (status?: ExecutionStatus) => {
    if (!status) return 'default';
    switch (status) {
      case ExecutionStatus.PENDING:
        return 'warning';
      case ExecutionStatus.RUNNING:
        return 'info';
      case ExecutionStatus.SUCCESS:
        return 'success';
      case ExecutionStatus.FAILED:
        return 'error';
      case ExecutionStatus.TIMEOUT:
        return 'warning';
      case ExecutionStatus.CANCELLED:
        return 'default';
      default:
        return 'default';
    }
  };

  // 格式化时间
  const formatDate = (dateString?: string) => {
    if (!dateString) return '未设置';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 判断是否已执行
  const hasExecuted = task.executedAt !== undefined;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        {/* 头部信息 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600, flex: 1 }}>
            {task.name}
          </Typography>
          <IconButton
            size="small"
            onClick={() => onDelete?.(task)}
            sx={{ ml: 1 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* 任务状态 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={getStatusIcon(task.status)}
            label={task.status === TaskStatus.DRAFT ? '未执行' :
                   task.status === TaskStatus.EXECUTING ? '执行中' :
                   task.status === TaskStatus.COMPLETED ? '已完成' :
                   task.status === TaskStatus.FAILED ? '执行失败' : '已取消'}
            size="small"
            color={getStatusColor(task.status)}
            variant="outlined"
          />
          {task.execution_status && (
            <Chip
              label={task.execution_status === ExecutionStatus.PENDING ? '等待中' :
                     task.execution_status === ExecutionStatus.RUNNING ? '运行中' :
                     task.execution_status === ExecutionStatus.SUCCESS ? '成功' :
                     task.execution_status === ExecutionStatus.FAILED ? '失败' :
                     task.execution_status === ExecutionStatus.TIMEOUT ? '超时' : '已取消'}
              size="small"
              color={getExecutionStatusColor(task.execution_status)}
              variant="filled"
            />
          )}
        </Box>

        {/* 描述 */}
        {task.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {task.description}
          </Typography>
        )}

        {/* 工作流信息 */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          工作流: {task.workflow_name}
        </Typography>

        {/* 时间信息 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            创建时间: {formatDate(task.createdAt)}
          </Typography>
          {hasExecuted && (
            <Typography variant="caption" color="text.secondary">
              执行时间: {formatDate(task.executedAt)}
            </Typography>
          )}
          {task.completedAt && (
            <Typography variant="caption" color="text.secondary">
              完成时间: {formatDate(task.completedAt)}
            </Typography>
          )}
        </Box>

        {/* 错误信息 */}
        {task.errorMessage && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="error" sx={{ display: 'block' }}>
              错误信息:
            </Typography>
            <Typography variant="caption" color="error" sx={{ fontStyle: 'italic' }}>
              {task.errorMessage}
            </Typography>
          </Box>
        )}

        {/* 标签 */}
        {task.tags && task.tags.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {task.tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
          </Box>
        )}
      </CardContent>

      <Divider />

      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
        <Button
          variant="contained"
          startIcon={hasExecuted ? <ViewIcon /> : <ExecuteIcon />}
          onClick={() => hasExecuted ? onView?.(task) : onExecute?.(task)}
          size="small"
          disabled={task.status === TaskStatus.EXECUTING}
        >
          {hasExecuted ? '查看' : '执行'}
        </Button>

        {/* 优先级 */}
        {task.priority && (
          <Chip
            label={task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
            size="small"
            color={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'default'}
            variant="outlined"
          />
        )}
      </CardActions>
    </Card>
  );
};

export default TaskCard;