import React from 'react';
import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import type { TimelineAction, TimelineRow } from '@xzdarcy/react-timeline-editor';
import type { MaterialInfo } from '@/types/draft';
import type { RuleGroup } from '@/types/rule';
import { MaterialPreview } from '../MaterialPreview';

interface MaterialInfoPanelProps {
  selectedActionId: string | null;
  data: TimelineRow[];
  materials: MaterialInfo[];
  selectedRuleGroup: RuleGroup | null;
  onAddToRuleGroup: () => void;
}

/**
 * 素材信息面板（右侧面板 Tab 0）
 */
export function MaterialInfoPanel({
  selectedActionId,
  data,
  materials,
  selectedRuleGroup,
  onAddToRuleGroup,
}: MaterialInfoPanelProps) {
  if (!selectedActionId) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-[var(--muted-foreground)]">
          请点击时间轴上的片段查看详情
        </div>
      </div>
    );
  }

  // 查找选中的片段
  let selectedAction: TimelineAction | null = null;
  let selectedRow: TimelineRow | null = null;
  data.forEach(row => {
    const action = row.actions.find(a => a.id === selectedActionId);
    if (action) {
      selectedAction = action;
      selectedRow = row;
    }
  });

  if (!selectedAction || !selectedRow) {
    return <div className="text-sm">未找到片段信息</div>;
  }

  // 创建局部常量以避免类型推断问题
  const action = selectedAction as TimelineAction;
  const row = selectedRow as TimelineRow;

  const actionData = (action as any).data;
  const rowData = (row as any).data;

  // 查找素材信息
  const material = materials.find(m => m.id === action.effectId);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-semibold">
        素材详情
      </div>
      
      {/* 规则组状态信息 */}
      {material && selectedRuleGroup && (
        <>
          <div className="border-b border-[var(--border)]" />
          <div>
            <div className="text-sm font-semibold">
              规则组状态
            </div>
            {(() => {
              const rulesUsingMaterial = selectedRuleGroup.rules.filter(rule =>
                rule.material_ids.includes(material.id)
              );
              const isInRuleGroup = rulesUsingMaterial.length > 0;

              return (
                <div className="flex flex-col gap-1">
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">当前规则组</div>
                    <div className="text-sm">{selectedRuleGroup.title}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">状态</div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: isInRuleGroup ? '#16a34a' : '#d97706' }}
                    >
                      {isInRuleGroup ? '✓ 已添加' : '未添加'}
                    </div>
                  </div>
                  {isInRuleGroup && rulesUsingMaterial.length > 0 && (
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">使用此素材的规则</div>
                      {rulesUsingMaterial.map((rule, index) => (
                        <div key={index} className="text-sm ml-2">
                          • {rule.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* 素材预览 */}
      {material && (
        <>
          <div className="border-b border-[var(--border)]" />
          <div>
            <div className="text-sm font-semibold">
              素材预览
            </div>
            <MaterialPreview material={material} />
          </div>
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <div>
          <div className="text-xs text-[var(--muted-foreground)]">名称</div>
          <div className="text-sm">{actionData?.name || '未命名'}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted-foreground)]">轨道类型</div>
          <div className="text-sm">{rowData?.type || '未知'}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted-foreground)]">时间范围</div>
          <div className="text-sm">
            {action.start.toFixed(2)}s - {action.end.toFixed(2)}s
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted-foreground)]">持续时长</div>
          <div className="text-sm">
            {(action.end - action.start).toFixed(2)}s
          </div>
        </div>
        {actionData?.speed && (
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">播放速度</div>
            <div className="text-sm">{actionData.speed}x</div>
          </div>
        )}
        {actionData?.volume !== undefined && (
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">音量</div>
            <div className="text-sm">{Math.round(actionData.volume * 100)}%</div>
          </div>
        )}
        {material && (
          <>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">素材ID</div>
              <div className="text-sm break-all" style={{ fontSize: '11px' }}>
                {material.id}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">素材类型</div>
              <div className="text-sm">{material.type}</div>
            </div>
            {material.path && (
              <div>
                <div className="text-xs text-[var(--muted-foreground)]">文件路径</div>
                <div className="text-sm break-all" style={{ fontSize: '11px' }}>
                  {material.path}
                </div>
              </div>
            )}
            {material.width && material.height && (
              <div>
                <div className="text-xs text-[var(--muted-foreground)]">分辨率</div>
                <div className="text-sm">
                  {material.width} × {material.height}
                </div>
              </div>
            )}
            {material.duration_seconds && (
              <div>
                <div className="text-xs text-[var(--muted-foreground)]">素材时长</div>
                <div className="text-sm">
                  {material.duration_seconds.toFixed(2)}s
                </div>
              </div>
            )}
          </>
        )}
      </div>


      {/* 添加到规则组按钮 */}
      {material && (
        <>
          <div className="border-b border-[var(--border)]" />
          <Button
            variant="primary"
            onPress={onAddToRuleGroup}
            fullWidth
          >
            <Plus size={16} />
            {selectedRuleGroup && selectedRuleGroup.rules.some(rule => rule.material_ids.includes(material.id))
              ? '修改规则组配置'
              : '添加到规则组'
            }
          </Button>
        </>
      )}
    </div>
  );
}
