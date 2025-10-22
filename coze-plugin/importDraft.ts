import { Args } from '@/runtime';
import { Input, Output } from "@/typings/connect/connect";

/**
 * 保存草稿节点 - 调用 API 将预设数据保存为剪映草稿
 *
 * 输入参数:
 * - preset_data: JSON字符串,包含完整的 full-request.json 信息
 * - draft_title: (可选) 自定义草稿标题,默认使用 ruleGroup.title
 * - api_base: (可选) API服务器基础地址,默认 http://localhost:8000
 *
 * 输出:
 * - success: 布尔值,是否成功保存
 * - draft_path: 保存的草稿路径
 * - draft_name: 草稿名称
 * - message: 结果消息
 * - error: 错误信息(失败时返回)
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const {
    preset_data,
    draft_title,
    api_base = "http://localhost:8000"
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
    if (typeof preset_data === 'string') {
      try {
        parsedPresetData = JSON.parse(preset_data);
      } catch (parseError: any) {
        return {
          success: false,
          error: `preset_data JSON 解析失败: ${parseError.message}`
        };
      }
    } else {
      // 如果已经是对象,直接使用
      parsedPresetData = preset_data;
    }

    // 3. 验证必需字段
    if (!parsedPresetData.ruleGroup || !parsedPresetData.materials || !parsedPresetData.testData) {
      return {
        success: false,
        error: "preset_data 缺少必需字段 (ruleGroup, materials, testData)"
      };
    }

    // 4. 准备请求数据
    const requestPayload = {
      ...parsedPresetData,
      // 如果提供了自定义标题,更新 ruleGroup.title
      ruleGroup: draft_title ? {
        ...parsedPresetData.ruleGroup,
        title: draft_title
      } : parsedPresetData.ruleGroup
    };

    // 5. 调用 API
    const apiUrl = `${api_base}/api/rules/test`;
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

    // 7. 检查响应数据
    if (result.status_code !== 200 || !result.draft_path) {
      return {
        success: false,
        error: result.message || "保存草稿失败,未返回草稿路径"
      };
    }

    // 8. 提取草稿名称(从路径中获取最后一部分)
    const pathParts = result.draft_path.split(/[\\/]/);
    const draftName = pathParts[pathParts.length - 1] || "未知草稿";

    logger.info("草稿保存成功", {
      draft_path: result.draft_path,
      draft_name: draftName
    });

    return {
      success: true,
      draft_path: result.draft_path,
      draft_name: draftName,
      message: result.message || "草稿保存成功",
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