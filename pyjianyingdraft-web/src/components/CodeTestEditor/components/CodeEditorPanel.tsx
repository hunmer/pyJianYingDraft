'use client';

import React from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Code, RefreshCw } from 'lucide-react';
import CodeMirrorEditor from '@/components/CodeMirrorEditor';
import SnapshotManager from '@/components/SnapshotManager';
import type { Snapshot } from '@/hooks/useSnapshots';
import { Language } from '../types';

interface CodeEditorPanelProps {
  language: Language;
  currentLangLabel: string;
  code: string;
  onCodeChange: (code: string) => void;
  codeSnapshots: Snapshot[];
  onCreateSnapshot: (name: string, description?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRenameSnapshot: (snapshotId: string, newName: string) => void;
  onLoadExample: () => void;
  onFormatCode: () => void;
  onEditorMount: (view: any) => void;
}

/**
 * 左侧代码编辑器面板：快照管理 + 示例/刷新按钮 + 编辑器
 */
export default function CodeEditorPanel({
  language,
  currentLangLabel,
  code,
  onCodeChange,
  codeSnapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  onLoadExample,
  onFormatCode,
  onEditorMount,
}: CodeEditorPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border border-[var(--border)] rounded-md h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-semibold">
            代码编辑器 ({currentLangLabel})
          </div>
          <div className="flex gap-1 items-center">
            <SnapshotManager
              snapshots={codeSnapshots}
              onCreateSnapshot={onCreateSnapshot}
              onRestoreSnapshot={onRestoreSnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
              onRenameSnapshot={onRenameSnapshot}
            />
            <div className="mx-2 self-stretch border-l border-[var(--border)]" />
            <Tooltip delay={0}>
              <Button isIconOnly variant="ghost" size="sm" onPress={onLoadExample}>
                <Code size={18} />
              </Button>
              <Tooltip.Content>{`加载${currentLangLabel}示例代码`}</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button isIconOnly variant="ghost" size="sm" onPress={onFormatCode}>
                <RefreshCw size={18} />
              </Button>
              <Tooltip.Content>刷新代码</Tooltip.Content>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 border border-[var(--border)] rounded-md overflow-hidden">
          <CodeMirrorEditor
            height="100%"
            language={language}
            value={code}
            onChange={(value) => onCodeChange(value || '')}
            theme="light"
            onMount={onEditorMount}
            options={{
              lineNumbers: true,
              lineWrapping: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}
