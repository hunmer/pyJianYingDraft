'use client';

import React, { useCallback } from 'react';
import { Button, Tooltip, Spinner } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import type { RuleGroup } from '@/types/rule';

interface RuleGroupPanelProps {
  ruleGroups: RuleGroup[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRuleGroupSelect: (
    ruleGroupId: string,
    ruleGroup: RuleGroup
  ) => void;
}

export const RuleGroupPanel: React.FC<RuleGroupPanelProps> = ({
  ruleGroups,
  loading,
  error,
  onRefresh,
  onRuleGroupSelect,
}) => {
  const handleRuleGroupClick = useCallback((group: RuleGroup) => {
    onRuleGroupSelect(group.id, group);
  }, [onRuleGroupSelect]);

  return (
    <div className="flex flex-col w-full h-full">
      {/* 规则组标题和刷新按钮 */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h2 className="text-base font-semibold">规则组</h2>
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={onRefresh}
            isDisabled={loading}
          >
            <RefreshCw size={16} />
          </Button>
          <Tooltip.Content placement="bottom">刷新规则组列表</Tooltip.Content>
        </Tooltip>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
        {loading ? (
          <div className="flex justify-center pt-8">
            <Spinner />
          </div>
        ) : error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        ) : ruleGroups.length ? (
          <div className="flex flex-col gap-1">
            {ruleGroups.map((group: RuleGroup) => (
              <button
                key={group.id}
                type="button"
                onClick={() => handleRuleGroupClick(group)}
                className="px-3 py-2 mb-1 text-left rounded-md hover:bg-[var(--muted)] transition-colors"
              >
                <div className="font-medium text-sm">{group.title}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {group.rules.length} 条规则
                  {group.draft_name && (
                    <span className="italic"> {' • '} 来自: {group.draft_name}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            当前没有可用的规则组
          </div>
        )}
      </div>
    </div>
  );
};
