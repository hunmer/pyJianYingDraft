'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { TabData } from '@/hooks/useTabs';

interface TabManagerProps {
  tabs: TabData[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTabContextMenu: (event: React.MouseEvent, tabId: string) => void;
}

export const TabManager: React.FC<TabManagerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onCloseTab,
  onTabContextMenu,
}) => {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center flex-1 min-w-0">
      <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        {tabs.map(tab => {
          const active = activeTabId === tab.id;
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              onContextMenu={(e) => onTabContextMenu(e, tab.id)}
              className={
                'group flex items-center gap-1 flex-shrink-0 px-3 py-1.5 rounded-md cursor-pointer whitespace-nowrap text-sm transition-colors ' +
                (active
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--muted)]')
              }
              style={{ minWidth: 120, maxWidth: 200 }}
            >
              <span className="overflow-hidden text-ellipsis flex-1 min-w-0">
                {tab.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className={
                  'flex items-center justify-center w-5 h-5 rounded-full transition-colors ' +
                  (active
                    ? 'hover:bg-black/10'
                    : 'hover:bg-[var(--muted-foreground)]/20')
                }
                aria-label="关闭标签"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
