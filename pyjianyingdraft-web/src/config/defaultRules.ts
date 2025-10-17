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
    },
    inputs: {
      title: {
        type: 'string',
        desc: '标题内容',
        value: '默认标题'
      }
    }
  },
  {
    type: 'top-right-logo',
    title: '视频右上角水印',
    material_ids: ['material_id_2'],
    meta: {
      position: { x: 1720, y: 0, w: 200, h: 50 }
    },
    inputs: {
      img: {
        type: 'image',
        desc: 'logo图片'
      }
    }
  },
  {
    type: 'subtitle',
    title: '字幕',
    material_ids: ['material_id_3'],
    meta: {
      position: { x: 0, y: 980, w: 1920, h: 100 }
    },
    inputs: {
      text: {
        type: 'string',
        desc: '字幕内容'
      }
    }
  },
  {
    type: 'image',
    title: '轨道图片',
    material_ids: ['material_id_4'],
    meta: {},
    inputs: {
      img: {
        type: 'image',
        desc: '轨道显示的图片'
      }
    }
  },
  {
    type: 'clip_type1',
    title: '视频片段类型1',
    material_ids: ['material_id_10', 'material_id_11', 'material_id_12'],
    meta: {},
    inputs: {
      text: {
        type: 'string',
        desc: '标题内容',
        value: '思维认知'
      }
    }
  }
];

/**
 * 示例测试数据
 */
export const EXAMPLE_TEST_DATA = {
  tracks: [
    { id: '1', type: 'video' as const },
    { id: '2', type: 'video' as const },
    { id: '3', type: 'text' as const },
    { id: '4', type: 'video' as const }
  ],
  items: [
    {
      type: 'top-left-title',
      meta: {
        timeline: { track: '1', start: 0, duration: 10 }
      },
      data: {
        title: '示例标题'
      }
    },
    {
      type: 'top-right-logo',
      meta: {
        timeline: { track: '2', start: 0, duration: 10 }
      },
      data: {
        img: 'a.jpg'
      }
    },
    {
      type: 'subtitle',
      meta: {
        timeline: { track: '3', start: 0, duration: 1 }
      },
      data: {
        text: '大家好啊'
      }
    },
    {
      type: 'subtitle',
      meta: {
        timeline: { track: '3', start: 1, duration: 2 }
      },
      data: {
        text: '很高兴再见到大家'
      }
    },
    {
      type: 'image',
      meta: {
        timeline: { track: '4', start: 0, duration: 3 },
        position: { x: 100, y: 100, scale: 1.0 }
      },
      data: {
        img: 'image1.jpg'
      }
    },
    {
      type: 'clip_type1',
      meta: {
        timeline: { track: '1', start: 10, duration: 5 }
      },
      data: {
        text: '思维认知'
      }
    }
  ]
};
