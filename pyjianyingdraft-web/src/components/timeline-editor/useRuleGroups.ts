import { useCallback, useEffect, useRef, useState } from 'react';
import type { RuleGroup } from '@/types/rule';
import { draftApi } from '@/lib/api';
import { toast } from '@heroui/react';
import { cloneRuleGroups } from './utils';

interface UseRuleGroupsOptions {
  draftPath?: string;
  initialRuleGroups?: RuleGroup[] | null;
  onRuleGroupsChange?: (ruleGroups: RuleGroup[]) => void;
}

/**
 * 规则组状态管理：加载、应用、持久化、规则保存
 */
export function useRuleGroups({ draftPath, initialRuleGroups, onRuleGroupsChange }: UseRuleGroupsOptions) {
  const [ruleGroups, setRuleGroups] = useState<RuleGroup[]>([]);
  const [selectedRuleGroup, setSelectedRuleGroup] = useState<RuleGroup | null>(null);
  const [savingRuleGroups, setSavingRuleGroups] = useState(false);

  const selectedRuleGroupIdRef = useRef<string | null>(null);
  const hasInitializedRuleGroups = useRef(false);
  const initialRuleGroupsSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    selectedRuleGroupIdRef.current = selectedRuleGroup?.id ?? null;
  }, [selectedRuleGroup]);

  useEffect(() => {
    hasInitializedRuleGroups.current = false;
    initialRuleGroupsSignatureRef.current = null;
  }, [draftPath]);

  const applyRuleGroups = useCallback(
    (groups: RuleGroup[]) => {
      const normalized = cloneRuleGroups(groups);
      setRuleGroups(normalized);
      const desiredId = selectedRuleGroupIdRef.current;
      const nextSelected =
        (desiredId && normalized.find(group => group.id === desiredId)) || normalized[0] || null;
      selectedRuleGroupIdRef.current = nextSelected?.id ?? null;
      setSelectedRuleGroup(nextSelected);
      initialRuleGroupsSignatureRef.current = JSON.stringify(normalized);
      onRuleGroupsChange?.(cloneRuleGroups(normalized));
    },
    [onRuleGroupsChange],
  );

  const persistRuleGroups = useCallback(
    async (nextGroups: RuleGroup[]) => {
      const snapshot = cloneRuleGroups(ruleGroups);
      const normalizedNext = cloneRuleGroups(nextGroups);
      applyRuleGroups(normalizedNext);
      if (!draftPath) {
        return;
      }
      setSavingRuleGroups(true);
      try {
        await draftApi.setDraftRuleGroups(draftPath, normalizedNext);
      } catch (error) {
        console.error('保存草稿规则组失败:', error);
        applyRuleGroups(snapshot);
        const message = error instanceof Error ? error.message : String(error);
        toast.danger(`保存规则组失败: ${message}`);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setSavingRuleGroups(false);
      }
    },
    [applyRuleGroups, draftPath, ruleGroups],
  );

  const handleRuleGroupRuleSave = useCallback(
    async (updatedRuleGroup: RuleGroup) => {
      const exists = ruleGroups.some(group => group.id === updatedRuleGroup.id);
      const nextGroups = exists
        ? ruleGroups.map(group => (group.id === updatedRuleGroup.id ? updatedRuleGroup : group))
        : [...ruleGroups, updatedRuleGroup];
      selectedRuleGroupIdRef.current = updatedRuleGroup.id;
      await persistRuleGroups(nextGroups);
    },
    [ruleGroups, persistRuleGroups],
  );

  useEffect(() => {
    if (initialRuleGroups !== undefined && initialRuleGroups !== null) {
      const signature = JSON.stringify(initialRuleGroups);
      if (initialRuleGroupsSignatureRef.current === signature) {
        hasInitializedRuleGroups.current = true;
        return;
      }
      initialRuleGroupsSignatureRef.current = signature;
      hasInitializedRuleGroups.current = true;
      if (initialRuleGroups.length > 0) {
        applyRuleGroups(initialRuleGroups);
      }
      return;
    }

    if (hasInitializedRuleGroups.current) {
      return;
    }

    if (!draftPath) {
      hasInitializedRuleGroups.current = true;
      return;
    }

    let cancelled = false;
    const fetchRuleGroups = async () => {
      try {
        const response = await draftApi.getDraftRuleGroups(draftPath);
        if (cancelled) {
          return;
        }
        hasInitializedRuleGroups.current = true;
        initialRuleGroupsSignatureRef.current = null;
        const groups = response.rule_groups ?? [];
        if (groups.length > 0) {
          applyRuleGroups(groups);
        }
      } catch (error) {
        console.error('加载草稿规则组失败:', error);
        if (!cancelled) {
          hasInitializedRuleGroups.current = true;
          initialRuleGroupsSignatureRef.current = null;
        }
      }
    };

    fetchRuleGroups();

    return () => {
      cancelled = true;
    };
  }, [draftPath, initialRuleGroups, applyRuleGroups]);

  return {
    ruleGroups,
    setRuleGroups,
    selectedRuleGroup,
    setSelectedRuleGroup,
    savingRuleGroups,
    applyRuleGroups,
    persistRuleGroups,
    handleRuleGroupRuleSave,
  };
}
