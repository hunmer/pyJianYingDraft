'use client';

import React from 'react';
import { Button, Tooltip } from '@heroui/react';
import { AlignLeft, Plus } from 'lucide-react';

interface EditorToolbarProps {
  onFormat: () => void;
  onAddTracks: () => void;
  canAddTracks: boolean;
  highlightedCount: number;
}

/** 编辑器工具栏：格式化 JSON、一键添加轨道、规则类型匹配计数 */
export default function EditorToolbar({
  onFormat,
  onAddTracks,
  canAddTracks,
  highlightedCount,
}: EditorToolbarProps) {
  return (
    <div className="px-4 py-2 flex gap-2 items-center bg-[var(--muted)] border-b border-[var(--border)]">
      <Tooltip delay={0}>
        <Button isIconOnly variant="ghost" size="sm" onPress={onFormat}>
          <AlignLeft size={18} />
        </Button>
        <Tooltip.Content>格式化JSON</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={onAddTracks}
          isDisabled={!canAddTracks}
        >
          <Plus size={18} />
        </Button>
        <Tooltip.Content>一键添加轨道</Tooltip.Content>
      </Tooltip>
      <div className="ml-2 text-xs text-[var(--muted-foreground)]">
        {highlightedCount > 0 && `已匹配 ${highlightedCount} 个规则类型`}
      </div>
    </div>
  );
}
