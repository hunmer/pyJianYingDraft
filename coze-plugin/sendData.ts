import { Args } from '@/runtime';
import { Input, Output } from "@/typings/sendData/sendData";

/**
 * Coze数据投递节点 - 向指定客户端发送数据
 *
 * 输入参数:
 * - api_base: Coze插件的API基础地址
 * - client_id: 客户端唯一标识
 * - data: 要发送的数据对象，包含type和data字段
 *
 * 输出:
 * - success: 布尔值，发送是否成功
 * - message: 结果消息
 * - status_code: HTTP状态码
 * - response_data: 服务器响应数据
 * - error: 错误信息(失败时返回)
 */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
  const {
    api_base,
    client_id,
    data
  } = input;

  logger.info("开始发送数据到Coze客户端...", { api_base, client_id, data });

  try {
    // 1. 验证必需字段
    if (!api_base) {
      return {
        success: false,
        error: "api_base 参数不能为空"
      };
    }

    if (!client_id) {
      return {
        success: false,
        error: "client_id 参数不能为空"
      };
    }

    if (!data) {
      return {
        success: false,
        error: "data 参数不能为空"
      };
    }

    // 2. 验证并构建API URL
    let baseUrl: string;
    if (!api_base.startsWith('http://') && !api_base.startsWith('https://')) {
      baseUrl = `https://${api_base}`;
    } else {
      baseUrl = api_base;
    }

    // 移除末尾的斜杠
    baseUrl = baseUrl.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/send-data`;

    logger.info(`构建API URL: ${apiUrl}`);

    // 3. 验证data对象结构
    if (typeof data !== 'object' || data === null) {
      return {
        success: false,
        error: "data 必须是一个对象"
      };
    }

    const requestData = {
      api_base: baseUrl,
      client_id: client_id,
      data: data
    };

    logger.info("准备发送请求数据:", requestData);

    // 4. 发送POST请求
    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
    } catch (fetchError: any) {
      return {
        success: false,
        error: `网络请求失败: ${fetchError.message}`
      };
    }

    // 5. 处理响应
    let responseData: any;
    try {
      responseData = await response.json();
    } catch (parseError: any) {
      return {
        success: false,
        error: `解析响应JSON失败: ${parseError.message}`,
        status_code: response.status
      };
    }

    // 6. 检查响应状态
    if (!response.ok) {
      const errorMessage = responseData?.detail || responseData?.message || `HTTP ${response.status}`;
      return {
        success: false,
        error: `服务器返回错误: ${errorMessage}`,
        status_code: response.status,
        response_data: responseData
      };
    }

    logger.info("数据发送成功", {
      status_code: response.status,
      response: responseData
    });

    return {
      success: true,
      message: "数据发送成功",
      status_code: response.status,
      response_data: responseData,
      request_info: {
        api_url: apiUrl,
        client_id: client_id,
        data_type: data.type || 'unknown'
      }
    };

  } catch (error: any) {
    logger.error("发送数据时发生错误", error);

    let errorMessage = "发送失败";
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