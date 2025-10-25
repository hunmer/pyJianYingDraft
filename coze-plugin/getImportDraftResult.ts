import { Args } from '@/runtime';
import { Input, Output } from "@/typings/getImportDraftResult/getImportDraftResult";

/**
 * 查询草稿生成任务结果节点
 *
 * 输入参数:
 * - task_id: 任务ID (从 importDraft 返回的 task_id)
 * - api_base: (可选) API服务器基础地址,默认 http://127.0.0.1:8000
 *
 * 输出:
 * - success: 布尔值,查询是否成功
 * - task_id: 任务ID
 * - status: 任务状态 (pending/downloading/processing/completed/failed/cancelled)
 * - message: 状态描述消息
 * - progress: 下载/处理进度信息
 * - draft_path: 生成的草稿路径(完成时返回)
 * - error_message: 错误信息(任务失败时返回)
 * - created_at: 创建时间
 * - updated_at: 更新时间
 * - completed_at: 完成时间
 * - api_response: API原始响应
 * - error: 错误信息(查询失败时返回)
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const {
    task_id,
    api_base = "http://127.0.0.1:8000"
  } = input;

  logger.info("开始查询任务结果...", { task_id, api_base });

  try {
    // 1. 验证必需字段
    if (!task_id) {
      return {
        success: false,
        error: "task_id 不能为空"
      };
    }

    // 2. 调用 API 查询任务状态
    const apiUrl = `${api_base}/api/tasks/${task_id}`;
    logger.info(`调用 API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // 3. 处理响应
    if (!response.ok) {
      let errorMessage = `API 请求失败: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = `API 错误: ${errorData.detail}`;
          logger.error(errorData);
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

    // 4. 解析响应数据
    logger.info("任务查询成功", {
      task_id: result.task_id,
      status: result.status,
      message: result.message
    });

    // 5. 返回任务信息
    return {
      success: true,
      task_id: result.task_id,
      status: result.status,
      message: result.message,
      progress: result.progress,
      draft_path: result.draft_path,
      error_message: result.error_message,
      created_at: result.created_at,
      updated_at: result.updated_at,
      completed_at: result.completed_at,
      api_response: result
    };

  } catch (error: any) {
    logger.error("查询任务结果时发生错误", error);

    let errorMessage = "查询任务结果失败";
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
