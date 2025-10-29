'use client';

import React, { useCallback } from 'react';
import {
  Box,
  List,
  Typography,
  Alert,
  CircularProgress,
  ListItemButton,
  ListItemText,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { RuleGroup } from '@/types/rule';

interface RuleGroupPanelProps {
  ruleGroups: RuleGroup[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRuleGroupSelect: (
    ruleGroupId: string,
    ruleGroup: RuleGroup,
    onTest: (testData: any) => Promise<any>
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
    // 创建一个实际可用的测试提交函数
    const handleRuleGroupTest = async (testData: any) => {
      console.log('规则组测试提交:', testData);

      // 调用后端 API 进行测试
      const response = await fetch('http://localhost:5000/api/test-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rule_group_id: group.id,
          test_data: testData,
        }),
      });

      if (!response.ok) {
        throw new Error(`测试失败: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('测试结果:', result);
      return result;
    };

    onRuleGroupSelect(group.id, group, handleRuleGroupTest);
  }, [onRuleGroupSelect]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* 规则组标题和刷新按钮 */}
      <Box sx={{
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography variant="h6">
          规则组
        </Typography>
        <Tooltip title="刷新规则组列表">
          <IconButton
            size="small"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 内容区域 */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">
            {error}
          </Alert>
        ) : ruleGroups.length ? (
          <List dense>
            {ruleGroups.map((group: RuleGroup) => (
              <ListItemButton
                key={group.id}
                onClick={() => handleRuleGroupClick(group)}
                sx={{
                  mb: 1,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <ListItemText
                  primary={group.title}
                  secondary={
                    <>
                      {group.rules.length} 条规则
                      {group.draft_name && (
                        <>
                          {' • '}
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontStyle: 'italic'
                            }}
                          >
                            来自: {group.draft_name}
                          </Typography>
                        </>
                      )}
                    </>
                  }
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              当前没有可用的规则组
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};