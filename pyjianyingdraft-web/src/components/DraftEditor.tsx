'use client';

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import {
  PlayArrow,
  Videocam,
  AudioFile,
} from '@mui/icons-material';
import TimelineEditor from './Timeline';
import type { TabData } from '@/hooks/useTabs';

interface DraftEditorProps {
  tab: TabData;
  onRuleGroupsUpdate: (tabId: string, groups: any[]) => void;
  onTestDataSelect: (
    testDataId: string,
    label: string,
    onTest: (testData: any) => Promise<any>,
    context?: any
  ) => void;
}

export const DraftEditor: React.FC<DraftEditorProps> = ({
  tab,
  onRuleGroupsUpdate,
  onTestDataSelect,
}) => {
  if (!tab.draftInfo || tab.loading || tab.error) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* 时间轴编辑器 - 占满页面 */}
      {(tab.tracks || []).length > 0 && (
        <TimelineEditor
          tracks={tab.tracks || []}
          materials={tab.materials || []}
          duration={tab.draftInfo.duration_seconds}
          rawDraft={tab.rawDraft ?? undefined}
          rawMaterials={tab.materialCategories ?? undefined}
          canvasWidth={tab.draftInfo.width}
          canvasHeight={tab.draftInfo.height}
          fps={tab.draftInfo.fps}
          readOnly={true}
          draftPath={tab.draftPath}
          initialRuleGroups={tab.ruleGroups ?? undefined}
          onRuleGroupsChange={(groups) => onRuleGroupsUpdate(tab.id, groups)}
          handleTestDataSelect={onTestDataSelect}
          draftInfo={tab.draftInfo}
        />
      )}
    </Box>
  );
};