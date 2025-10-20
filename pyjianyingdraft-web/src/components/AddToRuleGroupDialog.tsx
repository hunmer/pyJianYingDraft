'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import type { Rule, RuleGroup } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';

interface AddToRuleGroupDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 当前选中的素材 */
  material: MaterialInfo | null;
  /** 当前规则组 */
  ruleGroup: RuleGroup | null;
  /** 添加成功回调 */
  onSuccess: (updatedRuleGroup: RuleGroup) => void;
  /** 正在编辑的规则 */
  editingRule: Rule | null;
}

/**
 * 添加到预设组对话框
 */
export const AddToRuleGroupDialog: React.FC<AddToRuleGroupDialogProps> = ({
  open,
  onClose,
  material,
  ruleGroup,
  onSuccess,
  editingRule
}) => {
  // 表单状态
  const [ruleType, setRuleType] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [error, setError] = useState('');

  // 调试日志
  useEffect(() => {
    console.log('[AddToRuleGroupDialog] Props 更新:');
    console.log('[AddToRuleGroupDialog] open:', open);
    console.log('[AddToRuleGroupDialog] material:', material);
    console.log('[AddToRuleGroupDialog] ruleGroup:', ruleGroup);
  }, [open, material, ruleGroup]);

  // 重置表单
  const resetForm = () => {
    if (editingRule) {
      setRuleType(editingRule.type);
      setRuleTitle(editingRule.title);
    } else {
      setRuleType('');
      setRuleTitle('');
    }
    setError('');
  };

  // 当对话框打开/关闭时重置表单
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, editingRule]);

  // 验证表单
  const validateForm = (): boolean => {
    setError('');

    if (!ruleGroup) {
      setError('请先选择规则组');
      return false;
    }

    if (!ruleType.trim()) {
      setError('请输入规则类型');
      return false;
    }

    if (!ruleTitle.trim()) {
      setError('请输入规则标题');
      return false;
    }

    // 检查规则类型是否重复（编辑模式下排除当前规则）
    if (ruleGroup.rules.some(r => 
      r.type === ruleType.trim() && 
      (!editingRule || r.type !== editingRule.type)
    )) {
      setError('规则类型已存在于当前规则组');
      return false;
    }

    return true;
  };

  // 处理提交
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    if (!ruleGroup) {
      return;
    }

    // 创建/更新规则
    const updatedRule: Rule = {
      type: ruleType.trim(),
      title: ruleTitle.trim(),
      material_ids: editingRule ? [...editingRule.material_ids] : (material ? [material.id] : [])
    };

    // 更新规则组
    const updatedRuleGroup: RuleGroup = {
      ...ruleGroup,
      rules: editingRule 
        ? ruleGroup.rules.map(r => r.type === editingRule.type ? updatedRule : r)
        : [...ruleGroup.rules, updatedRule],
      updatedAt: new Date().toISOString()
    };

    // 保存到localStorage
    try {
      const saved = localStorage.getItem('ruleGroups');
      const allGroups: RuleGroup[] = saved ? JSON.parse(saved) : [];
      const updatedGroups = allGroups.map(g =>
        g.id === updatedRuleGroup.id ? updatedRuleGroup : g
      );
      localStorage.setItem('ruleGroups', JSON.stringify(updatedGroups));

      onSuccess(updatedRuleGroup);
      onClose();
    } catch (err: any) {
      setError('保存失败: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editingRule ? '编辑规则' : '添加到预设组'}</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* 规则组信息 */}
          {ruleGroup ? (
            <Alert severity="info">
              将添加到规则组: <strong>{ruleGroup.title}</strong>
            </Alert>
          ) : (
            <Alert severity="warning">
              请先在预设组标签页中选择一个规则组
            </Alert>
          )}

          {/* 素材信息 */}
          {material && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                当前素材
              </Typography>
              <Typography variant="body2">
                ID: {material.id}
              </Typography>
              <Typography variant="body2">
                类型: {material.type}
              </Typography>
              {material.name && (
                <Typography variant="body2">
                  名称: {material.name}
                </Typography>
              )}
            </Box>
          )}

          <Divider />

          {/* 规则类型 */}
          <TextField
            fullWidth
            label="规则类型"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            placeholder="例如: video-intro"
            helperText="唯一标识此规则的类型名称(英文,中划线分隔)"
            required
          />

          {/* 规则标题 */}
          <TextField
            fullWidth
            label="规则标题"
            value={ruleTitle}
            onChange={(e) => setRuleTitle(e.target.value)}
            placeholder="例如: 视频开场动画"
            helperText="规则的显示标题(中文)"
            required
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!ruleGroup}
        >
          {editingRule ? '保存修改' : '添加规则'} {!ruleGroup && '(无规则组)'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddToRuleGroupDialog;
