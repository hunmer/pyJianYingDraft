import type { Rule } from '@/types/rule';

/**
 * 默认规则列表
 */
export const DEFAULT_RULES: Rule[] = [
  {
    type: 'top-left-title',
    title: '视频左上角标题',
    material_ids: ['material_id_1'],
    meta: {
      position: { x: 0, y: 0, w: 200, h: 50 }
    }
  },
  {
    type: 'top-right-logo',
    title: '视频右上角水印',
    material_ids: ['material_id_2'],
    meta: {
      position: { x: 1720, y: 0, w: 200, h: 50 }
    }
  },
  {
    type: 'subtitle',
    title: '字幕',
    material_ids: ['material_id_3'],
    meta: {
      position: { x: 0, y: 980, w: 1920, h: 100 }
    }
  },
  {
    type: 'image',
    title: '轨道图片',
    material_ids: ['material_id_4'],
    meta: {}
  },
  {
    type: 'clip_type1',
    title: '视频片段类型1',
    material_ids: ['material_id_10', 'material_id_11', 'material_id_12'],
    meta: {}
  }
];

/**
 * 示例测试数据
 */
export const EXAMPLE_TEST_DATA = {
  tracks: [
    { id: '1', title: '背景音乐', type: 'video' },
    { id: '2', title: '音效', type: 'video' },
    { id: '3', title: '字幕语音', type: 'audio' },
    { id: '4', title: '字幕', type: 'text' },
    { id: '5', title: '视频图片', type: 'video' }
  ],
  items: [
    {
      type: 'bg-music',
      data: {
        track: '1',
        path: 'bg.mp3',
        start: 0,
        duration: 3
      }
    },
    {
      type: 'sound-effect',
      data: {
        track: '2',
        path: 'a.mp3',
        start: 0,
        duration: 3
      }
    },
    {
      type: 'subtitle',
      data: {
        text: '大家好啊',
        track: '4',
        start: 0,
        duration: 3
      }
    },
    {
      type: 'subtitle',
      data: {
        text: '很高兴再见到大家',
        track: '4',
        start: 0,
        duration: 3
      }
    },
    {
      type: 'img',
      data: {
        path: 'image1.jpg',
        track: '5',
        start: 0,
        duration: 3,
        x: 100,
        y: 100,
        scale: 1
      }
    }
  ]
};
