import React from 'react';
import { Plus, Eye } from 'lucide-react';
import type { TimelineAction, TimelineRow } from '@xzdarcy/react-timeline-editor';

export interface TimelineContextMenuState {
  mouseX: number;
  mouseY: number;
  action: TimelineAction | null;
  row: TimelineRow | null;
}

interface TimelineContextMenuProps {
  contextMenu: TimelineContextMenuState | null;
  onClose: () => void;
  onAddToRuleGroup: () => void;
  onOpenPreviewFile: () => void;
}

/**
 * 片段右键菜单
 */
export function TimelineContextMenu({
  contextMenu,
  onClose,
  onAddToRuleGroup,
  onOpenPreviewFile,
}: TimelineContextMenuProps) {
  if (contextMenu === null) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="fixed z-50 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg py-1"
        style={{ left: contextMenu.mouseX, top: contextMenu.mouseY, maxHeight: '300px' }}
      >
        <button
          onClick={onAddToRuleGroup}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)]"
        >
          <Plus size={16} />
          添加到规则组
        </button>
        <button
          onClick={onOpenPreviewFile}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)]"
        >
          <Eye size={16} />
          打开预览文件
        </button>
      </div>
    </>
  );
}
