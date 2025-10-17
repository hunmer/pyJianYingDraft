'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Timeline, TimelineEffect, TimelineRow, TimelineAction } from '@xzdarcy/react-timeline-editor';
import type { TrackInfo, SegmentInfo, MaterialInfo } from '@/types/draft';
import { Box, Paper, Typography, Chip } from '@mui/material';

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
      name: segment.name || `片段 ${segment.id.slice(0, 8)}`,
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
const CustomAction: React.FC<{ action: TimelineAction; row: TimelineRow }> = ({ action, row }) => {
  const trackType = (row as any).data?.type || 'video';
  const color = TRACK_COLORS[trackType] || '#666';
  const name = (action as any).data?.name || '未命名';
  const speed = (action as any).data?.speed;
  const volume = (action as any).data?.volume;

  return (
    <Box
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
        cursor: 'move',
        '&:hover': {
          opacity: 0.9,
        },
      }}
    >
      <Typography variant="caption" noWrap sx={{ color: 'white', fontWeight: 500 }}>
        {name}
      </Typography>
      {speed !== undefined && speed !== 1 && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>
          速度: {speed}x
        </Typography>
      )}
      {volume !== undefined && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>
          音量: {Math.round(volume * 100)}%
        </Typography>
      )}
    </Box>
  );
};

/**
 * 自定义渲染轨道标签
 */
const CustomRowLabel: React.FC<{ row: TimelineRow }> = ({ row }) => {
  const trackType = (row as any).data?.type || 'video';
  const trackName = (row as any).data?.name || '未命名轨道';
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
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: 1,
        height: '100%',
      }}
    >
      <Chip
        label={typeLabels[trackType] || trackType}
        size="small"
        sx={{
          backgroundColor: color,
          color: 'white',
          fontWeight: 500,
          fontSize: '11px',
        }}
      />
      <Typography variant="body2" noWrap>
        {trackName}
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
  const timelineRef = useRef<any>(null);

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

  return (
    <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ padding: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          时间轴编辑器
        </Typography>
        <Typography variant="body2" color="text.secondary">
          共 {tracks.length} 条轨道，总时长 {duration.toFixed(2)} 秒
          {readOnly && ' (只读模式)'}
        </Typography>
      </Box>

      <Box sx={{ width: '100%', height: '500px', overflow: 'auto' }}>
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
          scale={10}  // 时间刻度缩放
          scaleWidth={160}  // 时间刻度宽度
          startLeft={200}  // 左侧轨道标签宽度
          autoScroll={true}  // 自动滚动
          // 自定义渲染器
          getActionRender={(action, row) => <CustomAction action={action} row={row} />}
          getScaleRender={(scale) => (
            <Box sx={{ textAlign: 'center', fontSize: '12px', color: 'text.secondary' }}>
              {scale.toFixed(1)}s
            </Box>
          )}
          // 禁用编辑功能(只读模式)
          dragLine={!readOnly}
          hideCursor={readOnly}
        />
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
    </Paper>
  );
};

export default TimelineEditor;
