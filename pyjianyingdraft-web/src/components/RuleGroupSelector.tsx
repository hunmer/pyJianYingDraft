'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tooltip, Spinner } from '@heroui/react';
import {
  Plus as AddIcon,
  Trash2 as DeleteIcon,
  ChevronDown as ArrowDropDownIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Files as FileCopyIcon,
  Save as SaveIcon,
} from 'lucide-react';
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
    const safeName = value.title.replace(/[^a-zA-Z0-9一-龥]/g, '_');
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

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = event.target.value;
    const selectedGroup = localRuleGroups.find(group => group.id === selectedId) ?? null;
    onChange(selectedGroup);
  };

  const renderSelectLabel = (index: number, group: RuleGroup) =>
    `${buildRuleGroupTitle(group.title, index)} (${group.rules.length})`;

  const isSaveDisabled = disabled || loading || !onSaveToDraft;

  return (
    <div className="flex items-center gap-2 w-full">
      <select
        className="flex-1 px-2 py-1 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
        value={value?.id ?? ''}
        onChange={handleSelectChange}
        disabled={disabled || loading}
      >
        {localRuleGroups.map((group, index) => (
          <option key={group.id} value={group.id}>
            {renderSelectLabel(index, group)}
          </option>
        ))}
      </select>

      <Button
        variant="ghost"
        size="sm"
        aria-label="更多选项"
        aria-controls={menuOpen ? 'rule-group-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
        onPress={handleMenuClick}
        isDisabled={disabled || loading}
        className="min-w-10 px-0"
      >
        <ArrowDropDownIcon size={18} />
      </Button>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleMenuClose}
          onContextMenu={(e) => { e.preventDefault(); handleMenuClose(); }}
        >
          <div
            className="absolute z-50 min-w-[200px] bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg py-1"
            style={{ top: (menuAnchorEl?.getBoundingClientRect().bottom ?? 0) + 4, left: menuAnchorEl?.getBoundingClientRect().left ?? 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip delay={0} isDisabled={false}>
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSaveToDraft}
                disabled={isSaveDisabled}
              >
                {loading ? <Spinner size="sm" /> : <SaveIcon size={14} />}
                保存到草稿
              </button>
              <Tooltip.Content>{isSaveDisabled ? '当前不可保存' : '保存到草稿目录'}</Tooltip.Content>
            </Tooltip>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleNewRuleGroup}
              disabled={disabled}
            >
              <AddIcon size={14} />
              新建规则组
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleImportRuleGroup}
              disabled={disabled}
            >
              <CloudUploadIcon size={14} />
              导入规则组
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDownloadRuleGroup}
              disabled={!value}
            >
              <CloudDownloadIcon size={14} />
              下载规则组
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCloneRuleGroup}
              disabled={!value || disabled}
            >
              <FileCopyIcon size={14} />
              克隆规则组
            </button>
            <div className="my-1 border-t border-[var(--border)]" />
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDeleteCurrentRuleGroup}
              disabled={!value || disabled}
            >
              <DeleteIcon size={14} />
              删除规则组
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {openCreateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setOpenCreateDialog(false);
            setNewGroupTitle('');
            setCreateError('');
          }}
        >
          <div
            className="bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
              创建新规则组
            </div>
            <div className="px-4 py-4">
              {createError && (
                <div className="mb-2 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
                  {createError}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">规则组标题</label>
                <input
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={newGroupTitle}
                  onChange={(event) => setNewGroupTitle(event.target.value)}
                  placeholder="例如: 视频标准模板"
                />
                <span className="text-xs text-[var(--muted-foreground)] mt-1">
                  为新规则组输入一个有意义的标题
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setOpenCreateDialog(false);
                  setNewGroupTitle('');
                  setCreateError('');
                }}
              >
                取消
              </Button>
              <Button size="sm" onPress={handleCreateRuleGroup}>
                创建
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleGroupSelector;
