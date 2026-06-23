'use client';

import React from 'react';
import { Button, Tooltip, Tabs } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import CodeMirrorEditor from '@/components/CodeMirrorEditor';
import SnapshotManager from '@/components/SnapshotManager';
import type { Snapshot } from '@/hooks/useSnapshots';

interface DataPanelProps {
  rightTabValue: number;
  onTabChange: (value: number) => void;
  jsonData: string;
  onJsonDataChange: (data: string) => void;
  jsonSnapshots: Snapshot[];
  onCreateSnapshot: (name: string, description?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRenameSnapshot: (snapshotId: string, newName: string) => void;
  onFormatJson: () => void;
  executionResult: any;
  onEditorMount: (view: any) => void;
}

const RIGHT_TABS = ['输入数据', '输出数据'];

/**
 * 右侧数据面板：输入数据(JSON参数编辑器) / 输出数据(执行结果)
 */
export default function DataPanel({
  rightTabValue,
  onTabChange,
  jsonData,
  onJsonDataChange,
  jsonSnapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  onFormatJson,
  executionResult,
  onEditorMount,
}: DataPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border border-[var(--border)] rounded-md h-full flex flex-col">
        <Tabs
          selectedKey={String(rightTabValue)}
          onSelectionChange={(key) => onTabChange(Number(key))}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="数据面板">
              {RIGHT_TABS.map((label, idx) => (
                <Tabs.Tab key={idx} id={String(idx)} className="text-[var(--foreground)]">
                  {label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="0" className="flex-1 overflow-hidden pt-4">
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-semibold">
                  JSON参数编辑器
                </div>
                <div className="flex gap-1 items-center">
                  <SnapshotManager
                    snapshots={jsonSnapshots}
                    onCreateSnapshot={onCreateSnapshot}
                    onRestoreSnapshot={onRestoreSnapshot}
                    onDeleteSnapshot={onDeleteSnapshot}
                    onRenameSnapshot={onRenameSnapshot}
                  />
                  <div className="mx-2 self-stretch border-l border-[var(--border)]" />
                  <Tooltip delay={0}>
                    <Button isIconOnly variant="ghost" size="sm" onPress={onFormatJson}>
                      <RefreshCw size={18} />
                    </Button>
                    <Tooltip.Content>格式化JSON</Tooltip.Content>
                  </Tooltip>
                </div>
              </div>

              <div className="flex-1 border border-[var(--border)] rounded-md overflow-hidden">
                <CodeMirrorEditor
                  height="100%"
                  language="json"
                  value={jsonData}
                  onChange={(value) => onJsonDataChange(value || '')}
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
          </Tabs.Panel>
          <Tabs.Panel id="1" className="flex-1 overflow-hidden pt-4">
            <div className="h-full flex flex-col">
              <div className="text-sm font-semibold mb-2">
                执行结果
              </div>

              <div className="flex-1 border border-[var(--border)] rounded-md overflow-hidden">
                {executionResult ? (
                  <CodeMirrorEditor
                    height="100%"
                    language="json"
                    value={JSON.stringify(executionResult, null, 2)}
                    onChange={() => {}} // 输出结果只读
                    theme="light"
                    readOnly={true}
                    options={{
                      lineNumbers: true,
                      lineWrapping: true,
                      tabSize: 2,
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                    <div className="text-sm">
                      暂无执行结果，请先执行代码
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
