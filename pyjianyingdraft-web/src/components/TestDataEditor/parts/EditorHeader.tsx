'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { RotateCcw } from 'lucide-react';
import type { Snapshot } from '@/hooks/useSnapshots';
import SnapshotManager from '@/components/SnapshotManager';

interface EditorHeaderProps {
  testDataId: string;
  onReset: () => void;
  snapshots: Snapshot[];
  onCreateSnapshot: (name: string, description?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRenameSnapshot: (snapshotId: string, newName: string) => void;
}

/** 顶部标题栏：重置按钮、实例 ID、快照管理 */
export default function EditorHeader({
  testDataId,
  onReset,
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
}: EditorHeaderProps) {
  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button size="sm" variant="outline" onPress={onReset} startContent={<RotateCcw size={16} />}>
            重置为示例数据
          </Button>
          <div className="text-xs text-[var(--muted-foreground)]">
            实例ID: {testDataId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SnapshotManager
            snapshots={snapshots}
            onCreateSnapshot={onCreateSnapshot}
            onRestoreSnapshot={onRestoreSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
            onRenameSnapshot={onRenameSnapshot}
          />
        </div>
      </div>
    </div>
  );
}
