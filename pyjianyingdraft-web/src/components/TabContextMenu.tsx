'use client';

import React from 'react';
import { RefreshCw, X, Eraser } from 'lucide-react';

interface TabContextMenuProps {
  open: boolean;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
  onRefresh: () => void;
  onCloseTab: () => void;
  onCloseOtherTabs: () => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  open,
  onClose,
  anchorPosition,
  onRefresh,
  onCloseTab,
  onCloseOtherTabs,
}) => {
  if (!open || !anchorPosition) {
    return null;
  }

  const menuItemClass =
    'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)] transition-colors';

  return (
    <>
      {/* 透明遮罩，捕获点击/右键以关闭菜单 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        className="fixed z-50 min-w-[160px] py-1 bg-[var(--popover)] text-[var(--popover-foreground)] border border-[var(--border)] rounded-md shadow-lg"
        style={{ top: anchorPosition.top, left: anchorPosition.left }}
      >
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => { onRefresh(); onClose(); }}>
          <RefreshCw size={14} />
          刷新
        </button>
        <div className="my-1 border-t border-[var(--border)]" />
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => { onCloseTab(); onClose(); }}>
          <X size={14} />
          关闭
        </button>
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => { onCloseOtherTabs(); onClose(); }}>
          <Eraser size={14} />
          关闭其他
        </button>
      </div>
    </>
  );
};
