'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { Save, X } from 'lucide-react';

interface SaveDatasetDialogProps {
  open: boolean;
  error: string;
  datasetName: string;
  datasetDescription: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onClearError: () => void;
}

/** 保存测试数据集对话框（名称 + 描述，重名则更新） */
export default function SaveDatasetDialog({
  open,
  error,
  datasetName,
  datasetDescription,
  onNameChange,
  onDescriptionChange,
  onClose,
  onSave,
  onClearError,
}: SaveDatasetDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--background)] border border-[var(--border)] rounded-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
          保存测试数据集
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-4 pt-1">
            {error && (
              <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex justify-between items-start gap-2">
                <div className="whitespace-pre-wrap">{error}</div>
                <button onClick={onClearError} className="text-red-600 hover:text-red-800 shrink-0">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">数据集名称 <span className="text-red-600">*</span></label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => onNameChange(e.target.value)}
                autoFocus
                placeholder="例如: 示例视频数据"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">描述(可选)</label>
              <textarea
                value={datasetDescription}
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={2}
                placeholder="简要描述这个数据集的用途"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="p-3 rounded-md border border-blue-300 bg-blue-50 text-blue-800 text-sm">
              如果数据集名称已存在,将会更新现有数据集
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>取消</Button>
          <Button variant="primary" onPress={onSave}>
            <Save size={16} />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
