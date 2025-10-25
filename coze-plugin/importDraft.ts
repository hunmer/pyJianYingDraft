import { Args } from '@/runtime';
import { Input, Output } from "@/typings/importDraft/importDraft";

/**
 * 保存草稿节点 - 调用 API 将预设数据提交为异步任务
 *
 * 输入参数:
 * - preset_data: JSON字符串,必须包含以下字段:
 *   - ruleGroup (必需): 规则组配置
 *   - materials (必需): 素材列表
 *   - testData (必需): 测试数据(包含 tracks 和 items)
 *   - segment_styles (可选): 片段样式映射
 *   - use_raw_segments (可选): 是否使用原始片段模式
 *   - raw_segments (可选): 原始片段数组
 *   - raw_materials (可选): 原始素材数组
 *   - canvas_width (可选): 画布宽度
 *   - canvas_height (可选): 画布高度
 *   - fps (可选): 帧率
 *   - draft_config (可选): 草稿配置
 * - draft_title: (可选) 自定义草稿标题,默认使用 ruleGroup.title
 * - api_base: (可选) API服务器基础地址,默认 http://localhost:8000
 *
 * 输出:
 * - success: 布尔值,任务是否成功提交
 * - task_id: 异步任务ID(成功时返回)
 * - message: 结果消息
 * - api_response: API原始响应
 * - error: 错误信息(失败时返回)
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const {
    preset_data,
    draft_title,
    api_base = "http://127.0.0.1:8000"
  } = input;

  logger.info("开始保存草稿...", { api_base, has_draft_title: !!draft_title });

  try {
    // 1. 验证必需字段
    if (!preset_data) {
      return {
        success: false,
        error: "preset_data 不能为空"
      };
    }

    // 2. 解析 preset_data 字符串为 JSON 对象
    let parsedPresetData;
    try {
      parsedPresetData = JSON.parse(preset_data);
    } catch (parseError: any) {
      return {
        success: false,
        error: `preset_data JSON 解析失败: ${parseError.message}`
      };
    }

    // 3. 验证必需字段
    const requiredFields = ['ruleGroup', 'materials', 'testData'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!parsedPresetData[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `preset_data 缺少必需字段: ${missingFields.join(', ')}`
      };
    }

    // 4. 准备请求数据 - 包含所有字段
    const requestPayload: any = {
      ruleGroup: draft_title ? {
        ...parsedPresetData.ruleGroup,
        title: draft_title
      } : parsedPresetData.ruleGroup,
      materials: parsedPresetData.materials,
      testData: parsedPresetData.testData,
      use_raw_segments: true,
      segment_styles: parsedPresetData.segment_styles || {},
      raw_segments: parsedPresetData.raw_segments || [],
      raw_materials: parsedPresetData.raw_materials || [],
      canvas_width: parsedPresetData.canvas_width || undefined,
      canvas_height: parsedPresetData.canvas_height || undefined,
      fps: parsedPresetData.fps || undefined,
      draft_config: parsedPresetData.draft_config || {},
    };

    // 5. 调用 API - 使用异步任务提交端点
    const apiUrl = `${api_base}/api/tasks/submit`;
    logger.info(`调用 API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    // 6. 处理响应
    if (!response.ok) {
      let errorMessage = `API 请求失败: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = `API 错误: ${errorData.detail}`;
          logger.info(errorData)
        }
      } catch {
        // 无法解析错误响应,使用默认错误消息
      }

      logger.error(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    const result = await response.json();

    // 7. 检查响应数据 - 异步任务端点返回 task_id
    if (!result.task_id) {
      return {
        success: false,
        error: result.message || "任务提交失败,未返回任务ID"
      };
    }

    // 8. 返回任务ID,用户需要使用此ID轮询任务状态
    logger.info("异步任务已提交", {
      task_id: result.task_id,
      message: result.message
    });

    return {
      success: true,
      task_id: result.task_id,
      message: result.message || "异步任务已提交,请使用 task_id 查询任务状态",
      api_response: result
    };

  } catch (error: any) {
    logger.error("保存草稿时发生错误", error);

    let errorMessage = "保存草稿失败";
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }

    // 特殊处理网络错误
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      errorMessage = `无法连接到 API 服务器 (${api_base}),请确保服务已启动`;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};