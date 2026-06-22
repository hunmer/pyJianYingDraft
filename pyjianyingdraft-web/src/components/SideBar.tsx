'use client';

import React from 'react';
import DraftList from './DraftList';
import { RuleGroupPanel } from './RuleGroupPanel';
import type { RuleGroup } from '@/types/rule';

const DRAWER_WIDTH = 280;

interface SideBarProps {
  open: boolean;
  selectedDraftPath?: string;
  ruleGroups: RuleGroup[];
  ruleGroupsLoading: boolean;
  ruleGroupsError: string | null;
  onDraftSelect: (draftPath: string, draftName: string) => void;
  onRulesUpdated: () => void;
  onDraftRootChanged: () => void;
  onRuleGroupsRefresh: () => void;
  onRuleGroupSelect: (
    ruleGroupId: string,
    ruleGroup: RuleGroup,
    onTest: (testData: any) => Promise<any>
  ) => void;
}

export const SideBar: React.FC<SideBarProps> = ({
  open,
  selectedDraftPath,
  ruleGroups,
  ruleGroupsLoading,
  ruleGroupsError,
  onDraftSelect,
  onRulesUpdated,
  onDraftRootChanged,
  onRuleGroupsRefresh,
  onRuleGroupSelect,
}) => {
  const [leftTabValue, setLeftTabValue] = React.useState<number>(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]"
      style={{
        width: open ? DRAWER_WIDTH : 0,
        transition: mounted ? 'width 0.2s' : 'none',
      }}
    >
      {/* 左侧栏 Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {['草稿列表', '规则组'].map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setLeftTabValue(idx)}
            className={
              'flex-1 px-3 py-2 text-sm font-medium transition-colors ' +
              (leftTabValue === idx
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="relative flex-1 overflow-hidden">
        {/* 草稿列表 */}
        <div
          className="absolute inset-0 overflow-auto"
          style={{ display: leftTabValue === 0 ? 'block' : 'none' }}
        >
          <DraftList
            onDraftSelect={onDraftSelect}
            onRulesUpdated={onRulesUpdated}
            onDraftRootChanged={onDraftRootChanged}
            selectedDraftPath={selectedDraftPath}
          />
        </div>

        {/* 规则组 */}
        <div
          className="absolute inset-0"
          style={{ display: leftTabValue === 1 ? 'flex' : 'none' }}
        >
          <RuleGroupPanel
            ruleGroups={ruleGroups}
            loading={ruleGroupsLoading}
            error={ruleGroupsError}
            onRefresh={onRuleGroupsRefresh}
            onRuleGroupSelect={onRuleGroupSelect}
          />
        </div>
      </div>
    </aside>
  );
};
