'use client';

import React from 'react';
import { Box, Typography, List, ListItem, ListItemText } from '@mui/material';
import type { RuleGroup } from '@/types/rule';

/**
 * 规则组列表组件的Props
 */
interface RuleGroupListProps {
  /** 规则组数据 */
  ruleGroup: RuleGroup | null;
  /** 是否显示标题 */
  showTitle?: boolean;
  /** 自定义标题 */
  customTitle?: string;
}

/**
 * 规则组列表组件
 * 展示规则组的详细信息和规则列表
 */
export const RuleGroupList: React.FC<RuleGroupListProps> = ({
  ruleGroup,
  showTitle = true,
  customTitle,
}) => {
  if (!ruleGroup) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          请选择一个规则组
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {showTitle && (
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {customTitle || `当前规则组: ${ruleGroup.title}`}
        </Typography>
      )}

      {ruleGroup.rules.length > 0 ? (
        <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
          {ruleGroup.rules.map((rule, index) => (
            <ListItem key={index} divider={index < ruleGroup.rules.length - 1}>
              <ListItemText
                primary={rule.title}
                secondary={
                  <>
                    类型: {rule.type} | 输入字段: {Object.keys(rule.inputs).join(', ')} | 素材数: {rule.material_ids.length}
                  </>
                }
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            当前规则组没有规则
          </Typography>
        </Box>
      )}
    </>
  );
};

export default RuleGroupList;
