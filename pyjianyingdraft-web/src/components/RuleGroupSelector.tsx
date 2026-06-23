'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, Dropdown, Select, ListBox, Label, Separator, toast } from '@heroui/react';
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
    setOpenCreateDialog(true);
  };

  const handleCloneRuleGroup = () => {
    if (!value) {
      toast.danger('请先选择一个规则组');
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
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.name.endsWith('.json')) {
      toast.danger('请选择 JSON 格式的文件');
      return;
    }
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported.title || !Array.isArray(imported.rules)) {
        toast.danger('文件格式无效：缺少必要字段');
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
      toast.success(`规则组 "${finalTitle}" 导入成功`);
    } catch (error) {
      console.error('导入规则组失败:', error);
      toast.danger('导入失败，请检查文件格式');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadRuleGroup = () => {
    if (!value) {
      toast.danger('请先选择一个规则组');
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
    if (!value) {
      toast.danger('请先选择一个规则组');
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

  /** 操作菜单动作路由 */
  const handleMenuAction = (key: React.Key) => {
    switch (key) {
      case 'save':
        void handleSaveToDraft();
        break;
      case 'new':
        handleNewRuleGroup();
        break;
      case 'import':
        handleImportRuleGroup();
        break;
      case 'download':
        handleDownloadRuleGroup();
        break;
      case 'clone':
        handleCloneRuleGroup();
        break;
      case 'delete':
        handleDeleteCurrentRuleGroup();
        break;
      default:
        break;
    }
  };

  const renderSelectLabel = (index: number, group: RuleGroup) =>
    `${buildRuleGroupTitle(group.title, index)} (${group.rules.length})`;

  const isSaveDisabled = disabled || loading || !onSaveToDraft;

  return (
    <div className="flex items-center gap-2 w-full">
      <Select
        className="flex-1"
        variant="secondary"
        placeholder="选择规则组"
        value={value?.id ?? null}
        onChange={(key) => {
          const id = key as string;
          const selectedGroup = localRuleGroups.find(group => group.id === id) ?? null;
          onChange(selectedGroup);
        }}
        isDisabled={disabled || loading || localRuleGroups.length === 0}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {localRuleGroups.map((group, index) => (
              <ListBox.Item key={group.id} id={group.id} textValue={renderSelectLabel(index, group)}>
                {renderSelectLabel(index, group)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Dropdown>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="更多选项"
          isDisabled={disabled || loading}
        >
          <ArrowDropDownIcon size={18} />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu onAction={handleMenuAction}>
            <Dropdown.Item id="save" textValue="保存到草稿" isDisabled={isSaveDisabled}>
              {loading ? <Spinner size="sm" /> : <SaveIcon size={14} />}
              <Label>保存到草稿</Label>
            </Dropdown.Item>
            <Dropdown.Item id="new" textValue="新建规则组" isDisabled={disabled}>
              <AddIcon size={14} />
              <Label>新建规则组</Label>
            </Dropdown.Item>
            <Dropdown.Item id="import" textValue="导入规则组" isDisabled={disabled}>
              <CloudUploadIcon size={14} />
              <Label>导入规则组</Label>
            </Dropdown.Item>
            <Dropdown.Item id="download" textValue="下载规则组" isDisabled={!value}>
              <CloudDownloadIcon size={14} />
              <Label>下载规则组</Label>
            </Dropdown.Item>
            <Dropdown.Item id="clone" textValue="克隆规则组" isDisabled={!value || disabled}>
              <FileCopyIcon size={14} />
              <Label>克隆规则组</Label>
            </Dropdown.Item>
            <Separator />
            <Dropdown.Item id="delete" textValue="删除规则组" variant="danger" isDisabled={!value || disabled}>
              <DeleteIcon size={14} />
              <Label>删除规则组</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

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
