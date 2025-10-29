export interface Input {
  /**
   * 演示类型: basic, video_task, draft_data
   */
  demo_type?: string;

  /**
   * API基础地址
   */
  api_base?: string;

  /**
   * 客户端ID
   */
  client_id?: string;
}

export interface Output {
  /**
   * 演示是否成功
   */
  success: boolean;

  /**
   * 结果消息
   */
  message?: string;

  /**
   * 演示信息
   */
  demo_info?: {
    type: string;
    description: string;
    api_url: string;
    request_data: any;
    note: string;
  };

  /**
   * 模拟响应数据
   */
  simulated_response?: {
    status: string;
    client_id: string;
    data_type: string;
    timestamp: string;
  };

  /**
   * 错误信息
   */
  error?: string;

  /**
   * 可用的演示类型
   */
  available_types?: string[];
}