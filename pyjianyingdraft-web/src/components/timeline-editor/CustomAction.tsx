import React from 'react';
import type { TimelineAction, TimelineRow } from '@xzdarcy/react-timeline-editor';
import type { MaterialInfo } from '@/types/draft';
import type { RuleGroup } from '@/types/rule';
import { TRACK_COLORS } from './constants';

/**
 * 自定义渲染片段
 */
export const CustomAction: React.FC<{
  action: TimelineAction;
  row: TimelineRow;
  isSelected?: boolean;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent, action: TimelineAction, row: TimelineRow) => void;
  material?: MaterialInfo;
  selectedRuleGroup?: RuleGroup | null;
  isHighlighted?: boolean;
}> = ({ action, row, isSelected = false, onClick, onContextMenu, material, selectedRuleGroup, isHighlighted = false }) => {
  const trackType = (row as any).data?.type || 'video';
  const color = TRACK_COLORS[trackType] || '#666';
  const name = (action as any).data?.name || '未命名';

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event, action, row);
  };

  // 检查素材是否在任意规则组中（用于判断背景颜色）
  const isInAnyRuleGroup = React.useMemo(() => {
    if (!material?.id || !selectedRuleGroup) return false;
    return selectedRuleGroup.rules.some(rule => rule.material_ids.includes(material.id));
  }, [material?.id, selectedRuleGroup]);

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isInAnyRuleGroup ? color : `${color}99`,
        color: 'white',
        borderRadius: 4,
        padding: 2,
        overflow: 'hidden',
        fontSize: '12px',
        fontWeight: 500,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        cursor: 'pointer',
        border: isSelected
          ? '2px solid #fff'
          : isHighlighted
            ? '3px solid #FFD700'
            : '2px solid transparent',
        boxShadow: isSelected
          ? '0 0 0 2px rgba(25, 118, 210, 0.5)'
          : isHighlighted
            ? '0 0 0 3px rgba(255, 215, 0, 0.3)'
            : 'none',
        transition: 'all 0.2s ease',
        opacity: isInAnyRuleGroup ? 1 : 0.7,
      }}
      className="hover:opacity-90"
    >
      <div className="text-xs text-white font-medium truncate">
        {name}
      </div>
    </div>
  );
};
