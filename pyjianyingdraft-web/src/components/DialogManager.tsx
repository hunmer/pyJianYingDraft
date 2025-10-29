'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// 异步加载下载管理器 Dialog
const DownloadManagerDialog = dynamic(
  () => import('@/components/DownloadManagerDialog').then((mod) => ({ default: mod.DownloadManagerDialog })),
  { ssr: false }
);

// 异步加载生成记录 Dialog
const GenerationRecordsDialog = dynamic(
  () => import('@/components/GenerationRecordsDialog').then((mod) => ({ default: mod.GenerationRecordsDialog })),
  { ssr: false }
);

interface DialogManagerProps {
  downloadDialogOpen: boolean;
  generationRecordsDialogOpen: boolean;
  activeDownloadTaskId?: string;
  onCloseDownloadDialog: () => void;
  onCloseGenerationRecordsDialog: () => void;
  onReimport: (record: any) => void;
  onOpenDownloadManager: (taskId?: string) => void;
}

export const DialogManager: React.FC<DialogManagerProps> = ({
  downloadDialogOpen,
  generationRecordsDialogOpen,
  activeDownloadTaskId,
  onCloseDownloadDialog,
  onCloseGenerationRecordsDialog,
  onReimport,
  onOpenDownloadManager,
}) => {
  return (
    <>
      {/* 下载管理器 Dialog */}
      <DownloadManagerDialog
        open={downloadDialogOpen}
        onClose={onCloseDownloadDialog}
        initialTaskId={activeDownloadTaskId}
      />

      {/* 生成记录 Dialog */}
      <GenerationRecordsDialog
        open={generationRecordsDialogOpen}
        onClose={onCloseGenerationRecordsDialog}
        onReimport={onReimport}
        onOpenDownloadManager={onOpenDownloadManager}
      />
    </>
  );
};