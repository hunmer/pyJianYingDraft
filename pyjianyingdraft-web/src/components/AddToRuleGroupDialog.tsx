'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@heroui/react';
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
  /** 保存回调（由父组件处理持久化） */
  onSaveRuleGroup: (updatedRuleGroup: RuleGroup) => Promise<void> | void;
}

/**
 * 添加到规则组对话框
 */
export const AddToRuleGroupDialog: React.FC<AddToRuleGroupDialogProps> = ({
  open,
  onClose,
  material,
  ruleGroup,
  onSuccess,
  editingRule,
  onSaveRuleGroup,
}) => {
  // 表单状态
  const [ruleType, setRuleType] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [error, setError] = useState('');
  // 选择的规则索引：-1 表示新增，>= 0 表示覆盖对应规则
  const [selectedRuleIndex, setSelectedRuleIndex] = useState<number>(-1);

  // 调试日志
  useEffect(() => {
    console.log('[AddToRuleGroupDialog] Props 更新:');
    console.log('[AddToRuleGroupDialog] open:', open);
    console.log('[AddToRuleGroupDialog] material:', material);
    console.log('[AddToRuleGroupDialog] ruleGroup:', ruleGroup);
  }, [open, material, ruleGroup]);

  // 重置表单
  const resetForm = useCallback(() => {
    if (editingRule) {
      setRuleType(editingRule.type);
      setRuleTitle(editingRule.title);
      setSelectedRuleIndex(-1); // 编辑模式下不使用规则列表
    } else {
      setRuleType('');
      setRuleTitle('');
      setSelectedRuleIndex(-1); // 默认选择"新增规则"
    }
    setError('');
  }, [editingRule]);

  // 当选择的规则改变时，更新表单内容
  useEffect(() => {
    if (selectedRuleIndex >= 0 && ruleGroup && ruleGroup.rules[selectedRuleIndex]) {
      const selectedRule = ruleGroup.rules[selectedRuleIndex];
      setRuleType(selectedRule.type);
      setRuleTitle(selectedRule.title);
    } else if (selectedRuleIndex === -1) {
      // 选择"新增规则"，清空表单
      setRuleType('');
      setRuleTitle('');
    }
  }, [selectedRuleIndex, ruleGroup]);

  // 当对话框打开/关闭时重置表单
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, editingRule, resetForm]);

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

    // 检查规则类型是否重复
    // 编辑模式：排除当前规则
    // 覆盖模式：排除被覆盖的规则
    // 新增模式：检查所有规则
    const isDuplicate = ruleGroup.rules.some((r, idx) => {
      if (r.type !== ruleType.trim()) return false;

      // 编辑模式：排除原规则
      if (editingRule && r.type === editingRule.type) return false;

      // 覆盖模式：排除被覆盖的规则
      if (selectedRuleIndex >= 0 && idx === selectedRuleIndex) return false;

      return true;
    });

    if (isDuplicate) {
      setError('规则类型已存在于当前规则组');
      return false;
    }

    return true;
  };

  // 处理提交
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!ruleGroup) {
      return;
    }

    let updatedRuleGroup: RuleGroup;

    // 编辑模式：修改现有规则
    if (editingRule) {
      const updatedRule: Rule = {
        type: ruleType.trim(),
        title: ruleTitle.trim(),
        material_ids: [...editingRule.material_ids]
      };

      updatedRuleGroup = {
        ...ruleGroup,
        rules: ruleGroup.rules.map(r => r.type === editingRule.type ? updatedRule : r),
        updatedAt: new Date().toISOString()
      };
    }
    // 覆盖模式：选择了现有规则进行覆盖
    else if (selectedRuleIndex >= 0) {
      const targetRule = ruleGroup.rules[selectedRuleIndex];
      const updatedRule: Rule = {
        ...targetRule,
        type: ruleType.trim(),
        title: ruleTitle.trim(),
        material_ids: material ? [material.id] : targetRule.material_ids
      };

      updatedRuleGroup = {
        ...ruleGroup,
        rules: ruleGroup.rules.map((r, idx) => idx === selectedRuleIndex ? updatedRule : r),
        updatedAt: new Date().toISOString()
      };
    }
    // 新增模式
    else {
      const newRule: Rule = {
        type: ruleType.trim(),
        title: ruleTitle.trim(),
        material_ids: material ? [material.id] : []
      };

      updatedRuleGroup = {
        ...ruleGroup,
        rules: [...ruleGroup.rules, newRule],
        updatedAt: new Date().toISOString()
      };
    }

    try {
      await onSaveRuleGroup(updatedRuleGroup);
      onSuccess(updatedRuleGroup);
      onClose();
    } catch (err: any) {
      setError('保存失败: ' + (err?.message ?? String(err)));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--popover)] text-[var(--popover-foreground)] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">
            {editingRule ? '编辑规则' : '添加到规则组'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 overflow-auto flex-1">
          <div className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start justify-between gap-2 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="text-red-800 hover:text-red-900"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 规则组信息 */}
            {ruleGroup ? (
              <div className="p-3 rounded-md border border-blue-300 bg-blue-50 text-blue-800 text-sm">
                将添加到规则组: <strong>{ruleGroup.title}</strong>
              </div>
            ) : (
              <div className="p-3 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm">
                请先在规则组标签页中选择一个规则组
              </div>
            )}

            {/* 素材信息 */}
            {material && (
              <div className="p-4 bg-[var(--muted)] rounded">
                <div className="text-sm font-medium mb-2">当前素材</div>
                <div className="text-sm">ID: {material.id}</div>
                <div className="text-sm">类型: {material.type}</div>
                {material.name && <div className="text-sm">名称: {material.name}</div>}
              </div>
            )}

            {/* 规则选择列表（仅在非编辑模式下显示） */}
            {!editingRule && ruleGroup && ruleGroup.rules.length > 0 && (
              <>
                <div className="border-b border-[var(--border)]" />
                <div className="w-full">
                  <div className="mb-2 text-sm font-medium">
                    选择要覆盖的规则（或新增规则）
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="flex items-start gap-2 text-sm cursor-pointer p-1">
                      <input
                        type="radio"
                        name="ruleSelect"
                        checked={selectedRuleIndex === -1}
                        onChange={() => setSelectedRuleIndex(-1)}
                      />
                      <span>
                        <span className="block font-medium">新增规则</span>
                        <span className="block text-xs text-[var(--muted-foreground)]">
                          添加为新规则，不覆盖现有规则
                        </span>
                      </span>
                    </label>
                    {ruleGroup.rules.map((rule, index) => (
                      <label
                        key={index}
                        className="flex items-start gap-2 text-sm cursor-pointer p-1"
                      >
                        <input
                          type="radio"
                          name="ruleSelect"
                          checked={selectedRuleIndex === index}
                          onChange={() => setSelectedRuleIndex(index)}
                        />
                        <span>
                          <span className="block font-medium">
                            {rule.title || '未命名'}
                          </span>
                          <span className="block text-xs text-[var(--muted-foreground)]">
                            类型: {rule.type} | 素材数: {rule.material_ids.length}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="border-b border-[var(--border)]" />

            {/* 规则类型 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                规则类型 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                placeholder="例如: video-intro"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <span className="text-xs text-[var(--muted-foreground)]">
                唯一标识此规则的类型名称(英文,中划线分隔)
              </span>
            </div>

            {/* 规则标题 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">规则标题</label>
              <input
                type="text"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                placeholder="例如: 视频开场动画"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <span className="text-xs text-[var(--muted-foreground)]">
                规则的显示标题(中文)
              </span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
          <Button variant="ghost" onPress={onClose}>
            取消
          </Button>
          <Button
            onPress={handleSubmit}
            isDisabled={!ruleGroup}
          >
            {editingRule
              ? '保存修改'
              : selectedRuleIndex >= 0
                ? '覆盖规则'
                : '添加规则'}{' '}
            {!ruleGroup && '(无规则组)'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddToRuleGroupDialog;
