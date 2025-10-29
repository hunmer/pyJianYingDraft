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
    <>
      {/* 草稿信息卡片 */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PlayArrow color="primary" />
                  <Typography variant="h6">时长</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {tab.draftInfo.duration_seconds.toFixed(2)}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(tab.draftInfo.duration / 1000000).toFixed(0)} 微秒
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Videocam color="primary" />
                  <Typography variant="h6">轨道</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {tab.draftInfo.track_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(tab.tracks || []).filter(t => t.type === 'video').length} 视频 /{' '}
                  {(tab.tracks || []).filter(t => t.type === 'audio').length} 音频 /{' '}
                  {(tab.tracks || []).filter(t => t.type === 'text').length} 文本
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AudioFile color="primary" />
                  <Typography variant="h6">素材</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {(tab.materials || []).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(tab.materials || []).filter(m => m.type === 'video').length} 视频 /{' '}
                  {(tab.materials || []).filter(m => m.type === 'audio').length} 音频 /{' '}
                  {(tab.materials || []).filter(m => m.type === 'text').length} 文本
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* 时间轴编辑器 */}
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
        />
      )}
    </>
  );
};