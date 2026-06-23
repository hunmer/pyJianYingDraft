'use client';

import React from 'react';
import { DownloadProgressBar } from '@/components/DownloadProgressBar';

interface MessagePanelProps {
  /** 是否存在数据集（影响底部内边距，保持与原布局一致） */
  hasDatasets: boolean;
  showProgress: boolean;
  currentTaskId: string | null;
  onTaskComplete: (draftPath: string) => void;
  onTaskError: (errorMsg: string) => void;
}

/** 异步任务下载进度条（成功/错误提示统一走全局 Toast） */
export default function MessagePanel({
  hasDatasets,
  showProgress,
  currentTaskId,
  onTaskComplete,
  onTaskError,
}: MessagePanelProps) {
  return (
    <div className={`${hasDatasets ? '' : 'pb-0'} flex flex-col gap-2`}>
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
