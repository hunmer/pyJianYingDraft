import { Args } from '@/runtime';
import { Input, Output } from "@/typings/sendData_demo/sendData_demo";

/**
 * Coze数据投递节点演示示例
 *
 * 这个文件展示了如何使用sendData节点发送不同类型的数据
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const {
    demo_type = "basic",
    api_base = "http://127.0.0.1:8000",
    client_id = "demo_client"
  } = input;

  logger.info("运行sendData节点演示...", { demo_type, api_base, client_id });

  try {
    let testData: any;
    let description: string;

    switch (demo_type) {
      case "basic":
        // 基础文本消息
        testData = {
          type: "text_message",
          data: {
            content: "Hello from Coze plugin!",
            timestamp: new Date().toISOString()
          }
        };
        description = "发送基础文本消息";
        break;

      case "video_task":
        // 视频处理任务
        testData = {
          type: "video_processing",
          data: {
            task_id: `task_${Date.now()}`,
            video_url: "https://example.com/video.mp4",
            processing_options: {
              resolution: "1080p",
              format: "mp4",
              quality: "high"
            }
          }
        };
        description = "发送视频处理任务";
        break;

      case "draft_data":
        // 草稿数据
        testData = {
          type: "draft_update",
          data: {
            draft_id: "draft_123",
            changes: {
              add_track: {
                type: "video",
                duration: 5000000 // 5秒，微秒单位
              }
            }
          }
        };
        description = "发送草稿更新数据";
        break;

      default:
        return {
          success: false,
          error: `未知的演示类型: ${demo_type}`,
          available_types: ["basic", "video_task", "draft_data"]
        };
    }

    // 构建请求数据
    const requestData = {
      api_base: api_base,
      client_id: client_id,
      data: testData
    };

    // 构建API URL
    const baseUrl = api_base.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/send-data`;

    logger.info(`${description} - 准备发送请求`, {
      api_url: apiUrl,
      client_id: client_id,
      data_type: testData.type
    });

    // 模拟发送请求（在真实环境中需要实际的API端点）
    // 这里返回一个模拟的成功响应
    return {
      success: true,
      message: `${description} - 模拟发送成功`,
      demo_info: {
        type: demo_type,
        description: description,
        api_url: apiUrl,
        request_data: requestData,
        note: "这是一个演示示例，实际使用需要真实的API端点"
      },
      simulated_response: {
        status: "received",
        client_id: client_id,
        data_type: testData.type,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error: any) {
    logger.error("演示运行失败", error);

    return {
      success: false,
      error: `演示运行失败: ${error.message}`
    };
  }
};