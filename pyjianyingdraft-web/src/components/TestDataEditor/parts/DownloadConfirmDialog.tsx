'use client';

import React from 'react';
import { Button } from '@heroui/react';

interface DownloadConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmNormal: () => void;
  onConfirmCompressed: () => void;
}

/** 下载 JSON 文件格式选择对话框（普通 / 压缩并转义） */
export default function DownloadConfirmDialog({
  open,
  onClose,
  onConfirmNormal,
  onConfirmCompressed,
}: DownloadConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--background)] border border-[var(--border)] rounded-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
          下载JSON文件
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-4 pt-1">
            <div className="text-sm">
              请选择下载格式:
            </div>
            <div className="p-3 rounded-md border border-blue-300 bg-blue-50 text-blue-800 text-sm">
              <div className="mb-1">
                <strong>普通格式:</strong> JSON紧凑单行,无换行
              </div>
              <div>
                <strong>压缩并转义:</strong> JSON紧凑单行 + 转义所有双引号(\")
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>取消</Button>
          <Button variant="outline" onPress={onConfirmNormal}>
            普通格式
          </Button>
          <Button variant="primary" onPress={onConfirmCompressed}>
            压缩并转义
          </Button>
        </div>
      </div>
    </div>
  );
}
