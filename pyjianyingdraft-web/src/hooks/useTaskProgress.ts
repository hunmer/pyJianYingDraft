/**
 * useTaskProgress Hook
 *
 * 用于订阅和追踪异步任务的下载进度
 */

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// API基础URL配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export enum TaskStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface DownloadProgress {
  total_files: number;
  completed_files: number;
  failed_files: number;
  active_files: number;
  total_size: number;
  downloaded_size: number;
  progress_percent: number;
  download_speed: number;
  eta_seconds: number | null;
}

export interface TaskProgressData {
  task_id: string;
  status: TaskStatus;
  progress: DownloadProgress | null;
  draft_path?: string;
  error_message?: string;
  updated_at?: string;
  completed_at?: string;
}

export interface UseTaskProgressReturn {
  /** 任务状态 */
  status: TaskStatus | null;
  /** 下载进度 */
  progress: DownloadProgress | null;
  /** 草稿路径（完成时） */
  draftPath: string | null;
  /** 错误消息（失败时） */
  errorMessage: string | null;
  /** WebSocket连接状态 */
  isConnected: boolean;
  /** 是否正在进行中 */
  isInProgress: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 是否失败 */
  isFailed: boolean;
  /** 格式化的进度百分比 */
  progressPercent: number;
  /** 格式化的下载速度 */
  speedText: string;
  /** 格式化的预计剩余时间 */
  etaText: string;
}

/**
 * 格式化文件大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化时间（秒）
 */
function formatSeconds(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
}

/**
 * 订阅任务进度更新
 *
 * @param taskId - 任务ID
 * @param serverUrl - Socket.IO服务器地址，默认为当前域名
 * @returns 任务进度数据和状态
 *
 * @example
 * ```tsx
 * function DownloadStatus({ taskId }: { taskId: string }) {
 *   const {
 *     status,
 *     progress,
 *     progressPercent,
 *     speedText,
 *     isCompleted
 *   } = useTaskProgress(taskId);
 *
 *   if (isCompleted) {
 *     return <div>下载完成！</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <div>状态: {status}</div>
 *       <div>进度: {progressPercent}%</div>
 *       <div>速度: {speedText}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTaskProgress(
  taskId: string | null,
  serverUrl?: string
): UseTaskProgressReturn {
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [draftPath, setDraftPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    // 创建Socket.IO连接
    const socket = io(serverUrl || API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    // 连接成功
    socket.on('connect', () => {
      console.log('[useTaskProgress] Socket.IO已连接');
      setIsConnected(true);

      // 订阅任务进度
      socket.emit('subscribe_task', { task_id: taskId });
    });

    // 连接断开
    socket.on('disconnect', () => {
      console.log('[useTaskProgress] Socket.IO已断开');
      setIsConnected(false);
    });

    // 订阅成功
    socket.on('task_subscribed', (data: TaskProgressData) => {
      console.log('[useTaskProgress] 订阅成功:', data);
      setStatus(data.status);
      setProgress(data.progress);
    });

    // 进度更新
    socket.on('task_progress', (data: TaskProgressData) => {
      console.log('[useTaskProgress] 进度更新:', data);
      setStatus(data.status);
      setProgress(data.progress);
    });

    // 状态变更
    socket.on('task_status_changed', (data: TaskProgressData) => {
      console.log('[useTaskProgress] 状态变更:', data);
      setStatus(data.status);
      if (data.draft_path) {
        setDraftPath(data.draft_path);
      }
      if (data.error_message) {
        setErrorMessage(data.error_message);
      }
    });

    // 任务完成
    socket.on('task_completed', (data: TaskProgressData) => {
      console.log('[useTaskProgress] 任务完成:', data);
      setStatus(TaskStatus.COMPLETED);
      if (data.draft_path) {
        setDraftPath(data.draft_path);
      }
    });

    // 任务失败
    socket.on('task_failed', (data: TaskProgressData) => {
      console.log('[useTaskProgress] 任务失败:', data);
      setStatus(TaskStatus.FAILED);
      if (data.error_message) {
        setErrorMessage(data.error_message);
      }
    });

    // 任务取消
    socket.on('task_cancelled', (data: TaskProgressData) => {
      console.log('[useTaskProgress] 任务已取消:', data);
      setStatus(TaskStatus.CANCELLED);
    });

    // 订阅错误
    socket.on('subscribe_error', (data: { error: string }) => {
      console.error('[useTaskProgress] 订阅错误:', data.error);
      setErrorMessage(data.error);
    });

    // 清理函数
    return () => {
      if (socket) {
        socket.emit('unsubscribe_task', { task_id: taskId });
        socket.disconnect();
      }
    };
  }, [taskId, serverUrl]);

  // 计算派生状态
  const isInProgress = status === TaskStatus.DOWNLOADING || status === TaskStatus.PROCESSING;
  const isCompleted = status === TaskStatus.COMPLETED;
  const isFailed = status === TaskStatus.FAILED;
  const progressPercent = progress?.progress_percent || 0;
  const speedText = progress?.download_speed
    ? `${formatBytes(progress.download_speed)}/s`
    : '--';
  const etaText = formatSeconds(progress?.eta_seconds || null);

  return {
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
  };
}
