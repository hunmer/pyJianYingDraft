/**
 * 查询草稿生成任务结果的类型定义
 */

/**
 * 任务状态枚举
 */
export type TaskStatus =
  | "pending"      // 等待中
  | "downloading"  // 下载中
  | "processing"   // 处理中（生成草稿）
  | "completed"    // 已完成
  | "failed"       // 失败
  | "cancelled";   // 已取消

/**
 * 下载进度信息
 */
export interface DownloadProgressInfo {
  total_files: number;           // 总文件数
  completed_files: number;       // 已完成文件数
  failed_files: number;          // 失败文件数
  active_files: number;          // 正在下载的文件数
  total_size: number;            // 总大小（字节）
  downloaded_size: number;       // 已下载大小（字节）
  progress_percent: number;      // 进度百分比（0-100）
  download_speed: number;        // 下载速度（字节/秒）
  eta_seconds?: number;          // 预计剩余时间（秒）
}

/**
 * 输入参数
 */
export interface Input {
  /**
   * 任务ID（从 importDraft 返回的 task_id）
   */
  task_id: string;

  /**
   * API服务器基础地址（可选，默认 http://127.0.0.1:8000）
   */
  api_base?: string;
}

/**
 * 输出结果
 */
export interface Output {
  /**
   * 查询是否成功
   */
  success: boolean;

  /**
   * 任务ID
   */
  task_id?: string;

  /**
   * 任务状态
   */
  status?: TaskStatus;

  /**
   * 状态描述消息
   */
  message?: string;

  /**
   * 下载/处理进度信息
   */
  progress?: DownloadProgressInfo;

  /**
   * 生成的草稿路径（完成时返回）
   */
  draft_path?: string;

  /**
   * 错误信息（失败时返回）
   */
  error_message?: string;

  /**
   * 创建时间
   */
  created_at?: string;

  /**
   * 更新时间
   */
  updated_at?: string;

  /**
   * 完成时间
   */
  completed_at?: string;

  /**
   * API原始响应
   */
  api_response?: any;

  /**
   * 错误信息（查询失败时返回）
   */
  error?: string;
}
