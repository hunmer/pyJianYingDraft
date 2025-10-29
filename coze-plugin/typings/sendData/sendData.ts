export interface Input {
  /**
   * Coze插件的API基础地址
   */
  api_base: string;

  /**
   * 客户端唯一标识
   */
  client_id: string;

  /**
   * 要发送的数据对象，包含type和data字段
   */
  data: {
    type: string;
    data: any;
  };
}

export interface Output {
  /**
   * 发送是否成功
   */
  success: boolean;

  /**
   * 结果消息
   */
  message?: string;

  /**
   * HTTP状态码
   */
  status_code?: number;

  /**
   * 服务器响应数据
   */
  response_data?: any;

  /**
   * 请求信息
   */
  request_info?: {
    api_url: string;
    client_id: string;
    data_type: string;
  };

  /**
   * 错误信息(失败时返回)
   */
  error?: string;
}