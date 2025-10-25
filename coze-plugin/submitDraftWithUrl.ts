import { Args } from '@/runtime';
import { Input, Output } from "@/typings/submitDraftWithUrl/submitDraftWithUrl";

/**
 * 通过 URL 提交草稿节点 - 验证远程 JSON 数据并提交任务
 *
 * 输入参数:
 * - url: 远程 JSON 数据的 URL 地址
 * - api_base: (可选) API服务器基础地址,默认 http://localhost:8000
 *
 * 输出:
 * - success: 布尔值,验证和提交是否成功
 * - task_id: 异步任务ID(成功时返回)
 * - message: 结果消息
 * - api_url: 生成的API调用URL
 * - error: 错误信息(失败时返回)
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const {
    url,
    api_base = "http://127.0.0.1:8000"
  } = input;

  logger.info("开始验证URL并提交草稿...", { url, api_base });

  try {
    // 1. 验证必需字段
    if (!url) {
      return {
        success: false,
        error: "url 参数不能为空"
      };
    }

    // 2. 验证URL格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (urlError: any) {
      return {
        success: false,
        error: `无效的URL格式: ${urlError.message}`
      };
    }

    logger.info(`验证 URL: ${url}`);

    // 3. 获取远程 JSON 数据
    let jsonData: any;
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return {
          success: false,
          error: `无法获取URL内容: HTTP ${response.status} ${response.statusText}`
        };
      }

      // 检查 Content-Type 是否为 JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        logger.warn(`警告: Content-Type 不是 application/json, 当前为: ${contentType}`);
      }

      jsonData = await response.json();
    } catch (fetchError: any) {
      return {
        success: false,
        error: `获取或解析URL内容失败: ${fetchError.message}`
      };
    }

    // 4. 验证必需字段
    const requiredFields = ['ruleGroup', 'materials', 'testData'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!jsonData[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `远程 JSON 数据缺少必需字段: ${missingFields.join(', ')}`
      };
    }

    // 5. 验证字段类型
    if (typeof jsonData.ruleGroup !== 'object' || jsonData.ruleGroup === null) {
      return {
        success: false,
        error: `ruleGroup 字段必须是对象,当前类型: ${typeof jsonData.ruleGroup}`
      };
    }

    if (!Array.isArray(jsonData.materials)) {
      return {
        success: false,
        error: `materials 字段必须是数组,当前类型: ${typeof jsonData.materials}`
      };
    }

    if (typeof jsonData.testData !== 'object' || jsonData.testData === null) {
      return {
        success: false,
        error: `testData 字段必须是对象,当前类型: ${typeof jsonData.testData}`
      };
    }

    logger.info("URL 内容验证通过", {
      has_ruleGroup: !!jsonData.ruleGroup,
      materials_count: jsonData.materials?.length || 0,
      has_testData: !!jsonData.testData
    });

    // 6. 构建 API URL
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `${api_base}/api/tasks/submit_with_url?url=${encodedUrl}`;

    logger.info(`生成 API URL: ${apiUrl}`);

    return {
      success: true,
      api_url: apiUrl,
      message: `URL 验证成功,已生成 API 调用地址`,
      validation_info: {
        url: url,
        has_required_fields: true,
        materials_count: jsonData.materials?.length || 0,
        rule_group_title: jsonData.ruleGroup?.title || '(未命名)',
      }
    };

  } catch (error: any) {
    logger.error("处理URL时发生错误", error);

    let errorMessage = "处理失败";
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};
