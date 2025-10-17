'use client';

import React, { useState, useEffect } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Divider,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { RuleGroup, Rule } from '@/types/rule';
import { DEFAULT_RULES } from '@/config/defaultRules';

interface RuleGroupSelectorProps {
  /** 当前选中的规则组 */
  value: RuleGroup | null;
  /** 选择变化回调 */
  onChange: (ruleGroup: RuleGroup | null) => void;
}

/**
 * 规则组选择器组件
 */
export const RuleGroupSelector: React.FC<RuleGroupSelectorProps> = ({ value, onChange }) => {
  const [ruleGroups, setRuleGroups] = useState<RuleGroup[]>([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [createError, setCreateError] = useState('');

  // 初始化:创建默认规则组
  useEffect(() => {
    const defaultGroup: RuleGroup = {
      id: 'default',
      title: '默认规则组',
      rules: DEFAULT_RULES,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 从 localStorage 加载已保存的规则组
    const savedGroups = loadRuleGroupsFromStorage();

    // 如果没有默认规则组,添加它
    const hasDefault = savedGroups.some(g => g.id === 'default');
    const allGroups = hasDefault ? savedGroups : [defaultGroup, ...savedGroups];

    setRuleGroups(allGroups);

    // 如果没有选中的规则组,默认选中第一个
    if (!value && allGroups.length > 0) {
      onChange(allGroups[0]);
    }
  }, []);

  // 保存规则组到 localStorage
  const saveRuleGroupsToStorage = (groups: RuleGroup[]) => {
    try {
      localStorage.setItem('ruleGroups', JSON.stringify(groups));
    } catch (error) {
      console.error('Failed to save rule groups:', error);
    }
  };

  // 从 localStorage 加载规则组
  const loadRuleGroupsFromStorage = (): RuleGroup[] => {
    try {
      const saved = localStorage.getItem('ruleGroups');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load rule groups:', error);
      return [];
    }
  };

  // 处理创建新规则组
  const handleCreateRuleGroup = () => {
    setCreateError('');

    if (!newGroupTitle.trim()) {
      setCreateError('请输入规则组标题');
      return;
    }

    // 检查标题是否重复
    if (ruleGroups.some(g => g.title === newGroupTitle.trim())) {
      setCreateError('规则组标题已存在');
      return;
    }

    const newGroup: RuleGroup = {
      id: `group_${Date.now()}`,
      title: newGroupTitle.trim(),
      rules: [], // 新建规则组默认为空
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedGroups = [...ruleGroups, newGroup];
    setRuleGroups(updatedGroups);
    saveRuleGroupsToStorage(updatedGroups);

    // 自动选中新创建的规则组
    onChange(newGroup);

    // 重置对话框
    setNewGroupTitle('');
    setOpenCreateDialog(false);
  };

  // 处理删除规则组
  const handleDeleteRuleGroup = (groupId: string) => {
    // 不允许删除默认规则组
    if (groupId === 'default') {
      return;
    }

    const updatedGroups = ruleGroups.filter(g => g.id !== groupId);
    setRuleGroups(updatedGroups);
    saveRuleGroupsToStorage(updatedGroups);

    // 如果删除的是当前选中的规则组,切换到第一个
    if (value?.id === groupId) {
      onChange(updatedGroups.length > 0 ? updatedGroups[0] : null);
    }
  };

  // 处理选择变化
  const handleChange = (event: any) => {
    const selectedId = event.target.value;
    const selectedGroup = ruleGroups.find(g => g.id === selectedId) || null;
    onChange(selectedGroup);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="rule-group-select-label">选择规则组</InputLabel>
        <Select
          labelId="rule-group-select-label"
          id="rule-group-select"
          value={value?.id || ''}
          label="选择规则组"
          onChange={handleChange}
        >
          {ruleGroups.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="body2">
                  {group.title} ({group.rules.length})
                </Typography>
                {group.id !== 'default' && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRuleGroup(group.id);
                    }}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setOpenCreateDialog(true)}
        sx={{ whiteSpace: 'nowrap' }}
      >
        新建
      </Button>

      {/* 创建规则组对话框 */}
      <Dialog
        open={openCreateDialog}
        onClose={() => {
          setOpenCreateDialog(false);
          setNewGroupTitle('');
          setCreateError('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>创建新规则组</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {createError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createError}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              label="规则组标题"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              placeholder="例如: 视频标准模板"
              helperText="为新规则组输入一个有意义的标题"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenCreateDialog(false);
              setNewGroupTitle('');
              setCreateError('');
            }}
          >
            取消
          </Button>
          <Button onClick={handleCreateRuleGroup} variant="contained">
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RuleGroupSelector;
