'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { Download, Save, Play, ChevronDown } from 'lucide-react';

interface BottomActionsProps {
  canDownload: boolean;
  downloadMenuOpen: boolean;
  onToggleDownloadMenu: () => void;
  onDownloadBase: () => void;
  onDownloadFull: () => void;
  onSaveDataset: () => void;
  onTest: () => void;
  testing: boolean;
}

/** 底部操作栏：下载基础数据 + 下载菜单、保存数据集、运行测试 */
export default function BottomActions({
  canDownload,
  downloadMenuOpen,
  onToggleDownloadMenu,
  onDownloadBase,
  onDownloadFull,
  onSaveDataset,
  onTest,
  testing,
}: BottomActionsProps) {
  return (
    <div className="p-4 border-t border-[var(--border)] flex gap-2 justify-between">
      <div className="flex gap-2 relative">
        <div className="flex">
          <Button
            variant="outline"
            isDisabled={!canDownload}
            onPress={onDownloadBase}
          >
            <Download size={16} />
            下载基础数据
          </Button>
          <Button
            isIconOnly
            variant="outline"
            isDisabled={!canDownload}
            onPress={onToggleDownloadMenu}
            aria-expanded={downloadMenuOpen}
            aria-haspopup="menu"
            className="border-l-0"
          >
            <ChevronDown size={18} />
          </Button>
        </div>

        {/* 下载选项菜单 */}
        {downloadMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={onToggleDownloadMenu}
            />
            <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[200px] bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg">
              <button
                onClick={onDownloadFull}
                className="w-full text-left px-3 py-2 hover:bg-[var(--muted)] text-sm"
              >
                <div className="font-medium">下载完整数据</div>
                <div className="text-xs text-[var(--muted-foreground)]">包含请求的items</div>
              </button>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          onPress={onSaveDataset}
          variant="outline"
        >
          <Save size={16} />
          保存数据集
        </Button>
        <Button
          onPress={onTest}
          variant="primary"
          isDisabled={testing}
          data-testid="test-run-button"
        >
          <Play size={16} />
          {testing ? '测试中...' : '运行测试'}
        </Button>
      </div>
    </div>
  );
}
