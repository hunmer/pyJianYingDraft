/**
 * DownloadProgressBar组件
 *
 * 可视化显示下载进度、速度和预计剩余时间
 */

import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Paper,
  Stack,
  Chip,
  Alert
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  Speed as SpeedIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useTaskProgress, TaskStatus } from '../hooks/useTaskProgress';

export interface DownloadProgressBarProps {
  /** 任务ID */
  taskId: string;
  /** 完成时的回调 */
  onComplete?: (draftPath: string) => void;
  /** 失败时的回调 */
  onError?: (error: string) => void;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 自定义高度 */
  height?: number | string;
}

/**
 * 获取状态颜色
 */
function getStatusColor(status: TaskStatus | null): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case TaskStatus.DOWNLOADING:
    case TaskStatus.PROCESSING:
      return 'primary';
    case TaskStatus.COMPLETED:
      return 'success';
    case TaskStatus.FAILED:
      return 'error';
    case TaskStatus.CANCELLED:
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * 获取状态图标
 */
function getStatusIcon(status: TaskStatus | null) {
  switch (status) {
    case TaskStatus.DOWNLOADING:
      return <DownloadIcon />;
    case TaskStatus.PROCESSING:
      return <DownloadIcon />;
    case TaskStatus.COMPLETED:
      return <CheckIcon />;
    case TaskStatus.FAILED:
      return <ErrorIcon />;
    case TaskStatus.CANCELLED:
      return <CancelIcon />;
    default:
      return <DownloadIcon />;
  }
}

/**
 * 获取状态文本
 */
function getStatusText(status: TaskStatus | null): string {
  switch (status) {
    case TaskStatus.PENDING:
      return '等待中';
    case TaskStatus.DOWNLOADING:
      return '下载中';
    case TaskStatus.PROCESSING:
      return '生成草稿中';
    case TaskStatus.COMPLETED:
      return '已完成';
    case TaskStatus.FAILED:
      return '失败';
    case TaskStatus.CANCELLED:
      return '已取消';
    default:
      return '未知';
  }
}

/**
 * 下载进度条组件
 *
 * @example
 * ```tsx
 * <DownloadProgressBar
 *   taskId="task-123"
 *   onComplete={(draftPath) => {
 *     console.log('草稿已生成:', draftPath);
 *     router.push(`/draft?path=${draftPath}`);
 *   }}
 *   showDetails
 * />
 * ```
 */
export function DownloadProgressBar({
  taskId,
  onComplete,
  onError,
  showDetails = true,
  height = 80
}: DownloadProgressBarProps) {
  const {
    status,
    progress,
    draftPath,
    errorMessage,
    isConnected,
    isInProgress,
    isCompleted,
    isFailed,
    progressPercent,
    speedText,
    etaText
  } = useTaskProgress(taskId);

  // 完成回调
  React.useEffect(() => {
    if (isCompleted && draftPath && onComplete) {
      onComplete(draftPath);
    }
  }, [isCompleted, draftPath, onComplete]);

  // 失败回调
  React.useEffect(() => {
    if (isFailed && errorMessage && onError) {
      onError(errorMessage);
    }
  }, [isFailed, errorMessage, onError]);

  // 连接状态警告
  if (!isConnected && !isCompleted && !isFailed) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        WebSocket连接中断，正在重新连接...
      </Alert>
    );
  }

  // 失败状态
  if (isFailed) {
    return (
      <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          任务失败
        </Typography>
        {errorMessage && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            {errorMessage}
          </Typography>
        )}
      </Alert>
    );
  }

  // 完成状态
  if (isCompleted) {
    return (
      <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          任务已完成！
        </Typography>
        {draftPath && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace' }}>
            {draftPath}
          </Typography>
        )}
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2, minHeight: height }}>
      <Stack spacing={2}>
        {/* 状态标题 */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            {getStatusIcon(status)}
            <Typography variant="h6" component="div">
              {getStatusText(status)}
            </Typography>
          </Stack>
          <Chip
            label={`${progressPercent.toFixed(1)}%`}
            color={getStatusColor(status)}
            size="small"
          />
        </Stack>

        {/* 进度条 */}
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1
            }
          }}
        />

        {/* 详细信息 */}
        {showDetails && progress && (
          <Stack direction="row" spacing={3} sx={{ pt: 1 }}>
            {/* 文件数 */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <DownloadIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {progress.completed_files} / {progress.total_files} 个文件
              </Typography>
            </Stack>

            {/* 下载速度 */}
            {status === TaskStatus.DOWNLOADING && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <SpeedIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {speedText}
                </Typography>
              </Stack>
            )}

            {/* 预计剩余时间 */}
            {status === TaskStatus.DOWNLOADING && progress.eta_seconds !== null && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <TimeIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  剩余 {etaText}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}

        {/* 失败文件提示 */}
        {progress && progress.failed_files > 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            <Typography variant="caption">
              {progress.failed_files} 个文件下载失败
            </Typography>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
