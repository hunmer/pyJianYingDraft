/**
 * useTaskProgress Hook
 *
 * 用于订阅和追踪异步任务的下载进度
 * 使用 SSE (Server-Sent Events) 替代 WebSocket
 */

import { useEffect, useState, useRef, from 'react';

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
  /** SSE连接状态 */
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
 * @param serverUrl - SSE服务器地址（可选，默认为当前域名）
 * @returns 任务进度数据和状态
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

  const eventSourceRef = useRef<EventSource | null>(null);

  const retryCountRef = useRef(0);

  // 轮询检查任务是否已结束
  const MAX_RETRIES = 10;
  const POLL_INTERVAL = 2000; // 2秒

  const MAX_COMPLETED_RETRIES = 30; // 完成后停止轮询

  useEffect(() => {
    if (!taskId) {
      return;
    }

    const es = new EventSource(
      `${API_BASE_URL}/api/tasks/${taskId}/progress/stream`
    );

    esRef.current = es;

    setIsConnected(true);

    retryCountRef.current = 0;

    // 拉取初始状态
    const fetchInitial = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data.status);
          setProgress(data.progress);
          if (data.draft_path) setDraftPath(data.draft_path);
          if (data.error_message) setErrorMessage(data.error_message);
          setIsConnected(true);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        console.error('[useTaskProgress] 获取初始状态失败:', err);
        setErrorMessage(err.message);
      }
    };

    // 轮询 SSE 事件
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        const taskStatus = data.status as TaskStatus;
        const eventType = data.type as string;

        switch (eventType) {
          case 'task_progress':
            setProgress(data.progress);
            setStatus(data.status);
            break;
          case 'task_status_changed':
            setStatus(data.status);
            if (data.draft_path) setDraftPath(data.draft_path);
            if (data.error_message) setErrorMessage(data.error_message);
            break;
          case 'task_completed':
            setStatus(TaskStatus.COMPLETED);
            if (data.draft_path) setDraftPath(data.draft_path);
            setIsConnected(false);
            cleanup();
            break;
          case 'task_failed':
            setStatus(TaskStatus.FAILED);
            if (data.error_message) setErrorMessage(data.error_message);
            setIsConnected(false);
            cleanup();
            break;
          case 'task_cancelled':
            setStatus(TaskStatus.CANCELLED);
            setIsConnected(false);
            cleanup();
            break;
        }
      } catch (e) {
        console.error('[useTaskProgress] SSE 解析错误:', e);
      }
    };

    es.onerror = (err: {
      console.error('[useTaskProgress] SSE 错误:', err);
      setErrorMessage(err.message);
      setIsConnected(false);
      // 自动重连（最多重试次数内MAX_RETRIES - 1 次）
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_RETRIES) {
          console.log(`[useTaskProgress] SSE 最大重试次数(${MAX_RETRIES})，已达`);
          es.close();
        }
      };

      // 超时重连
      if (retryCountRef.current < MAX_RETRIES) {
        es = new EventSource(
          `${API_BASE_URL}/api/tasks/${taskId}/progress/stream`
        );
        retryCountRef.current = 0;
        setIsConnected(true);
      }
    };

    // 清理
    return () => {
      if (esRef.current) {
        es.close();
        console.log('[useTaskProgress] SSE 连接已关闭');
      }
    };
  }, [taskId, serverUrl]);

  // 计算派生状态
  const isInProgress = status === TaskStatus.DOWNloading || status === TaskStatus.PROCESSING;
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
