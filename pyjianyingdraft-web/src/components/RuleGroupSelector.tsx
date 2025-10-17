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
  Alert,
  ButtonGroup,
  Menu
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileCopyIcon from '@mui/icons-material/FileCopy';
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

  // 下拉菜单状态
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);

  // 文件上传 ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  // 处理菜单操作
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleNewRuleGroup = () => {
    handleMenuClose();
    setOpenCreateDialog(true);
  };

  const handleDownloadRuleGroup = () => {
    handleMenuClose();

    if (!value) {
      alert('请先选择一个规则组');
      return;
    }

    try {
      // 准备下载数据
      const dataToDownload = {
        id: value.id,
        title: value.title,
        rules: value.rules,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // 转换为 JSON 字符串
      const jsonString = JSON.stringify(dataToDownload, null, 2);

      // 创建 Blob 对象
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // 生成文件名（使用规则组标题，替换特殊字符）
      const safeFileName = value.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${safeFileName}_${timestamp}.json`;

      // 触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('规则组下载成功:', value.title);
    } catch (error) {
      console.error('下载规则组失败:', error);
      alert('下载失败，请重试');
    }
  };

  const handleCloneRuleGroup = () => {
    handleMenuClose();
    if (value) {
      const clonedGroup: RuleGroup = {
        id: `group_${Date.now()}`,
        title: `${value.title} (副本)`,
        rules: JSON.parse(JSON.stringify(value.rules)), // 深拷贝规则
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedGroups = [...ruleGroups, clonedGroup];
      setRuleGroups(updatedGroups);
      saveRuleGroupsToStorage(updatedGroups);

      // 自动选中克隆的规则组
      onChange(clonedGroup);
    } else {
      alert('请先选择一个规则组');
    }
  };

  const handleImportRuleGroup = () => {
    handleMenuClose();
    // 触发文件选择
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.json')) {
      alert('请选择 JSON 格式的文件');
      return;
    }

    try {
      // 读取文件内容
      const text = await file.text();
      const importedData = JSON.parse(text);

      // 验证数据结构
      if (!importedData.title || !Array.isArray(importedData.rules)) {
        alert('文件格式无效：缺少必要的字段（title 或 rules）');
        return;
      }

      // 检查标题是否重复
      let finalTitle = importedData.title;
      let counter = 1;
      while (ruleGroups.some(g => g.title === finalTitle)) {
        finalTitle = `${importedData.title} (${counter})`;
        counter++;
      }

      // 创建新规则组
      const newGroup: RuleGroup = {
        id: `group_${Date.now()}`,
        title: finalTitle,
        rules: importedData.rules,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedGroups = [...ruleGroups, newGroup];
      setRuleGroups(updatedGroups);
      saveRuleGroupsToStorage(updatedGroups);

      // 自动选中导入的规则组
      onChange(newGroup);

      alert(`规则组 "${finalTitle}" 导入成功！包含 ${newGroup.rules.length} 条规则`);
    } catch (error) {
      console.error('导入规则组失败:', error);
      if (error instanceof SyntaxError) {
        alert('文件格式错误：无法解析 JSON 文件');
      } else {
        alert('导入失败，请检查文件格式');
      }
    } finally {
      // 清空文件选择，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
              <Typography variant="body2">
                {group.title} ({group.rules.length})
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
          sx={{ width: '40px', minWidth: '40px', px: 0 }}
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
        <MenuItem onClick={handleNewRuleGroup}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          新建规则组
        </MenuItem>
        <MenuItem onClick={handleImportRuleGroup}>
          <CloudUploadIcon fontSize="small" sx={{ mr: 1 }} />
          导入规则组
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDownloadRuleGroup} disabled={!value}>
          <CloudDownloadIcon fontSize="small" sx={{ mr: 1 }} />
          下载规则组
        </MenuItem>
        <MenuItem onClick={handleCloneRuleGroup} disabled={!value}>
          <FileCopyIcon fontSize="small" sx={{ mr: 1 }} />
          克隆规则组
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleDeleteCurrentRuleGroup}
          disabled={!value || value.id === 'default'}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          删除规则组
        </MenuItem>
      </Menu>

      {/* 隐藏的文件上传输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

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
