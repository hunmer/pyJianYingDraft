'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Timeline, TimelineEffect, TimelineRow, TimelineAction } from '@xzdarcy/react-timeline-editor';
import type { Rule } from '@/types/rule';
import { Button, Tabs } from '@heroui/react';
import { Eye, Download, Upload } from 'lucide-react';
import { RuleGroupSelector } from '../RuleGroupSelector';
import { RuleGroupList } from '../RuleGroupList';
import TestDataPage from '../TestDataPage';
import { AddToRuleGroupDialog } from '../AddToRuleGroupDialog';
import { DownloadProgressBar } from '../DownloadProgressBar';
import '../timeline.css';

import type { TimelineEditorProps } from './types';
import { TRACK_COLORS, TYPE_LABELS } from './constants';
import { trackToRow } from './utils';
import { TabPanel } from './TabPanel';
import { CustomAction } from './CustomAction';
import { TimelineContextMenu } from './ContextMenu';
import type { TimelineContextMenuState } from './ContextMenu';
import { MaterialInfoPanel } from './MaterialInfoPanel';
import { useRawPayloads } from './useRawPayloads';
import { useRuleGroups } from './useRuleGroups';
import { useTestHandlers } from './useTestHandlers';

/**
 * Timeline编辑器组件
 */
export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  tracks,
  materials = [],
  materialDetails = {},
  duration,
  readOnly = true,
  rawDraft,
  rawMaterials,
  onChange,
  canvasWidth,
  canvasHeight,
  fps,
  draftPath,
  onRuleGroupsChange,
  initialRuleGroups,
  handleTestDataSelect,
  draftInfo,
}) => {
  const [data, setData] = useState<TimelineRow[]>([]);
  const [scaleWidth, setScaleWidth] = useState(160); // 默认刻度宽度
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null); // 选中的片段ID
  const [activeTab, setActiveTab] = useState(0); // 当前激活的Tab
  const timelineRef = useRef<any>(null);
  const trackListRef = useRef<HTMLDivElement>(null); // 左侧轨道列表引用

  const { rawMaterialPayloads, rawSegmentPayloads } = useRawPayloads(rawMaterials, rawDraft);

  const {
    ruleGroups,
    selectedRuleGroup,
    setSelectedRuleGroup,
    savingRuleGroups,
    persistRuleGroups,
    handleRuleGroupRuleSave,
  } = useRuleGroups({ draftPath, initialRuleGroups, onRuleGroupsChange });

  const {
    testResult,
    setTestResult,
    currentTaskId,
    setCurrentTaskId,
    asyncDialogOpen,
    setAsyncDialogOpen,
    handleAsyncSubmit,
    handleTestData,
  } = useTestHandlers({
    selectedRuleGroup,
    tracks,
    materials,
    rawSegmentPayloads,
    rawMaterialPayloads,
    canvasWidth,
    canvasHeight,
    fps,
  });

  const [hiddenTrackTypes, setHiddenTrackTypes] = useState<string[]>([]); // 隐藏的轨道类型

  // 短暂描边状态
  const [highlightedActionIds, setHighlightedActionIds] = useState<Set<string>>(new Set());

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<TimelineContextMenuState | null>(null);

  // 测试数据对话框 / 添加到规则组对话框
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [addToRuleGroupDialogOpen, setAddToRuleGroupDialogOpen] = useState(false);

  // 处理规则点击事件，短暂描边相关片段
  const handleRuleClick = useCallback((rule: Rule) => {
    // 查找规则中所有素材ID对应的片段
    const newHighlightedActionIds = new Set<string>();

    console.log('[Timeline] handleRuleClick:', {
      rule: rule.title,
      materialIds: rule.material_ids,
      totalRows: data.length,
      rowsWithActions: data.filter(row => row.actions && row.actions.length > 0).length
    });

    rule.material_ids.forEach(materialId => {
      data.forEach(row => {
        // 检查 row.actions 是否存在且不为空
        if (row.actions && Array.isArray(row.actions) && row.actions.length > 0) {
          row.actions.forEach(action => {
            // 检查 action 的 material_id（在 data 中存储为 effectId）
            if ((action as any).data?.material_id === materialId || action.effectId === materialId) {
              newHighlightedActionIds.add(action.id);
              console.log('[Timeline] 找到匹配的 action:', {
                actionId: action.id,
                materialId,
                effectId: action.effectId,
                rowData: (action as any).data
              });
            }
          });
        } else {
          console.log('[Timeline] 跳过空轨道或无效轨道:', {
            rowId: row.id,
            actionsCount: row.actions?.length || 0,
            rowData: (row as any).data
          });
        }
      });
    });

    console.log('[Timeline] 最终高亮的 action IDs:', Array.from(newHighlightedActionIds));

    // 设置高亮状态
    setHighlightedActionIds(newHighlightedActionIds);

    // 3秒后自动清除高亮
    setTimeout(() => {
      setHighlightedActionIds(new Set());
    }, 3000);
  }, [data]);

  // 将轨道数据转换为Timeline格式，并过滤隐藏的轨道类型
  useEffect(() => {
    const rows = tracks
      .filter(track => !hiddenTrackTypes.includes(track.type))
      .map(trackToRow);
    setData(rows);
  }, [tracks, hiddenTrackTypes]);

  // 创建素材效果映射(用于显示素材名称等)
  const effects: Record<string, TimelineEffect> = materials.reduce((acc, material) => {
    acc[material.id] = {
      id: material.id,
      name: material.name || `素材 ${material.id.slice(0, 8)}`,
    };
    return acc;
  }, {} as Record<string, TimelineEffect>);

  // 处理鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      const delta = e.deltaY > 0 ? -20 : 20; // 滚轮向下缩小,向上放大
      setScaleWidth(prev => Math.max(10, Math.min(400, prev + delta))); // 限制在60-400px之间
    }
  };

  // 在整个编辑器容器上阻止 Ctrl+滚轮的默认行为
  useEffect(() => {
    const handleWheelCapture = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        wheelEvent.preventDefault();
      }
    };

    const container = document.querySelector('.timeline-editor-main-container');
    if (container) {
      container.addEventListener('wheel', handleWheelCapture, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheelCapture);
      };
    }
  }, []);

  // 处理右键菜单
  const handleContextMenu = (event: React.MouseEvent, action: TimelineAction, row: TimelineRow) => {
    event.preventDefault();
    event.stopPropagation(); // 阻止事件冒泡

    // 使用全局坐标,因为 anchorPosition 需要全局坐标
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      action,
      row,
    });
  };

  // 关闭右键菜单
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // 从右键菜单打开预览文件
  const handleOpenPreviewFile = () => {
    if (!contextMenu || !contextMenu.action) {
      handleCloseContextMenu();
      return;
    }

    const material = materials.find(m => m.id === contextMenu.action!.effectId);
    if (material && material.path) {
      // 检查是否在 Electron 环境
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.openFile) {
        (window as any).electron.fs.openFile(material.path).catch((err: Error) => {
          console.error('打开文件失败:', err);
          alert(`打开文件失败: ${err.message}`);
        });
      } else {
        alert('此功能仅在 Electron 环境下可用');
      }
    } else {
      alert('未找到素材文件路径');
    }
    handleCloseContextMenu();
  };

  // 从右键菜单添加到规则组
  const handleAddToRuleGroupFromContextMenu = () => {
    if (!contextMenu || !contextMenu.action) {
      handleCloseContextMenu();
      return;
    }

    const material = materials.find(m => m.id === contextMenu.action!.effectId);
    if (material) {
      setSelectedActionId(contextMenu.action.id);
      setAddToRuleGroupDialogOpen(true);
    }
    handleCloseContextMenu();
  };

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-md">
      {/* 顶部按钮栏 */}
      <div className="flex justify-between items-center p-2 border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="flex gap-1">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={() => {
              const panel = document.querySelector('.timeline-left-panel') as HTMLElement | null;
              if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
              }
            }}
          >
            <Eye size={18} />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button isIconOnly variant="ghost" size="sm">
            <Download size={18} />
          </Button>
          <Button isIconOnly variant="ghost" size="sm">
            <Upload size={18} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={() => {
              const panel = document.querySelector('.timeline-right-panel') as HTMLElement | null;
              if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
              }
            }}
          >
            <Eye size={18} />
          </Button>
        </div>
      </div>

      <div
        className="timeline-editor-main-container flex flex-1 relative overflow-hidden"
      >
        {/* 左侧轨道列表 */}
        <div
          className="timeline-left-panel flex flex-col h-full border-r border-[var(--border)]"
          style={{ width: '80px' }}
        >
          {/* 顶部按钮栏 - 与时间标尺高度对齐 */}
          <div
            className="flex items-center px-3 gap-2 border-b border-[var(--border)] bg-[var(--muted)]"
            style={{ height: '42px' }}
          >
            <div className="text-xs font-semibold text-[var(--muted-foreground)]">
              轨道列表
            </div>
          </div>

          {/* 可滚动的轨道列表 */}
          <div
            ref={trackListRef}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (timelineRef.current?.setScrollTop) {
                timelineRef.current.setScrollTop(target.scrollTop);
              }
            }}
            className="flex-1 overflow-auto relative bg-[var(--background)]"
          >

            {data.map((row) => {
              const trackData = (row as any).data;
              const trackType = trackData?.type || 'video';
              const color = TRACK_COLORS[trackType] || '#666';

              return (
                <div
                  key={row.id}
                  className="flex items-center gap-1 px-3 py-1 border-b border-[var(--border)] hover:bg-[var(--muted)]"
                  style={{ height: '36px' }}
                >
                  <span
                    className="text-white font-medium text-[10px] px-2 rounded leading-5"
                    style={{ backgroundColor: color, height: '20px' }}
                  >
                    {TYPE_LABELS[trackType] || trackType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧时间轴 */}
        <div
          className="timeline-editor-container flex-1 h-full overflow-auto"
          onWheel={handleWheel}
        >
          <Timeline
            ref={timelineRef}
            editorData={data}
            effects={effects}
            onChange={(data) => {
              if (!readOnly && onChange) {
                // 这里可以将Timeline数据转回TrackInfo格式
                // 目前先设置为只读模式,避免复杂的双向转换
                console.log('Timeline changed:', data);
              }
            }}
            // Timeline配置
            scale={1}  // 时间刻度(每个刻度代表1秒)
            scaleWidth={scaleWidth}  // 动态时间刻度宽度(支持滚轮缩放)
            scaleSplitCount={10}  // 每个刻度细分10个单元
            startLeft={0}  // 左侧不留空间(已有独立轨道列表)
            rowHeight={36}  // 轨道高度(增加间距)
            autoScroll={true}  // 拖拽时自动滚动
            // 禁用拖动功能
            disableDrag={true}  // 禁止拖动片段
            dragLine={false}  // 禁用拖拽辅助线
            hideCursor={readOnly}  // 只读模式隐藏光标
            // 滚动同步
            onScroll={(params) => {
              if (trackListRef.current) {
                trackListRef.current.scrollTop = params.scrollTop;
              }
            }}
            // 自定义渲染器
            getActionRender={(action, row) => {
              const material = materials.find(m => m.id === action.effectId);
              return (
                <CustomAction
                  action={action}
                  row={row}
                  isSelected={selectedActionId === action.id}
                  isHighlighted={highlightedActionIds.has(action.id)}
                  onClick={() => {
                    setSelectedActionId(action.id);
                    setActiveTab(0); // 切换到素材信息 tab
                  }}
                  onContextMenu={handleContextMenu}
                  material={material}
                  selectedRuleGroup={selectedRuleGroup}
                />
              );
            }}
            getScaleRender={(scale) => (
              <div className="text-center text-xs text-gray-700 font-medium">
                {scale.toFixed(1)}s
              </div>
            )}
          />
        </div>

        {/* 右侧信息面板 */}
        <div
          className="timeline-right-panel flex flex-col h-full border-l border-[var(--border)] bg-[var(--card)]"
          style={{ width: '300px' }}
        >
          <Tabs
            selectedKey={String(activeTab)}
            onSelectionChange={(key) => setActiveTab(Number(key))}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="信息面板">
                <Tabs.Tab id="0" className="text-[var(--foreground)]">
                  素材信息
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="1" className="text-[var(--foreground)]">
                  规则组
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <MaterialInfoPanel
              selectedActionId={selectedActionId}
              data={data}
              materials={materials}
              selectedRuleGroup={selectedRuleGroup}
              onAddToRuleGroup={() => setAddToRuleGroupDialogOpen(true)}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <div className="flex flex-col gap-4">
              {/* 规则组选择器 */}
              <RuleGroupSelector
                value={selectedRuleGroup}
                onChange={setSelectedRuleGroup}
                ruleGroups={ruleGroups}
                onRuleGroupsChange={(groups) => {
                  persistRuleGroups(groups).catch(() => {
                    /* 错误已在 persistRuleGroups 中处理 */
                  });
                }}
                onSaveToDraft={async (groups) => {
                  await persistRuleGroups(groups).then(() => {
                    setTestResult('规则组已保存到草稿目录');
                    setActiveTab(1);
                  }).catch(() => {
                    /* 错误已在 persistRuleGroups 中处理 */
                  });
                }}
                loading={savingRuleGroups}
              />

              <div className="border-b border-[var(--border)]" />

              {/* 提交按钮 */}
              <Button
                variant="primary"
                onPress={() => {
                  const testDataId = selectedRuleGroup?.id ?? `test_data_${Date.now()}`;
                  handleTestDataSelect(
                    testDataId,
                    '异步测试数据',
                    handleAsyncSubmit,
                    {
                      ruleGroupId: selectedRuleGroup?.id,
                      ruleGroup: selectedRuleGroup,
                      materials: materials,
                      rawSegments: rawSegmentPayloads,
                      rawMaterials: rawMaterialPayloads,
                    }
                  );
                }}
                fullWidth
              >
                <Upload size={16} />
                提交任务
              </Button>

              {/* 测试结果显示 */}
              {testResult && (
                <div
                  className="p-4 rounded-md text-sm"
                  style={{
                    backgroundColor: (testResult.includes('失败') || testResult.includes('不存在')) ? '#fef2f2' : '#f0fdf4',
                    color: (testResult.includes('失败') || testResult.includes('不存在')) ? '#991b1b' : '#166534',
                  }}
                >
                  <div className="whitespace-pre-wrap">
                    {testResult}
                  </div>
                </div>
              )}

              <div className="border-b border-[var(--border)]" />

              {/* 规则列表 */}
              <RuleGroupList
                ruleGroup={selectedRuleGroup}
                materials={Array.isArray(materials) ? materials : []}
                onSuccess={handleRuleGroupRuleSave}
                onRuleClick={handleRuleClick}
              />
            </div>
          </TabPanel>
        </div>

        {/* 右键菜单 */}
        <TimelineContextMenu
          contextMenu={contextMenu}
          onClose={handleCloseContextMenu}
          onAddToRuleGroup={handleAddToRuleGroupFromContextMenu}
          onOpenPreviewFile={handleOpenPreviewFile}
        />
      </div>

      {/* 轨道类型切换按钮和草稿信息 */}
      <div className="flex justify-between items-center gap-4 flex-wrap p-2.5 border-t border-[var(--border)] bg-[var(--muted)]">
        {/* 左侧：轨道类型切换按钮 */}
        <div className="flex gap-1 flex-wrap">
          {Object.entries(TRACK_COLORS).map(([type, color]) => {
            const isHidden = hiddenTrackTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  setHiddenTrackTypes(prev =>
                    isHidden
                      ? prev.filter(t => t !== type)
                      : [...prev, type]
                  );
                }}
                className="text-white text-[11px] px-2 py-0.5 rounded hover:opacity-80"
                style={{ backgroundColor: isHidden ? '#999' : color }}
              >
                {type}
              </button>
            );
          })}
        </div>

        {/* 右侧：草稿信息 */}
        {draftInfo && (
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              时长: {draftInfo.duration_seconds.toFixed(2)}s
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              轨道: {draftInfo.track_count}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              分辨率: {draftInfo.width}×{draftInfo.height}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
              FPS: {draftInfo.fps}
            </span>
          </div>
        )}
      </div>

      {/* 测试数据页面 */}
      {testDialogOpen && (
        <TestDataPage
          open={true}
          onClose={() => setTestDialogOpen(false)}
          onSave={handleTestData}
        />
      )}

      {/* 添加到规则组对话框 */}
      <AddToRuleGroupDialog
        open={addToRuleGroupDialogOpen}
        onClose={() => setAddToRuleGroupDialogOpen(false)}
        material={(() => {
          // 查找当前选中片段的素材
          if (!selectedActionId) return null;
          let selectedAction: TimelineAction | null = null;
          data.forEach(row => {
            const action = row.actions.find(a => a.id === selectedActionId);
            if (action) {
              selectedAction = action;
            }
          });
          if (!selectedAction) return null;
          return materials.find(m => m.id === selectedAction!.effectId) || null;
        })()}
        ruleGroup={selectedRuleGroup}
        editingRule={null}
        onSaveRuleGroup={handleRuleGroupRuleSave}
        onSuccess={(updatedRuleGroup) => {
          setSelectedRuleGroup(updatedRuleGroup);
          setTestResult(`规则添加成功！规则组 "${updatedRuleGroup.title}" 现在共有 ${updatedRuleGroup.rules.length} 条规则`);
          setActiveTab(1);
        }}
      />

      {/* 异步任务进度对话框 */}
      {asyncDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAsyncDialogOpen(false)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-md p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-4">异步任务进度</div>
            {currentTaskId && (
              <DownloadProgressBar
                taskId={currentTaskId}
                onComplete={(draftPath) => {
                  console.log('草稿生成完成:', draftPath);
                  setTestResult(`✅ 任务完成！草稿路径: ${draftPath}`);
                  setAsyncDialogOpen(false);
                }}
                onError={(error) => {
                  console.error('任务失败:', error);
                  setTestResult(`❌ 任务失败: ${error}`);
                }}
                showDetails
              />
            )}
            <div className="flex justify-end mt-4">
              <Button onPress={() => setAsyncDialogOpen(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineEditor;
