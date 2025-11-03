'use client';

import React from 'react';
import {
  Drawer,
  Tabs,
  Tab,
  Box,
} from '@mui/material';
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
    <Drawer
      variant="persistent"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        transition: mounted ? 'width 0.2s' : 'none',
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          transition: mounted ? 'transform 0.2s' : 'none',
          transform: mounted && !open ? `translateX(-${DRAWER_WIDTH}px)` : 'translateX(0)',
        },
      }}
    >
      {/* 左侧栏Tabs */}
      <Tabs
        value={leftTabValue}
        onChange={(_, newValue) => setLeftTabValue(newValue)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="草稿列表" />
        <Tab label="规则组" />
      </Tabs>

      {/* Tab内容 */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* 草稿列表 */}
        <Box sx={{
          display: leftTabValue === 0 ? 'block' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'auto'
        }}>
          <DraftList
            onDraftSelect={onDraftSelect}
            onRulesUpdated={onRulesUpdated}
            onDraftRootChanged={onDraftRootChanged}
            selectedDraftPath={selectedDraftPath}
          />
        </Box>

        {/* 规则组 */}
        <Box sx={{
          display: leftTabValue === 1 ? 'flex' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}>
          <RuleGroupPanel
            ruleGroups={ruleGroups}
            loading={ruleGroupsLoading}
            error={ruleGroupsError}
            onRefresh={onRuleGroupsRefresh}
            onRuleGroupSelect={onRuleGroupSelect}
          />
        </Box>
      </Box>
    </Drawer>
  );
};