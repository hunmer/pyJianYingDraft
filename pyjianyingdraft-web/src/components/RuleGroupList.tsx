'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
  Chip,
  Tooltip,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import type { RuleGroup } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';

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
  /** 素材数据列表（用于查找material详情） */
  materials?: MaterialInfo[];
}

/**
 * 规则组列表组件
 * 展示规则组的详细信息和规则列表
 */
export const RuleGroupList: React.FC<RuleGroupListProps> = ({
  ruleGroup,
  showTitle = true,
  customTitle,
  materials = [],
}) => {
  // 展开状态：记录每个规则的展开状态
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());
  // 复制提示状态
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  // 切换规则的展开状态
  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRules(newExpanded);
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setSnackbar({ open: true, message: `已复制: ${label}` });
      },
      (err) => {
        console.error('复制失败:', err);
        setSnackbar({ open: true, message: '复制失败' });
      }
    );
  };

  // 根据 material_id 查找素材详情
  const findMaterial = (materialId: string): MaterialInfo | undefined => {
    return materials.find(({id}) => id === materialId);
  };

  // 生成素材的展示内容（用于 Tooltip）
  const getMaterialTooltipContent = (material: MaterialInfo): string => {
    const lines: string[] = [];
    lines.push(`类型: ${material.type}`);
    lines.push(`ID: ${material.id}`);
    if (material.name) lines.push(`名称: ${material.name}`);
    if (material.path) lines.push(`路径: ${material.path}`);
    if (material.duration_seconds !== undefined) {
      lines.push(`时长: ${material.duration_seconds.toFixed(2)}秒`);
    }
    if (material.width && material.height) {
      lines.push(`尺寸: ${material.width} × ${material.height}`);
    }
    return lines.join('\n');
  };

  // 渲染素材 Chip
  const renderMaterialChip = (materialId: string) => {
    const material = findMaterial(materialId);

    if (!material) {
      return (
        <Tooltip title={`素材未找到: ${materialId}`} arrow>
          <Chip
            label="未找到"
            size="small"
            color="error"
            variant="outlined"
            sx={{ m: 0.5 }}
          />
        </Tooltip>
      );
    }

    // 获取素材类型的颜色
    const getTypeColor = (type: string): 'primary' | 'success' | 'warning' | 'info' | 'error' => {
      const colorMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'error'> = {
        video: 'primary',
        audio: 'success',
        text: 'warning',
        image: 'info',
        effect: 'secondary' as any,
        filter: 'error',
      };
      return colorMap[type] || 'primary';
    };

    const tooltipContent = getMaterialTooltipContent(material);
    const label = material.name || material.id.slice(0, 8);

    return (
      <Tooltip title={tooltipContent} arrow>
        <Chip
          label={label}
          size="small"
          color={getTypeColor(material.type)}
          icon={<ContentCopyIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => copyToClipboard(material.id, material.name || material.id)}
          sx={{
            m: 0.5,
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.8,
            },
          }}
        />
      </Tooltip>
    );
  };

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
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          {customTitle || `当前规则组: ${ruleGroup.title}`}
        </Typography>
      )}

      {ruleGroup.rules.length > 0 ? (
        <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
          {ruleGroup.rules.map((rule, index) => {
            const isExpanded = expandedRules.has(index);
            const hasMaterials = rule.material_ids.length > 0;

            return (
              <React.Fragment key={index}>
                <ListItem
                  divider={index < ruleGroup.rules.length - 1 || isExpanded}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ListItemText
                      primary={rule.title}
                      secondary={
                        <>
                          类型: {rule.type} | 输入字段: {Object.keys(rule.inputs).join(', ')} | 素材数:{' '}
                          {rule.material_ids.length}
                        </>
                      }
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    {hasMaterials && (
                      <Tooltip title={isExpanded ? '收起素材' : '查看素材'}>
                        <IconButton
                          size="small"
                          onClick={() => toggleExpand(index)}
                          sx={{ ml: 1 }}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 1, pl: 0 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}
                      >
                        关联素材 ({rule.material_ids.length}):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {rule.material_ids.map((materialId) => (
                          <React.Fragment key={materialId}>
                            {renderMaterialChip(materialId)}
                          </React.Fragment>
                        ))}
                      </Box>
                    </Box>
                  </Collapse>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            当前规则组没有规则
          </Typography>
        </Box>
      )}

      {/* 复制成功提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RuleGroupList;
