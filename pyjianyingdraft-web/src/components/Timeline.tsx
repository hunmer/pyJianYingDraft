'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Timeline, TimelineEffect, TimelineRow, TimelineAction } from '@xzdarcy/react-timeline-editor';
import type { TrackInfo, SegmentInfo, MaterialInfo } from '@/types/draft';
import type { RuleGroup, TestData } from '@/types/rule';
import { Box, Paper, Typography, Chip, Tabs, Tab, Button, Divider, List, ListItem, ListItemText } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddBoxIcon from '@mui/icons-material/AddBox';
import { RuleGroupSelector } from './RuleGroupSelector';
import { RuleGroupList } from './RuleGroupList';
import { TestDataDialog } from './TestDataDialog';
import { MaterialPreview } from './MaterialPreview';
import { AddToRuleGroupDialog } from './AddToRuleGroupDialog';
import './timeline.css';

/**
 * Tab 面板组件
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`timeline-tabpanel-${index}`}
      aria-labelledby={`timeline-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {value === index && <Box sx={{ p: 2, height: '100%' }}>{children}</Box>}
    </div>
  );
}

/**
 * 轨道类型对应的颜色
 */
const TRACK_COLORS: Record<string, string> = {
  video: '#1976d2',     // 蓝色
  audio: '#2e7d32',     // 绿色
  text: '#ed6c02',      // 橙色
  effect: '#9c27b0',    // 紫色
  filter: '#d32f2f',    // 红色
  sticker: '#0288d1',   // 青色
};

/**
 * Timeline组件的Props
 */
interface TimelineEditorProps {
  /** 轨道数据 */
  tracks: TrackInfo[];
  /** 素材数据(可选,用于显示素材详情) */
  materials?: MaterialInfo[];
  /** 草稿总时长(秒) */
  duration: number;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 轨道变化回调 */
  onChange?: (tracks: TrackInfo[]) => void;
}

/**
 * 将剪映片段转换为Timeline编辑器的Action格式
 */
function segmentToAction(segment: SegmentInfo, trackType: string): TimelineAction {
  const startSeconds = segment.target_timerange.start_seconds;
  const endSeconds = startSeconds + segment.target_timerange.duration_seconds;

  return {
    id: segment.id,
    start: startSeconds,
    end: endSeconds,
    effectId: segment.material_id,
    // 自定义数据
    data: {
      name: segment.name || `片段`,
      type: trackType,
      speed: segment.speed,
      volume: segment.volume,
      material_id: segment.material_id,
    },
  } as TimelineAction;
}

/**
 * 将剪映轨道转换为Timeline编辑器的Row格式
 */
function trackToRow(track: TrackInfo): TimelineRow {
  const actions = track.segments.map(seg => segmentToAction(seg, track.type));

  return {
    id: track.id,
    actions,
    // 自定义数据
    data: {
      name: track.name,
      type: track.type,
      render_index: track.render_index,
    },
  } as TimelineRow;
}

/**
 * 自定义渲染片段
 */
const CustomAction: React.FC<{
  action: TimelineAction;
  row: TimelineRow;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({ action, row, isSelected = false, onClick }) => {
  const trackType = (row as any).data?.type || 'video';
  const color = TRACK_COLORS[trackType] || '#666';
  const name = (action as any).data?.name || '未命名';
  const speed = (action as any).data?.speed;
  const volume = (action as any).data?.volume;

  return (
    <Box
      onClick={onClick}
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: color,
        color: 'white',
        borderRadius: 1,
        padding: 0.5,
        overflow: 'hidden',
        fontSize: '12px',
        fontWeight: 500,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        cursor: 'pointer',
        border: isSelected ? '2px solid #fff' : '2px solid transparent',
        boxShadow: isSelected ? '0 0 0 2px rgba(25, 118, 210, 0.5)' : 'none',
        transition: 'all 0.2s ease',
        '&:hover': {
          opacity: 0.9,
          transform: 'scale(1.02)',
        },
      }}
    >
      <Typography variant="caption" noWrap sx={{ color: 'white', fontWeight: 500 }}>
        {name}
      </Typography>
    </Box>
  );
};

/**
 * Timeline编辑器组件
 */
