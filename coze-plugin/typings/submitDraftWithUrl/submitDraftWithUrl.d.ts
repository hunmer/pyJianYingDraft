/**
 * 通过 URL 提交草稿节点的类型定义
 */

/**
 * 输入参数
 */
export interface Input {
  /**
   * 远程 JSON 数据的 URL 地址
   * 必须是有效的 HTTP/HTTPS URL
   * JSON 数据必须包含: ruleGroup, materials, testData
   */
  url: string;

  /**
   * API服务器基础地址
   * 默认: http://127.0.0.1:8000
   */
  base_url?: string;
}

/**
 * 验证信息
 */
export interface ValidationInfo {
  /**
   * 原始 URL
   */
  url: string;

  /**
   * 是否包含所有必需字段
   */
  has_required_fields: boolean;

  /**
   * 素材数量
   */
  materials_count: number;

  /**
   * 规则组标题
   */
  rule_group_title: string;
}

/**
 * 输出结果
 */
export interface Output {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 生成的 API 调用 URL (成功时返回)
   * 格式: {base_url}/api/tasks/submit_with_url?url={encoded_url}
   */
  api_url?: string;

  /**
   * 结果消息
   */
  message?: string;

  /**
   * 验证信息 (成功时返回)
   */
  validation_info?: ValidationInfo;

  /**
   * 错误信息 (失败时返回)
   */
  error?: string;
}
