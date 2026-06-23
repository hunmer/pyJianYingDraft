'use client';

import React, { useState } from 'react';
import { Button, Modal, Tooltip } from '@heroui/react';
import {
  Copy as ContentCopyIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Settings as SettingsIcon,
} from 'lucide-react';
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
  // 复制提示状态
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  // 素材详情对话框状态
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [viewingRule, setViewingRule] = useState<Rule | null>(null);

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
        <Tooltip delay={0}>
          <span className="m-0.5 inline-flex items-center px-2 py-0.5 text-xs rounded border border-red-400 text-red-700">
            未找到
          </span>
          <Tooltip.Content>{`素材未找到: ${materialId}`}</Tooltip.Content>
        </Tooltip>
      );
    }

    const tooltipContent = getMaterialTooltipContent(material);
    const label = material.name || material.id.slice(0, 8);

    return (
      <div>
        <div className="mt-2">
          <div className="border-b border-[var(--border)] pb-1 mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">{material.id}</span>
          </div>
          <div className="p-4 bg-[var(--card)] rounded-md">
            <div className="flex flex-wrap gap-1">
              {Object.keys(material).map((key) => (
                <Tooltip
                  key={`tooltip-${key}`}
                  delay={0}
                >
                  <span
                    onClick={() => copyToClipboard(key, key)}
                    className="px-2 py-0.5 text-xs rounded border border-[var(--border)] cursor-pointer hover:bg-[var(--muted)]"
                  >
                    {key}
                  </span>
                  <Tooltip.Content>{`${key}: ${JSON.stringify(material[key as keyof MaterialInfo])}`}</Tooltip.Content>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!ruleGroup) {
    return (
      <div className="text-center py-8 bg-[var(--muted)] rounded-md">
        <span className="text-sm text-[var(--muted-foreground)]">
          请选择一个规则组
        </span>
      </div>
    );
  }

  return (
    <>
      {showTitle && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold">
            {customTitle || ruleGroup.title}
          </span>
          <div className="flex gap-1">
            <Tooltip delay={0}>
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                onPress={handleEditRuleGroup}
              >
                <SettingsIcon size={18} />
              </Button>
              <Tooltip.Content>编辑规则组</Tooltip.Content>
            </Tooltip>
          </div>
        </div>
      )}

      {ruleGroup.rules.length > 0 ? (
        <div className="bg-[var(--muted)] rounded-md">
          {ruleGroup.rules.map((rule, index) => {
            const hasMaterials = rule.material_ids.length > 0;
            const isHighlighted = highlightedTypes.has(rule.type);

            return (
              <React.Fragment key={index}>
                <div
                  onContextMenu={(e) => handleContextMenu(e, index)}
                  onClick={() => {
                    onRuleClick?.(rule, index);
                    if (hasMaterials) {
                      setViewingRule(rule);
                      setMaterialDialogOpen(true);
                    }
                  }}
                  className={`p-2 ${index < ruleGroup.rules.length - 1 ? 'border-b border-[var(--border)]' : ''} flex flex-col ${hasMaterials || onRuleClick ? 'cursor-pointer' : 'cursor-context-menu'} hover:bg-[var(--accent)]/10`}
                >
                  <div className="flex items-center w-full">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {rule.title || '未命名'}
                        </span>
                        {countRuleMissingMaterials(rule) > 0 && (
                          <Tooltip delay={0}>
                            <span className="text-[10px] leading-5 px-2 rounded border border-red-400 text-red-700">
                              未找到: {countRuleMissingMaterials(rule)}
                            </span>
                            <Tooltip.Content>{`有 ${countRuleMissingMaterials(rule)} 个素材未找到`}</Tooltip.Content>
                          </Tooltip>
                        )}
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        类型: {rule.type}
                      </span>
                    </div>
                    <div className="flex items-center">
                      {isHighlighted && (
                        <span className="mr-1 text-[10px] leading-5 px-2 rounded bg-green-100 text-green-800">
                          已添加
                        </span>
                      )}
                      <Tooltip delay={0}>
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                          onPress={() => {
                            setEditingRule(rule);
                            setEditDialogOpen(true);
                          }}
                          className="ml-1"
                        >
                          <EditIcon size={18} />
                        </Button>
                        <Tooltip.Content>编辑规则</Tooltip.Content>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-[var(--muted)] rounded-md">
          <span className="text-sm text-[var(--muted-foreground)]">
            当前规则组没有规则
          </span>
        </div>
      )}

      {/* 素材详情对话框 */}
      <Modal.Backdrop isOpen={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>素材详情{viewingRule ? ` - ${viewingRule.title || '未命名'}` : ''}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {viewingRule?.material_ids.map((materialId) => (
                <React.Fragment key={materialId}>
                  {renderMaterialChip(materialId)}
                </React.Fragment>
              ))}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                关闭
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

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
      {contextMenu !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleCloseContextMenu}
          onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
        >
          <div
            className="absolute z-50 min-w-[160px] bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg py-1"
            style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2"
              onClick={() => {
                if (contextMenu !== null && ruleGroup) {
                  const rule = ruleGroup.rules[contextMenu.ruleIndex];
                  setEditingRule(rule);
                  setEditDialogOpen(true);
                  handleCloseContextMenu();
                }
              }}
            >
              <EditIcon size={14} />
              编辑规则
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--muted)] flex items-center gap-2 text-red-600"
              onClick={() => {
                if (contextMenu !== null) {
                  handleDeleteRule(contextMenu.ruleIndex);
                }
              }}
            >
              <DeleteIcon size={14} />
              删除节点
            </button>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteDialogOpen(false)}
        >
          <div
            className="bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-xl min-w-[360px] max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
              确认删除
            </div>
            <div className="px-4 py-4 text-sm text-[var(--popover-foreground)]">
              {deletingRuleIndex !== null && ruleGroup
                ? `确定要删除规则 "${ruleGroup.rules[deletingRuleIndex]?.title}" 吗?此操作不可撤销。`
                : '确定要删除此规则吗?'}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onPress={() => setDeleteDialogOpen(false)}>
                取消
              </Button>
              <Button variant="danger" size="sm" onPress={confirmDeleteRule}>
                删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑规则组对话框 */}
      {editRuleGroupDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditRuleGroupDialogOpen(false)}
        >
          <div
            className="bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border)] text-base font-semibold">
              编辑规则组
            </div>
            <div className="px-4 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">规则组标题 *</label>
                <input
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={editedRuleGroupTitle}
                  onChange={(e) => setEditedRuleGroupTitle(e.target.value)}
                  placeholder="请输入规则组标题"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">规则组描述</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={editedRuleGroupDescription}
                  onChange={(e) => setEditedRuleGroupDescription(e.target.value)}
                  placeholder="请输入规则组描述(可选)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onPress={() => setEditRuleGroupDialogOpen(false)}>
                取消
              </Button>
              <Button
                size="sm"
                isDisabled={!editedRuleGroupTitle.trim()}
                onPress={handleSaveRuleGroup}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 复制成功提示 */}
      {snackbar.open && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md bg-green-600 text-white text-sm shadow-lg cursor-pointer"
          onClick={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </div>
      )}
    </>
  );
};

export default RuleGroupList;
