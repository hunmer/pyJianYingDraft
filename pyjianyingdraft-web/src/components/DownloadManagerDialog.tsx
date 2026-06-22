'use client';

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Button, Spinner } from '@heroui/react';
import { X, Settings, RefreshCw } from 'lucide-react';
import { useAria2WebSocket } from '@/hooks/useAria2WebSocket';
import PathSelector from '@/components/PathSelector';

// 异步加载下载管理器组件
const Aria2DownloadManager = lazy(() =>
  import('@/components/Aria2DownloadManager').then((module) => ({
    default: module.Aria2DownloadManager,
  }))
);

interface DownloadManagerDialogProps {
  open: boolean;
  onClose: () => void;
  initialTaskId?: string;
}

/**
 * 下载管理 Dialog 组件
 * 使用异步加载避免阻塞主页面
 */
export function DownloadManagerDialog({ open, onClose, initialTaskId }: DownloadManagerDialogProps) {
  const {
    connected,
    config,
    loading,
    getGroups,
    getConfig,
    updateConfig,
  } = useAria2WebSocket();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aria2PathInput, setAria2PathInput] = useState('');

  useEffect(() => {
    if (connected && open) {
      getGroups();
      getConfig();
    }
  }, [connected, open, getGroups, getConfig]);

  useEffect(() => {
    if (config) {
      setAria2PathInput(config.aria2Path || '');
    }
  }, [config]);

  const handleRefresh = () => {
    getGroups();
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };

  const handleSaveSettings = async () => {
    if (aria2PathInput.trim()) {
      await updateConfig(aria2PathInput.trim());
      setSettingsOpen(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <div
            className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl w-full max-w-4xl h-[80vh] max-h-[800px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 对话框标题栏 */}
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)] font-semibold">
              <span className="text-base">下载管理</span>
              <div className="flex items-center gap-1">
                {/* 连接状态 */}
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    connected
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {connected ? '已连接' : '未连接'}
                </span>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={handleRefresh}
                  isDisabled={loading}
                >
                  <RefreshCw size={18} />
                </Button>
                <Button isIconOnly variant="ghost" size="sm" onPress={handleOpenSettings}>
                  <Settings size={18} />
                </Button>
                <Button isIconOnly variant="ghost" size="sm" onPress={onClose}>
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* 对话框内容 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                }
              >
                <div className="flex-1 flex overflow-hidden">
                  <Aria2DownloadManager initialGroupId={initialTaskId} />
                </div>
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* 设置对话框 */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleCloseSettings}
        >
          <div
            className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl max-w-md w-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold">Aria2 设置</h2>
              <button
                type="button"
                onClick={handleCloseSettings}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <PathSelector
                value={aria2PathInput}
                onChange={setAria2PathInput}
                label="Aria2 路径"
                placeholder="例如: D:\aria2"
                dialogTitle="选择 Aria2 目录"
                buttonText="选择 Aria2 目录"
              />
              <p className="block mt-2 text-xs text-[var(--muted-foreground)]">
                请输入 aria2c.exe 所在的目录路径
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
              <Button variant="ghost" onPress={handleCloseSettings}>
                取消
              </Button>
              <Button
                onPress={handleSaveSettings}
                isDisabled={!aria2PathInput.trim()}
              >
                保存并重启 Aria2
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
