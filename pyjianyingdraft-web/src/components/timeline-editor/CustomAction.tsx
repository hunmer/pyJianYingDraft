import React from 'react';
import type { TimelineAction, TimelineRow } from '@xzdarcy/react-timeline-editor';
import type { MaterialInfo } from '@/types/draft';
import type { RuleGroup } from '@/types/rule';
import { MaterialPreview } from '../MaterialPreview';
import { TooltipManager } from './TooltipManager';
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
  const speed = (action as any).data?.speed;
  const volume = (action as any).data?.volume;

  // 状态：控制Tooltip的显示和位置
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
  const tooltipManager = React.useRef(TooltipManager.getInstance());
  const tooltipId = React.useRef<string | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event, action, row);
  };

  const actionRef = React.useRef<HTMLDivElement>(null);

  // 计算tooltip位置：默认片段上方居中，上方放不下则翻到下方，并做水平边界保护
  const updateTooltipPosition = () => {
    const el = actionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 220;
    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = rect.top - tooltipHeight - 8;
    if (y < 8) {
      y = rect.bottom + 8; // 上方放不下，放下方
    }
    if (x + tooltipWidth > window.innerWidth - 8) {
      x = window.innerWidth - tooltipWidth - 8;
    }
    if (x < 8) x = 8;
    setTooltipPosition({ x, y });
  };

  const handleMouseEnter = () => {
    // 生成唯一的tooltip ID
    const id = `${action.id}-${action.start}`;
    tooltipId.current = id;

    // 注册新的tooltip（这会自动关闭其他tooltip）
    tooltipManager.current.registerTooltip(id);

    updateTooltipPosition();
    setTooltipOpen(true);
  };

  const handleMouseLeave = (event: React.MouseEvent) => {
    if (!tooltipId.current) return;

    // 设置隐藏超时，让用户有时间移动到Tooltip内容
    tooltipManager.current.setHideTimeout(tooltipId.current, () => {
      // 只有当前活跃的tooltip才能关闭
      if (tooltipManager.current.isActive(tooltipId.current!)) {
        setTooltipOpen(false);
      }
    }, 300);
  };

  const handleTooltipMouseEnter = () => {
    // 鼠标进入Tooltip内容区域时，取消关闭倒计时
    if (tooltipId.current) {
      tooltipManager.current.clearTimeout();
    }
  };

  const handleTooltipMouseLeave = () => {
    // 鼠标离开Tooltip内容区域时，立即关闭
    if (tooltipId.current) {
      tooltipManager.current.closeTooltip(tooltipId.current);
      setTooltipOpen(false);
    }
  };

  // 监听其他tooltip的显示，关闭当前tooltip
  React.useEffect(() => {
    const checkActive = () => {
      if (tooltipId.current && !tooltipManager.current.isActive(tooltipId.current)) {
        setTooltipOpen(false);
      }
    };

    const interval = setInterval(checkActive, 50);
    return () => clearInterval(interval);
  }, []);

  // 组件卸载时清理
  React.useEffect(() => {
    return () => {
      if (tooltipId.current) {
        tooltipManager.current.closeTooltip(tooltipId.current);
      }
    };
  }, []);

  // 检查素材是否在当前规则组中
  const rulesUsingMaterial = selectedRuleGroup?.rules.filter(rule =>
    material?.id && rule.material_ids.includes(material.id)
  ) || [];
  const isInRuleGroup = rulesUsingMaterial.length > 0;

  // 检查素材是否在任意规则组中（用于判断背景颜色）
  const isInAnyRuleGroup = React.useMemo(() => {
    if (!material?.id || !selectedRuleGroup) return false;
    return selectedRuleGroup.rules.some(rule => rule.material_ids.includes(material.id));
  }, [material?.id, selectedRuleGroup]);

  // 创建悬浮预览内容
  const tooltipContent = material ? (
    <div className="max-w-[300px]">
      <MaterialPreview material={material} />
      <div className="mt-2 text-xs text-[var(--muted-foreground)] block">
        {material.name || name}
      </div>
      {material.path && (
        <div className="text-xs text-[var(--muted-foreground)] opacity-70 block break-all">
          {material.path}
        </div>
      )}
      {selectedRuleGroup && (
        <div className="mt-2 pt-2 border-t border-white/30">
          {isInRuleGroup ? (
            <>
              <div className="text-xs text-green-400 block font-semibold">
                ✓ 已添加到规则组: {selectedRuleGroup.title}
              </div>
              {rulesUsingMaterial.map((rule, index) => (
                <div key={index} className="text-xs text-gray-300 block ml-2">
                  • {rule.title || '未命名'}({rule.type})
                </div>
              ))}
            </>
          ) : (
            <div className="text-xs text-yellow-400 block">
              未添加到当前规则组
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    name
  );

  return (
    <>
      {/* 片段本体：留在时间轴容器内正常渲染，显示轨道颜色 */}
      <div
        ref={actionRef}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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

      {/* Tooltip 浮层：独立 fixed 定位，仅悬浮时显示 */}
      {tooltipOpen && (
        <div
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            zIndex: 50,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              maxWidth: 320,
              padding: 6,
              borderRadius: 4,
            }}
          >
            {tooltipContent}
          </div>
        </div>
      )}
    </>
  );
};
