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
  Button,
  Chip,
  Tooltip,
  Paper,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { RuleGroup, Rule } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';
import { AddToRuleGroupDialog } from './AddToRuleGroupDialog';


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
  /** 规则组更新成功回调 */
  onSuccess?: (updatedRuleGroup: RuleGroup) => void;
  /** 需要高亮显示的规则类型 */
  highlightedTypes?: Set<string>;
  /** 规则点击回调函数 */
  onRuleClick?: (rule: Rule, ruleIndex: number) => void;
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
  onSuccess = () => {},
  highlightedTypes = new Set(),
  onRuleClick,
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

  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    ruleIndex: number;
  } | null>(null);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRuleIndex, setDeletingRuleIndex] = useState<number | null>(null);

  // 编辑规则组对话框状态
  const [editRuleGroupDialogOpen, setEditRuleGroupDialogOpen] = useState(false);
  const [editedRuleGroupTitle, setEditedRuleGroupTitle] = useState('');
  const [editedRuleGroupDescription, setEditedRuleGroupDescription] = useState('');

  // 处理右键菜单打开
  const handleContextMenu = (event: React.MouseEvent, ruleIndex: number) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      ruleIndex,
    });
  };

  // 关闭右键菜单
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // 处理删除规则
  const handleDeleteRule = (ruleIndex: number) => {
    setDeletingRuleIndex(ruleIndex);
    setDeleteDialogOpen(true);
    handleCloseContextMenu();
  };

  // 确认删除规则
  const confirmDeleteRule = async () => {
    if (!ruleGroup || deletingRuleIndex === null) {
      return;
    }

    const updatedRules = ruleGroup.rules.filter((_, index) => index !== deletingRuleIndex);
    const updatedRuleGroup: RuleGroup = {
      ...ruleGroup,
      rules: updatedRules,
      updatedAt: new Date().toISOString(),
    };

    try {
      onSuccess(updatedRuleGroup);
      setSnackbar({ open: true, message: '规则删除成功' });
    } catch (error) {
      console.error('删除规则失败:', error);
      setSnackbar({ open: true, message: '删除规则失败' });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingRuleIndex(null);
    }
  };

  // 打开编辑规则组对话框
  const handleEditRuleGroup = () => {
    if (ruleGroup) {
      setEditedRuleGroupTitle(ruleGroup.title);
      setEditedRuleGroupDescription(ruleGroup.description || '');
      setEditRuleGroupDialogOpen(true);
    }
  };

  // 保存规则组编辑
  const handleSaveRuleGroup = () => {
    if (!ruleGroup) return;

    const updatedRuleGroup: RuleGroup = {
      ...ruleGroup,
      title: editedRuleGroupTitle.trim() || ruleGroup.title,
      description: editedRuleGroupDescription.trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      onSuccess(updatedRuleGroup);
      setSnackbar({ open: true, message: '规则组更新成功' });
      setEditRuleGroupDialogOpen(false);
    } catch (error) {
      console.error('更新规则组失败:', error);
      setSnackbar({ open: true, message: '更新规则组失败' });
    }
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

  // 计算单个规则中未找到的素材数量
  const countRuleMissingMaterials = (rule: Rule): number => {
    return rule.material_ids.filter(id => !findMaterial(id)).length;
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
      <Box>
        <Box sx={{ mt: 1 }}>
          <Tabs value={0} variant="scrollable" scrollButtons="auto">
            <Tab label={material.id} />
          </Tabs>
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Object.keys(material).map((key) => (
                <Tooltip 
                  key={`tooltip-${key}`}
                  title={`${key}: ${JSON.stringify(material[key as keyof MaterialInfo])}`}
                  arrow
                >
                  <Chip
                    label={key}
                    size="small"
                    variant="outlined"
                    onClick={() => copyToClipboard(key, key)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {customTitle || ruleGroup.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="编辑规则组">
              <IconButton
                size="small"
                color="primary"
                onClick={handleEditRuleGroup}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => {
                setEditingRule(null);
                setEditDialogOpen(true);
              }}
            >
              添加
            </Button>
          </Box>
        </Box>
      )}

      {ruleGroup.rules.length > 0 ? (
        <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
          {ruleGroup.rules.map((rule, index) => {
            const isExpanded = expandedRules.has(index);
            const hasMaterials = rule.material_ids.length > 0;
            const isHighlighted = highlightedTypes.has(rule.type);

            return (
              <React.Fragment key={index}>
                <ListItem
                  divider={index < ruleGroup.rules.length - 1 || isExpanded}
                  onContextMenu={(e) => handleContextMenu(e, index)}
                  onClick={() => onRuleClick?.(rule, index)}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    cursor: onRuleClick ? 'pointer' : 'context-menu',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500} color="text.primary">
                          {rule.title || '未命名'}
                        </Typography>
                        {countRuleMissingMaterials(rule) > 0 && (
                          <Tooltip title={`有 ${countRuleMissingMaterials(rule)} 个素材未找到`} arrow>
                            <Chip
                              label={`未找到: ${countRuleMissingMaterials(rule)}`}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ fontSize: 10, height: 20 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        类型: {rule.type}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {isHighlighted && (
                        <Chip
                          label="已添加"
                          size="small"
                          color="success"
                          sx={{ mr: 1, fontSize: 10, height: 20 }}
                        />
                      )}
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
                      <Tooltip title="编辑规则">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingRule(rule);
                            setEditDialogOpen(true);
                          }}
                          sx={{ ml: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 1, pl: 0 }}>
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

      {/* 编辑对话框 */}
      <AddToRuleGroupDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingRule(null);
        }}
        material={null}
        ruleGroup={ruleGroup}
        onSuccess={onSuccess}
        editingRule={editingRule}
        onSaveRuleGroup={async (updatedRuleGroup) => {
          // 调用父组件的 onSuccess 回调来更新规则组
          await onSuccess(updatedRuleGroup);
        }}
      />

      {/* 右键菜单 */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (contextMenu !== null && ruleGroup) {
              const rule = ruleGroup.rules[contextMenu.ruleIndex];
              setEditingRule(rule);
              setEditDialogOpen(true);
              handleCloseContextMenu();
            }
          }}
        >
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          编辑规则
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (contextMenu !== null) {
              handleDeleteRule(contextMenu.ruleIndex);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          删除节点
        </MenuItem>
      </Menu>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deletingRuleIndex !== null && ruleGroup
              ? `确定要删除规则 "${ruleGroup.rules[deletingRuleIndex]?.title}" 吗?此操作不可撤销。`
              : '确定要删除此规则吗?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={confirmDeleteRule} color="error" variant="contained">
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑规则组对话框 */}
      <Dialog
        open={editRuleGroupDialogOpen}
        onClose={() => setEditRuleGroupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>编辑规则组</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="规则组标题"
              fullWidth
              value={editedRuleGroupTitle}
              onChange={(e) => setEditedRuleGroupTitle(e.target.value)}
              placeholder="请输入规则组标题"
              required
            />
            <TextField
              label="规则组描述"
              fullWidth
              multiline
              rows={3}
              value={editedRuleGroupDescription}
              onChange={(e) => setEditedRuleGroupDescription(e.target.value)}
              placeholder="请输入规则组描述(可选)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRuleGroupDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleSaveRuleGroup}
            variant="contained"
            color="primary"
            disabled={!editedRuleGroupTitle.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

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
