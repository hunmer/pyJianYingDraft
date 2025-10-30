'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  History as HistoryIcon,
  Code as CodeIcon,
  Speed as RunningIcon,
} from '@mui/icons-material';
import { CozeWorkflow } from '@/types/coze';

interface WorkflowCardProps {
  workflow: CozeWorkflow;
  isSelected?: boolean;
  isExecuting?: boolean;
  onExecute: () => void;
  onHistory: () => void;
  onSelect: () => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  isSelected = false,
  isExecuting = false,
  onExecute,
  onHistory,
  onSelect,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card
      onClick={onSelect}
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        backgroundColor: isSelected ? 'action.selected' : 'background.paper',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ pb: 2 }}>
        {/* 头部信息 */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ flex: 1, mr: 1 }}>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 600,
                lineHeight: 1.2,
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {workflow.name}
            </Typography>
          </Box>

          {/* 运行状态指示器 */}
          {isExecuting && (
            <Tooltip title="正在执行">
              <RunningIcon
                color="warning"
                sx={{
                  fontSize: 24,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 },
                  },
                }}
              />
            </Tooltip>
          )}
        </Box>

        {/* 描述 */}
        {workflow.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
            }}
          >
            {workflow.description}
          </Typography>
        )}

        {/* 元信息 */}
        <Box sx={{ mb: 2 }}>
          {workflow.updated_time !== workflow.created_time && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              更新时间: {formatDate(workflow.updated_time * 1000)}
            </Typography>
          )}
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<ExecuteIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            disabled={isExecuting}
            sx={{ flex: 1 }}
          >
            {isExecuting ? '执行中' : '执行'}
          </Button>

          <Tooltip title="执行历史">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onHistory();
              }}
              sx={{
                border: 1,
                borderColor: 'divider',
              }}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 输入输出信息 */}
        {(workflow.input_schema || workflow.output_schema) && (
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            {workflow.input_schema && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                ✓ 支持输入参数
              </Typography>
            )}
            {workflow.output_schema && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                ✓ 支持结构化输出
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowCard;