'use client';

import React from 'react';
import { X } from 'lucide-react';
import { DownloadProgressBar } from '@/components/DownloadProgressBar';

interface MessagePanelProps {
  error: string;
  success: string;
  /** 是否存在数据集（影响底部内边距，保持与原布局一致） */
  hasDatasets: boolean;
  showProgress: boolean;
  currentTaskId: string | null;
  onClearError: () => void;
  onClearSuccess: () => void;
  onTaskComplete: (draftPath: string) => void;
  onTaskError: (errorMsg: string) => void;
}

/** 错误 / 成功提示 + 异步任务下载进度条 */
export default function MessagePanel({
  error,
  success,
  hasDatasets,
  showProgress,
  currentTaskId,
  onClearError,
  onClearSuccess,
  onTaskComplete,
  onTaskError,
}: MessagePanelProps) {
  return (
    <div className={`p-4 ${hasDatasets ? '' : 'pb-0'} flex flex-col gap-2`}>
      {error && (
        <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex justify-between items-start gap-2">
          <div className="whitespace-pre-wrap">{error}</div>
          <button onClick={onClearError} className="text-red-600 hover:text-red-800 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md border border-green-300 bg-green-50 text-green-800 text-sm flex justify-between items-start gap-2">
          <div className="whitespace-pre-wrap">{success}</div>
          <button onClick={onClearSuccess} className="text-green-600 hover:text-green-800 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 异步任务下载进度 */}
      {showProgress && currentTaskId && (
        <div>
          <DownloadProgressBar
            taskId={currentTaskId}
            onComplete={onTaskComplete}
            onError={onTaskError}
            showDetails
          />
        </div>
      )}
    </div>
  );
}
