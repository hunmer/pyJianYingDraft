'use client';

import React from 'react';
import {
  Drawer,
  Tabs,
  Tab,
  Box,
} from '@mui/material';
import DraftList from './DraftList';
import FileVersionList, { type FileVersionListHandle } from './FileVersionList';
import { RuleGroupPanel } from './RuleGroupPanel';
import type { RuleGroup } from '@/types/rule';

const DRAWER_WIDTH = 280;

interface SideBarProps {
  open: boolean;
  selectedDraftPath?: string;
  selectedFilePath?: string;
  ruleGroups: RuleGroup[];
  ruleGroupsLoading: boolean;
  ruleGroupsError: string | null;
  onDraftSelect: (draftPath: string, draftName: string) => void;
  onRulesUpdated: () => void;
  onDraftRootChanged: () => void;
  onSetFileVersionWatch: (draftPath: string) => void;
  onFileSelect: (filePath: string) => void;
  onRuleGroupsRefresh: () => void;
  onRuleGroupSelect: (
    ruleGroupId: string,
    ruleGroup: RuleGroup,
    onTest: (testData: any) => Promise<any>
  ) => void;
  fileVersionListRef: React.RefObject<FileVersionListHandle>;
}

export const SideBar: React.FC<SideBarProps> = ({
  open,
  selectedDraftPath,
  selectedFilePath,
  ruleGroups,
  ruleGroupsLoading,
  ruleGroupsError,
  onDraftSelect,
  onRulesUpdated,
  onDraftRootChanged,
  onSetFileVersionWatch,
  onFileSelect,
  onRuleGroupsRefresh,
  onRuleGroupSelect,
  fileVersionListRef,
}) => {
  const [leftTabValue, setLeftTabValue] = React.useState<number>(0);

  return (
    <Drawer
      variant="persistent"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
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
        <Tab label="文件版本" />
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
            onSetFileVersionWatch={onSetFileVersionWatch}
            selectedDraftPath={selectedDraftPath}
          />
        </Box>

        {/* 文件版本 */}
        <Box sx={{
          display: leftTabValue === 1 ? 'block' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'auto'
        }}>
          <FileVersionList
            ref={fileVersionListRef}
            selectedFilePath={selectedFilePath}
            onFileSelect={onFileSelect}
          />
        </Box>

        {/* 规则组 */}
        <Box sx={{
          display: leftTabValue === 2 ? 'flex' : 'none',
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