'use client';

import React, { useState } from 'react';
import { Button, Tooltip } from '@heroui/react';
import {
  Camera as CameraAltIcon,
  RotateCcw as RestoreIcon,
  Trash2 as DeleteIcon,
  Pencil as EditIcon,
  History as HistoryIcon,
  ChevronDown as ArrowDropDownIcon,
} from 'lucide-react';
import type { Snapshot } from '@/hooks/useSnapshots';

interface SnapshotManagerProps {
  snapshots: Snapshot[];
  onCreateSnapshot: (name: string, description?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRenameSnapshot?: (snapshotId: string, newName: string) => void;
  disabled?: boolean;
}

export default function SnapshotManager({
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  disabled = false,
}: SnapshotManagerProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const menuOpen = Boolean(menuAnchor);

  // 打开创建快照对话框
  const handleOpenCreateDialog = () => {
    setMenuAnchor(null);
    setSnapshotName(`快照 ${new Date().toLocaleString('zh-CN')}`);
    setSnapshotDescription('');
    setCreateDialogOpen(true);
  };

  // 创建快照
  const handleCreateSnapshot = () => {
    if (!snapshotName.trim()) {
      return;
    }
    onCreateSnapshot(snapshotName.trim(), snapshotDescription.trim() || undefined);
    setCreateDialogOpen(false);
    setSnapshotName('');
    setSnapshotDescription('');
  };

  // 打开重命名对话框
  const handleOpenRenameDialog = (snapshot: Snapshot) => {
    setMenuAnchor(null);
    setSelectedSnapshotId(snapshot.id);
    setSnapshotName(snapshot.name);
    setRenameDialogOpen(true);
  };

  // 重命名快照
  const handleRenameSnapshot = () => {
    if (!snapshotName.trim() || !selectedSnapshotId || !onRenameSnapshot) {
      return;
    }
    onRenameSnapshot(selectedSnapshotId, snapshotName.trim());
    setRenameDialogOpen(false);
    setSnapshotName('');
    setSelectedSnapshotId(null);
  };

  // 恢复快照
  const handleRestoreSnapshot = (snapshotId: string) => {
    setMenuAnchor(null);
    onRestoreSnapshot(snapshotId);
  };

  // 删除快照
  const handleDeleteSnapshot = (snapshotId: string) => {
    setMenuAnchor(null);
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (snapshot && confirm(`确定要删除快照"${snapshot.name}"吗？`)) {
      onDeleteSnapshot(snapshotId);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="flex gap-2 items-center">
        <Button
          size="sm"
          variant="ghost"
          onPress={handleOpenCreateDialog}
          isDisabled={disabled}
        >
          <CameraAltIcon size={16} />
          创建快照
        </Button>

        {snapshots.length > 0 && (
          <>
            <Button
              size="sm"
              variant="ghost"
              endContent={<ArrowDropDownIcon size={16} />}
              onPress={(e) => setMenuAnchor(e.currentTarget as HTMLElement)}
              isDisabled={disabled}
            >
              <HistoryIcon size={16} />
              快照 ({snapshots.length})
            </Button>

            {menuOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuAnchor(null)}
                onContextMenu={(e) => { e.preventDefault(); setMenuAnchor(null); }}
              >
                <div
                  className="absolute z-50 min-w-[320px] max-w-[400px] bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg"
                  style={{
                    top: (menuAnchor?.getBoundingClientRect().bottom ?? 0) + 4,
                    left: menuAnchor?.getBoundingClientRect().left ?? 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-2">
                    <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                      已保存的快照
                    </span>
                  </div>
                  <div className="border-b border-[var(--border)]" />

                  {snapshots.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      暂无快照
                    </div>
                  ) : (
                    snapshots
                      .slice()
                      .reverse()
                      .map((snapshot) => (
                        <div key={snapshot.id}>
                          <div
                            onClick={() => handleRestoreSnapshot(snapshot.id)}
                            className="px-4 py-3 flex items-start hover:bg-[var(--muted)] cursor-pointer"
                          >
                            <div className="flex-1 mr-2">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-semibold">
                                  {snapshot.name}
                                </span>
                                <span className="text-[0.7rem] leading-5 px-2 rounded border border-[var(--border)]">
                                  {formatTime(snapshot.timestamp)}
                                </span>
                              </div>
                              {snapshot.description && (
                                <span className="block text-xs text-[var(--muted-foreground)]">
                                  {snapshot.description}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {onRenameSnapshot && (
                                <Tooltip delay={0}>
                                  <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    onPress={(e) => {
                                      (e as unknown as React.MouseEvent).stopPropagation();
                                      handleOpenRenameDialog(snapshot);
                                    }}
                                  >
                                    <EditIcon size={14} />
                                  </Button>
                                  <Tooltip.Content>重命名</Tooltip.Content>
                                </Tooltip>
                              )}
                              <Tooltip delay={0}>
                                <Button
                                  isIconOnly
                                  variant="ghost"
                                  size="sm"
                                  onPress={(e) => {
                                    (e as unknown as React.MouseEvent).stopPropagation();
                                    handleDeleteSnapshot(snapshot.id);
                                  }}
                                >
                                  <DeleteIcon size={14} />
                                </Button>
                                <Tooltip.Content>删除</Tooltip.Content>
                              </Tooltip>
                            </div>
                          </div>
                          <div className="border-b border-[var(--border)]" />
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 创建快照对话框 */}
      {createDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCreateDialogOpen(false)}
        >
          <div
            className="bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
              创建快照
            </div>
            <div className="px-4 py-4 flex flex-col gap-4">
              <div className="p-3 rounded-md border border-blue-300 bg-blue-50 text-blue-800 text-sm">
                快照将保存当前的编辑内容，您可以随时恢复到任意快照状态
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">快照名称 *</label>
                <input
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="例如: 测试版本1"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">描述（可选）</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={snapshotDescription}
                  onChange={(e) => setSnapshotDescription(e.target.value)}
                  placeholder="简要描述这个快照的内容"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onPress={() => setCreateDialogOpen(false)}>
                取消
              </Button>
              <Button
                size="sm"
                onPress={handleCreateSnapshot}
              >
                <CameraAltIcon size={16} />
                创建
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 重命名快照对话框 */}
      {renameDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRenameDialogOpen(false)}
        >
          <div
            className="bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
              重命名快照
            </div>
            <div className="px-4 py-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">新名称 *</label>
                <input
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onPress={() => setRenameDialogOpen(false)}>
                取消
              </Button>
              <Button
                size="sm"
                onPress={handleRenameSnapshot}
              >
                <EditIcon size={16} />
                确定
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
