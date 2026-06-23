/**
 * DownloadProgressBar组件
 *
 * 可视化显示下载进度、速度和预计剩余时间
 */

import React from 'react';
import {
  DownloadCloud as DownloadIcon,
  Gauge as SpeedIcon,
  Clock as TimeIcon,
  CheckCircle as CheckIcon,
  XCircle as ErrorIcon,
  Ban as CancelIcon,
} from 'lucide-react';
import { Label, ProgressBar } from '@heroui/react';
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
 * 获取状态 class
 */
function getStatusClass(status: TaskStatus | null): string {
  switch (status) {
    case TaskStatus.DOWNLOADING:
    case TaskStatus.PROCESSING:
      return 'bg-blue-100 text-blue-800';
    case TaskStatus.COMPLETED:
      return 'bg-green-100 text-green-800';
    case TaskStatus.FAILED:
      return 'bg-red-100 text-red-800';
    case TaskStatus.CANCELLED:
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
  }
}

/**
 * 获取状态图标
 */
function getStatusIcon(status: TaskStatus | null) {
  switch (status) {
    case TaskStatus.DOWNLOADING:
      return <DownloadIcon size={20} />;
    case TaskStatus.PROCESSING:
      return <DownloadIcon size={20} />;
    case TaskStatus.COMPLETED:
      return <CheckIcon size={20} />;
    case TaskStatus.FAILED:
      return <ErrorIcon size={20} />;
    case TaskStatus.CANCELLED:
      return <CancelIcon size={20} />;
    default:
      return <DownloadIcon size={20} />;
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

  // 连接状态警告 - 仅在任务进行中才提示断开
  if (!isConnected && isInProgress) {
    return (
      <div className="mb-4 p-3 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm">
        SSE连接中断，正在重新连接...
      </div>
    );
  }

  // 失败状态
  if (isFailed) {
    return (
      <div className="mb-4 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex items-start gap-2">
        <ErrorIcon size={20} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold">任务失败</div>
          {errorMessage && (
            <div className="block text-xs mt-0.5">{errorMessage}</div>
          )}
        </div>
      </div>
    );
  }

  // 完成状态
  if (isCompleted) {
    return (
      <div className="mb-4 p-3 rounded-md border border-green-300 bg-green-50 text-green-800 text-sm flex items-start gap-2">
        <CheckIcon size={20} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold">任务已完成！</div>
          {draftPath && (
            <div className="block text-xs mt-0.5 font-mono">{draftPath}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-md p-4 mb-4 flex flex-col gap-4"
      style={{ minHeight: height }}
    >
      {/* 进度条（含状态标题与百分比） */}
      <ProgressBar aria-label="任务进度" value={progressPercent}>
        <Label className="flex flex-row gap-2 items-center text-base font-semibold">
          {getStatusIcon(status)}
          {getStatusText(status)}
        </Label>
        <ProgressBar.Output className={`px-2 py-0.5 text-xs rounded ${getStatusClass(status)}`}>
          {progressPercent.toFixed(1)}%
        </ProgressBar.Output>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      {/* 详细信息 */}
      {showDetails && progress && (
        <div className="flex flex-row gap-6 pt-1">
          {/* 文件数 */}
          <div className="flex flex-row gap-1 items-center">
            <DownloadIcon size={16} className="text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">
              {progress.completed_files} / {progress.total_files} 个文件
            </span>
          </div>

          {/* 下载速度 */}
          {status === TaskStatus.DOWNLOADING && (
            <div className="flex flex-row gap-1 items-center">
              <SpeedIcon size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-xs text-[var(--muted-foreground)]">{speedText}</span>
            </div>
          )}

          {/* 预计剩余时间 */}
          {status === TaskStatus.DOWNLOADING && progress.eta_seconds !== null && (
            <div className="flex flex-row gap-1 items-center">
              <TimeIcon size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-xs text-[var(--muted-foreground)]">剩余 {etaText}</span>
            </div>
          )}
        </div>
      )}

      {/* 失败文件提示 */}
      {progress && progress.failed_files > 0 && (
        <div className="mt-1 p-3 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-800 text-xs">
          {progress.failed_files} 个文件下载失败
        </div>
      )}
    </div>
  );
}
