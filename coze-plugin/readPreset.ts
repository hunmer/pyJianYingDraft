import { Args } from '@/runtime';
import { Input, Output } from "@/typings/readPreset/readPreset";

/**
 * 读取预设节点 - 校验并返回剪映草稿预设数据
 *
 * 输入参数:
 * - preset_data: JSON字符串,包含完整的 full-request.json 信息
 * - api_base: (可选) API服务器基础地址
 *
 * 输出:
 * - valid: 布尔值,是否通过校验
 * - preset_data: 原始数据(校验通过时返回)
 * - error: 错误信息(校验失败时返回)
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const { preset_data, api_base = "http://localhost:8000" } = input;

  logger.info("开始校验预设数据...");

  try {
    // 1. 检查数据是否存在
    if (!preset_data) {
      return {
        valid: false,
        error: "预设数据不能为空"
      };
    }

    // 2. 解析 preset_data 字符串为 JSON 对象
    let parsedPresetData;
    try {
      parsedPresetData = JSON.parse(preset_data);
    } catch (parseError: any) {
      return {
        valid: false,
        error: `preset_data JSON 解析失败: ${parseError.message}`
      };
    }

    // 3. 校验必需字段
    // 必需字段: ruleGroup, materials, testData
    const requiredFields = ['ruleGroup', 'materials', 'testData'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!parsedPresetData[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `缺少必需字段: ${missingFields.join(', ')}`
      };
    }

    // 校验可选字段的类型(如果提供)
    if (parsedPresetData.segment_styles !== undefined &&
        typeof parsedPresetData.segment_styles !== 'object') {
      return {
        valid: false,
        error: "segment_styles 必须是对象类型"
      };
    }

    if (parsedPresetData.use_raw_segments !== undefined &&
        typeof parsedPresetData.use_raw_segments !== 'boolean') {
      return {
        valid: false,
        error: "use_raw_segments 必须是布尔值"
      };
    }

    if (parsedPresetData.canvas_width !== undefined &&
        typeof parsedPresetData.canvas_width !== 'number') {
      return {
        valid: false,
        error: "canvas_width 必须是数字"
      };
    }

    if (parsedPresetData.canvas_height !== undefined &&
        typeof parsedPresetData.canvas_height !== 'number') {
      return {
        valid: false,
        error: "canvas_height 必须是数字"
      };
    }

    if (parsedPresetData.fps !== undefined &&
        typeof parsedPresetData.fps !== 'number') {
      return {
        valid: false,
        error: "fps 必须是数字"
      };
    }

    // 4. 校验 ruleGroup 结构
    const { ruleGroup } = parsedPresetData;
    if (!ruleGroup.id || !ruleGroup.title || !Array.isArray(ruleGroup.rules)) {
      return {
        valid: false,
        error: "ruleGroup 结构不正确: 需要包含 id, title, rules 字段"
      };
    }

    // 5. 校验 materials 是数组
    if (!Array.isArray(parsedPresetData.materials)) {
      return {
        valid: false,
        error: "materials 必须是数组"
      };
    }

    // 6. 校验 testData 结构
    const { testData } = parsedPresetData;
    if (!Array.isArray(testData.tracks) || !Array.isArray(testData.items)) {
      return {
        valid: false,
        error: "testData 结构不正确: 需要包含 tracks 和 items 数组"
      };
    }

    // 7. 校验 use_raw_segments 模式
    if (parsedPresetData.use_raw_segments === true) {
      if (!Array.isArray(parsedPresetData.raw_segments) || parsedPresetData.raw_segments.length === 0) {
        return {
          valid: false,
          error: "use_raw_segments 为 true 时,必须提供非空的 raw_segments 数组"
        };
      }

      // 校验每个 raw_segment 的必需字段
      for (let i = 0; i < parsedPresetData.raw_segments.length; i++) {
        const seg = parsedPresetData.raw_segments[i];
        if (!seg.track_id || !seg.track_type || !seg.segment) {
          return {
            valid: false,
            error: `raw_segments[${i}] 缺少必需字段 (track_id, track_type, segment)`
          };
        }

        // 校验 segment 中的 target_timerange
        if (!seg.segment.target_timerange ||
            seg.segment.target_timerange.duration === undefined) {
          return {
            valid: false,
            error: `raw_segments[${i}].segment 缺少有效的 target_timerange`
          };
        }
      }

      // 如果提供了 raw_materials,也要校验
      if (parsedPresetData.raw_materials && Array.isArray(parsedPresetData.raw_materials)) {
        for (let i = 0; i < parsedPresetData.raw_materials.length; i++) {
          const mat = parsedPresetData.raw_materials[i];
          if (!mat.id || !mat.category || !mat.data) {
            return {
              valid: false,
              error: `raw_materials[${i}] 缺少必需字段 (id, category, data)`
            };
          }
        }
      }
    }

    // 8. 校验画布配置(如果提供)
    if (parsedPresetData.draft_config) {
      const { canvas_config, fps } = parsedPresetData.draft_config;

      if (canvas_config) {
        if (typeof canvas_config.canvas_width !== 'number' ||
            typeof canvas_config.canvas_height !== 'number') {
          return {
            valid: false,
            error: "draft_config.canvas_config 中的 canvas_width 和 canvas_height 必须是数字"
          };
        }
      }

      if (fps !== undefined && (typeof fps !== 'number' || fps <= 0)) {
        return {
          valid: false,
            error: "draft_config.fps 必须是正数"
          };
      }
    }

    // 9. 统计信息
    const stats = {
      rule_count: ruleGroup.rules.length,
      material_count: parsedPresetData.materials.length,
      track_count: testData.tracks.length,
      item_count: testData.items.length,
      mode: parsedPresetData.use_raw_segments ? 'raw_segments' : 'normal',
      has_canvas_config: !!parsedPresetData.canvas_width || !!parsedPresetData.draft_config?.canvas_config,
      canvas_size: parsedPresetData.canvas_width && parsedPresetData.canvas_height
        ? `${parsedPresetData.canvas_width}x${parsedPresetData.canvas_height}`
        : (parsedPresetData.draft_config?.canvas_config
          ? `${parsedPresetData.draft_config.canvas_config.canvas_width}x${parsedPresetData.draft_config.canvas_config.canvas_height}`
          : 'default')
    };

    logger.info("预设数据校验通过", stats);

    return {
      valid: true,
      preset_data: parsedPresetData,
      api_base: api_base,
      stats: stats,
      message: "预设数据校验通过"
    };

  } catch (error: any) {
    logger.error("校验预设数据时发生错误", error);
    return {
      valid: false,
      error: `校验失败: ${error.message || String(error)}`
    };
  }
};