'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Typography,
  Divider,
  Alert,
  ButtonGroup,
  Menu,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import SaveIcon from '@mui/icons-material/Save';
import type { RuleGroup } from '@/types/rule';

interface RuleGroupSelectorProps {
  /** 当前选中的规则组 */
  value: RuleGroup | null;
  /** 选择变化回调 */
  onChange: (ruleGroup: RuleGroup | null) => void;
  /** 所有可用的规则组 */
  ruleGroups: RuleGroup[];
  /** 规则组变更回调 */
  onRuleGroupsChange?: (ruleGroups: RuleGroup[]) => void;
  /** 保存到草稿目录 */
  onSaveToDraft?: (ruleGroups: RuleGroup[]) => Promise<void> | void;
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 显示加载状态 */
  loading?: boolean;
}

const buildRuleGroupTitle = (title: string, index: number): string =>
  title || `未命名规则组 ${index + 1}`;

const cloneRuleGroups = (groups: RuleGroup[]): RuleGroup[] =>
  groups.map((group) => ({
    ...group,
    rules: Array.isArray(group.rules) ? group.rules.map(rule => ({ ...rule })) : [],
  }));

export const RuleGroupSelector: React.FC<RuleGroupSelectorProps> = ({
  value,
  onChange,
  ruleGroups,
  onRuleGroupsChange,
  onSaveToDraft,
  disabled = false,
  loading = false,
}) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [createError, setCreateError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localRuleGroups, setLocalRuleGroups] = useState<RuleGroup[]>(ruleGroups);
  const selectionId = useMemo(() => value?.id ?? null, [value]);

  useEffect(() => {
    setLocalRuleGroups(cloneRuleGroups(ruleGroups));
  }, [ruleGroups]);

  useEffect(() => {
    if (localRuleGroups.length === 0) {
      onChange(null);
      return;
    }
    const currentId = selectionId;
    if (currentId) {
      const match = localRuleGroups.find(group => group.id === currentId);
      if (match) {
        onChange(match);
        return;
      }
    }
    onChange(localRuleGroups[0]);
  }, [localRuleGroups, selectionId, onChange]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const emitGroups = (nextGroups: RuleGroup[]) => {
    const normalized = cloneRuleGroups(nextGroups);
    setLocalRuleGroups(normalized);
    onRuleGroupsChange?.(cloneRuleGroups(normalized));
  };

  const handleCreateRuleGroup = () => {
    setCreateError('');
    if (!newGroupTitle.trim()) {
      setCreateError('请输入规则组标题');
      return;
    }

    if (localRuleGroups.some(group => group.title === newGroupTitle.trim())) {
      setCreateError('规则组标题已存在');
      return;
    }

    const now = new Date().toISOString();
    const newGroup: RuleGroup = {
      id: `group_${Date.now()}`,
      title: newGroupTitle.trim(),
      rules: [],
      createdAt: now,
      updatedAt: now,
    };
    emitGroups([...localRuleGroups, newGroup]);
    onChange(newGroup);
    setNewGroupTitle('');
    setOpenCreateDialog(false);
  };

  const handleDeleteRuleGroup = (groupId: string) => {
    const nextGroups = localRuleGroups.filter(group => group.id !== groupId);
    emitGroups(nextGroups);
    if (value?.id === groupId) {
      onChange(nextGroups[0] ?? null);
    }
  };

  const handleNewRuleGroup = () => {
    handleMenuClose();
    setOpenCreateDialog(true);
  };

  const handleCloneRuleGroup = () => {
    handleMenuClose();
    if (!value) {
      alert('请先选择一个规则组');
      return;
    }
    const now = new Date().toISOString();
    const cloned: RuleGroup = {
      ...value,
      id: `group_${Date.now()}`,
      title: `${value.title || '未命名规则组'} (副本)`,
      rules: value.rules.map(rule => ({ ...rule })),
      createdAt: now,
      updatedAt: now,
    };
    emitGroups([...localRuleGroups, cloned]);
    onChange(cloned);
  };

  const handleImportRuleGroup = () => {
    handleMenuClose();
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.name.endsWith('.json')) {
      alert('请选择 JSON 格式的文件');
      return;
    }
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported.title || !Array.isArray(imported.rules)) {
        alert('文件格式无效：缺少必要字段');
        return;
      }
      let finalTitle = String(imported.title);
      let counter = 1;
      while (localRuleGroups.some(group => group.title === finalTitle)) {
        finalTitle = `${imported.title} (${counter})`;
        counter += 1;
      }
      const now = new Date().toISOString();
      const newGroup: RuleGroup = {
        id: `group_${Date.now()}`,
        title: finalTitle,
        rules: imported.rules,
        createdAt: now,
        updatedAt: now,
      };
      emitGroups([...localRuleGroups, newGroup]);
      onChange(newGroup);
      alert(`规则组 "${finalTitle}" 导入成功`);
    } catch (error) {
      console.error('导入规则组失败:', error);
      alert('导入失败，请检查文件格式');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadRuleGroup = () => {
    handleMenuClose();
    if (!value) {
      alert('请先选择一个规则组');
      return;
    }
    const data = {
      ...value,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = value.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    link.href = url;
    link.download = `${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteCurrentRuleGroup = () => {
    handleMenuClose();
    if (!value) {
      alert('请先选择一个规则组');
      return;
    }
    if (value.id === 'default') {
      alert('无法删除默认规则组');
      return;
    }
    if (confirm(`确定要删除规则组 "${value.title}" 吗？此操作不可恢复。`)) {
      handleDeleteRuleGroup(value.id);
    }
  };

  const handleSaveToDraft = async () => {
    if (!onSaveToDraft) {
      return;
    }
    await onSaveToDraft(localRuleGroups);
  };

  const handleChange = (
    event: React.ChangeEvent<{ value: unknown }> | 
    (Event & { target: { value: string; name: string } })
  ) => {
    const value = 'target' in event ? event.target.value : event.value;
    const selectedId = typeof value === 'string' ? value : String(value);
    const selectedGroup = localRuleGroups.find(group => group.id === selectedId) ?? null;
    onChange(selectedGroup);
  };

  const renderSelectLabel = (index: number, group: RuleGroup) =>
    `${buildRuleGroupTitle(group.title, index)} (${group.rules.length})`;

  const isSaveDisabled = disabled || loading || !onSaveToDraft;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <FormControl fullWidth size="small" disabled={disabled || loading}>
        <InputLabel id="rule-group-select-label">选择规则组</InputLabel>
        <Select
          labelId="rule-group-select-label"
          id="rule-group-select"
          value={value?.id ?? ''}
          label="选择规则组"
          onChange={handleChange}
        >
          {localRuleGroups.map((group, index) => (
            <MenuItem key={group.id} value={group.id}>
              <Typography variant="body2">
                {renderSelectLabel(index, group)}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <ButtonGroup variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
        <Button
          size="small"
          aria-label="更多选项"
          aria-controls={menuOpen ? 'rule-group-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={handleMenuClick}
          disabled={disabled || loading}
          sx={{ width: 40, minWidth: 40, px: 0 }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Menu
        id="rule-group-menu"
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'rule-group-button',
        }}
      >
        <Tooltip title={isSaveDisabled ? '当前不可保存' : '保存到草稿目录'}>
          <MenuItem onClick={handleSaveToDraft} disabled={isSaveDisabled}>
            {loading ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" sx={{ mr: 1 }} />}
            保存到草稿
          </MenuItem>
        </Tooltip>
        <MenuItem onClick={handleNewRuleGroup} disabled={disabled}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          新建规则组
        </MenuItem>
        <MenuItem onClick={handleImportRuleGroup} disabled={disabled}>
          <CloudUploadIcon fontSize="small" sx={{ mr: 1 }} />
          导入规则组
        </MenuItem>
        <MenuItem onClick={handleDownloadRuleGroup} disabled={!value}>
          <CloudDownloadIcon fontSize="small" sx={{ mr: 1 }} />
          下载规则组
        </MenuItem>
        <MenuItem onClick={handleCloneRuleGroup} disabled={!value || disabled}>
          <FileCopyIcon fontSize="small" sx={{ mr: 1 }} />
          克隆规则组
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleDeleteCurrentRuleGroup}
          disabled={!value || value.id === 'default' || disabled}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          删除规则组
        </MenuItem>
      </Menu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

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
              onChange={(event) => setNewGroupTitle(event.target.value)}
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