export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  tracks,
  materials = [],
  duration,
  readOnly = true,
  onChange,
}) => {
  const [data, setData] = useState<TimelineRow[]>([]);
  const [scaleWidth, setScaleWidth] = useState(160); // 默认刻度宽度
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null); // 选中的片段ID
  const [activeTab, setActiveTab] = useState(0); // 当前激活的Tab
  const timelineRef = useRef<any>(null);
  const trackListRef = useRef<HTMLDivElement>(null); // 左侧轨道列表引用

  // 规则组相关状态
  const [selectedRuleGroup, setSelectedRuleGroup] = useState<RuleGroup | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [addToRuleGroupDialogOpen, setAddToRuleGroupDialogOpen] = useState(false);

  // 将轨道数据转换为Timeline格式
  useEffect(() => {
    const rows = tracks.map(trackToRow);
    setData(rows);
  }, [tracks]);

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
      setScaleWidth(prev => Math.max(60, Math.min(400, prev + delta))); // 限制在60-400px之间
    }
  };

  // 在整个编辑器容器上阻止 Ctrl+滚轮的默认行为
  useEffect(() => {
    const handleWheelCapture = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
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

  // 处理测试数据
  const handleTestData = (testData: TestData) => {
    if (!selectedRuleGroup) {
      setTestResult('请先选择规则组');
      return;
    }

    console.log('测试数据:', testData);
    console.log('当前规则组:', selectedRuleGroup);

    // 验证测试数据中的规则类型是否都存在于规则组中
    const missingRules: string[] = [];
    testData.items.forEach((item) => {
      const ruleExists = selectedRuleGroup.rules.some((rule) => rule.type === item.type);
      if (!ruleExists && !missingRules.includes(item.type)) {
        missingRules.push(item.type);
      }
    });

    if (missingRules.length > 0) {
      setTestResult(`以下规则类型在当前规则组中不存在: ${missingRules.join(', ')}`);
      return;
    }

    // 验证数据字段是否匹配规则定义
    const errors: string[] = [];
    testData.items.forEach((item, index) => {
      const rule = selectedRuleGroup.rules.find((r) => r.type === item.type);
      if (!rule) return;

      // 检查必需字段
      Object.keys(rule.inputs).forEach((inputKey) => {
        if (!(inputKey in item.data)) {
          errors.push(`素材项 ${index} (${item.type}): 缺少必需字段 "${inputKey}"`);
        }
      });
    });

    if (errors.length > 0) {
      setTestResult(`数据验证失败:\n${errors.join('\n')}`);
      return;
    }

    // 测试通过
    setTestResult(`测试通过! 共验证了 ${testData.items.length} 个素材项, ${testData.tracks.length} 个轨道`);

    // TODO: 这里可以进一步处理测试数据,例如生成草稿预览等
  };

  return (
    <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
      <Box className="timeline-editor-main-container" sx={{ display: 'flex', height: '500px' }}>
        {/* 左侧轨道列表 */}
        <Box
          sx={{
            width: '200px',
            height: '100%',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 顶部按钮栏 - 与时间标尺高度对齐 */}
          <Box
            sx={{
              height: '42px', // 与时间标尺高度一致
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              gap: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              轨道列表
            </Typography>
          </Box>

          {/* 可滚动的轨道列表 */}
          <Box
            ref={trackListRef}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (timelineRef.current?.setScrollTop) {
                timelineRef.current.setScrollTop(target.scrollTop);
              }
            }}
            sx={{
              flex: 1,
              overflow: 'auto',
              backgroundColor: 'grey.50',
            }}
          >
            {data.map((row) => {
            const trackData = (row as any).data;
            const trackType = trackData?.type || 'video';
            const trackName = trackData?.name || '未命名轨道';
            const color = TRACK_COLORS[trackType] || '#666';

            const typeLabels: Record<string, string> = {
              video: '视频',
              audio: '音频',
              text: '文本',
              effect: '特效',
              filter: '滤镜',
              sticker: '贴纸',
            };

            return (
              <Box
                key={row.id}
                sx={{
                  height: '36px',  // 与 Timeline rowHeight 一致
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.25,  // 上下内边距增加间距
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    backgroundColor: 'grey.100',
                  },
                }}
              >
                <Chip
                  label={typeLabels[trackType] || trackType}
                  size="small"
                  sx={{
                    backgroundColor: color,
                    color: 'white',
                    fontWeight: 500,
                    fontSize: '10px',
                    height: '20px',
                  }}
                />
                <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                  {trackName}
                </Typography>
              </Box>
            );
          })}
          </Box>
        </Box>

        {/* 右侧时间轴 */}
        <Box
          className="timeline-editor-container"
          sx={{ flex: 1, height: '100%', overflow: 'auto' }}
          onWheel={handleWheel}
        >
          <Timeline
            ref={timelineRef}
            editorData={data}
            effects={effects}
            className="timeline-editor"
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
            getActionRender={(action, row) => (
              <CustomAction
                action={action}
                row={row}
                isSelected={selectedActionId === action.id}
                onClick={() => {
                  setSelectedActionId(action.id);
                  setActiveTab(0); // 切换到素材信息 tab
                }}
              />
            )}
            getScaleRender={(scale) => (
              <Box sx={{ textAlign: 'center', fontSize: '12px', color: '#333', fontWeight: 500 }}>
                {scale.toFixed(1)}s
              </Box>
            )}
          />
        </Box>

        {/* 右侧信息面板 */}
        <Box
          sx={{
            width: '300px',
            height: '100%',
            borderLeft: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: '42px' }}
          >
            <Tab label="素材信息" sx={{ minHeight: '42px' }} />
            <Tab label="预设组" sx={{ minHeight: '42px' }} />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            {selectedActionId ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  素材详情
                </Typography>
                {(() => {
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
                    return <Typography variant="body2">未找到片段信息</Typography>;
                  }

                  const actionData = (selectedAction as any).data;
                  const rowData = (selectedRow as any).data;

                  // 查找素材信息
                  const material = materials.find(m => m.id === selectedAction.effectId);

                  return (
                    <>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">名称</Typography>
                          <Typography variant="body2">{actionData?.name || '未命名'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">轨道类型</Typography>
                          <Typography variant="body2">{rowData?.type || '未知'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">时间范围</Typography>
                          <Typography variant="body2">
                            {selectedAction.start.toFixed(2)}s - {selectedAction.end.toFixed(2)}s
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">持续时长</Typography>
                          <Typography variant="body2">
                            {(selectedAction.end - selectedAction.start).toFixed(2)}s
                          </Typography>
                        </Box>
                        {actionData?.speed && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">播放速度</Typography>
                            <Typography variant="body2">{actionData.speed}x</Typography>
                          </Box>
                        )}
                        {actionData?.volume !== undefined && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">音量</Typography>
                            <Typography variant="body2">{Math.round(actionData.volume * 100)}%</Typography>
                          </Box>
                        )}
                        {material && (
                          <>
                            <Box>
                              <Typography variant="caption" color="text.secondary">素材ID</Typography>
                              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '11px' }}>
                                {material.id}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">素材类型</Typography>
                              <Typography variant="body2">{material.type}</Typography>
                            </Box>
                            {material.path && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">文件路径</Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '11px' }}>
                                  {material.path}
                                </Typography>
                              </Box>
                            )}
                            {material.width && material.height && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">分辨率</Typography>
                                <Typography variant="body2">
                                  {material.width} × {material.height}
                                </Typography>
                              </Box>
                            )}
                            {material.duration_seconds && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">素材时长</Typography>
                                <Typography variant="body2">
                                  {material.duration_seconds.toFixed(2)}s
                                </Typography>
                              </Box>
                            )}
                          </>
                        )}
                      </Box>

                      {/* 素材预览 */}
                      {material && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              素材预览
                            </Typography>
                            <MaterialPreview material={material} />
                          </Box>
                        </>
                      )}

                      {/* 添加到预设组按钮 */}
                      {material && (
                        <>
                          <Divider />
                          <Button
                            variant="outlined"
                            startIcon={<AddBoxIcon />}
                            onClick={() => setAddToRuleGroupDialogOpen(true)}
                            fullWidth
                          >
                            添加到预设组
                          </Button>
                        </>
                      )}
                    </>
                  );
                })()}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  请点击时间轴上的片段查看详情
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 规则组选择器 */}
              <RuleGroupSelector value={selectedRuleGroup} onChange={setSelectedRuleGroup} />

              <Divider />

              {/* 测试按钮 */}
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => setTestDialogOpen(true)}
                fullWidth
              >
                测试规则数据
              </Button>

              {/* 测试结果显示 */}
              {testResult && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: testResult.includes('失败') || testResult.includes('不存在') ? 'error.light' : 'success.light',
                    color: testResult.includes('失败') || testResult.includes('不存在') ? 'error.dark' : 'success.dark'
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {testResult}
                  </Typography>
                </Paper>
              )}

              <Divider />

              {/* 规则列表 */}
              <RuleGroupList
                ruleGroup={selectedRuleGroup}
                materials={Array.isArray(materials) ? materials : []}
              />
            </Box>
          </TabPanel>
        </Box>
      </Box>

      {/* 轨道图例 */}
      <Box sx={{ padding: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ mr: 1, alignSelf: 'center' }}>
          轨道类型:
        </Typography>
        {Object.entries(TRACK_COLORS).map(([type, color]) => (
          <Chip
            key={type}
            label={type}
            size="small"
            sx={{
              backgroundColor: color,
              color: 'white',
              fontSize: '11px',
            }}
          />
        ))}
      </Box>

      {/* 测试数据对话框 */}
      <TestDataDialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        onTest={handleTestData}
        ruleGroupId={selectedRuleGroup?.id}
        ruleGroup={selectedRuleGroup}
        materials={Array.isArray(materials) ? materials : []}
      />

      {/* 添加到预设组对话框 */}
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
          return materials.find(m => m.id === selectedAction.effectId) || null;
        })()}
        ruleGroup={selectedRuleGroup}
        onSuccess={(updatedRuleGroup) => {
          // 更新规则组
          setSelectedRuleGroup(updatedRuleGroup);
          // 显示成功消息
          setTestResult(`规则添加成功! 规则组"${updatedRuleGroup.title}"现在有 ${updatedRuleGroup.rules.length} 条规则`);
          // 切换到预设组Tab
          setActiveTab(1);
        }}
      />
    </Paper>
  );
};

export default TimelineEditor;
