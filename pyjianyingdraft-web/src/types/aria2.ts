/**
 * Aria2 下载管理相关类型定义
 */

/** Aria2 下载状态 */
export type Aria2DownloadStatus = 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';

/** Aria2 下载任务信息 */
export interface Aria2Download {
  /** 下载任务的 GID */
  gid: string;
  /** 下载状态 */
  status: Aria2DownloadStatus;
  /** 文件总大小(字节) */
  totalLength: number;
  /** 已下载大小(字节) */
  completedLength: number;
  /** 上传大小(字节) */
  uploadLength: number;
  /** 下载速度(字节/秒) */
  downloadSpeed: number;
  /** 上传速度(字节/秒) */
  uploadSpeed: number;
  /** 文件保存路径 */
  dir: string;
  /** 文件名 */
  files: Array<{
    path: string;
    length: number;
    completedLength: number;
    selected: 'true' | 'false';
    uris: Array<{
      uri: string;
      status: string;
    }>;
  }>;
  /** 错误代码 */
  errorCode?: string;
  /** 错误消息 */
  errorMessage?: string;
}

/** Aria2 下载组信息 */
export interface Aria2DownloadGroup {
  /** 组ID (通常是任务ID) */
  groupId: string;
  /** 组名称 */
  groupName?: string;
  /** 组中的下载任务数 */
  totalDownloads: number;
  /** 已完成的下载任务数 */
  completedDownloads: number;
  /** 失败的下载任务数 */
  failedDownloads: number;
  /** 活跃的下载任务数 */
  activeDownloads: number;
  /** 总大小(字节) */
  totalSize: number;
  /** 已下载大小(字节) */
  downloadedSize: number;
  /** 下载进度(0-100) */
  progressPercent: number;
  /** 下载速度(字节/秒) */
  downloadSpeed: number;
  /** 预计剩余时间(秒, null表示未知) */
  etaSeconds: number | null;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** Aria2 配置 */
export interface Aria2Config {
  /** Aria2 可执行文件路径 */
  aria2Path: string;
  /** RPC 端口 */
  rpcPort: number;
  /** RPC 密钥 */
  rpcSecret?: string;
  /** 下载目录 */
  downloadDir: string;
  /** 最大并发下载数 */
  maxConcurrentDownloads: number;
}

/** WebSocket 消息类型 */
export type Aria2WSMessageType =
  | 'get_groups'           // 获取所有下载组
  | 'get_group_downloads'   // 获取组内下载任务
  | 'start_download'        // 开始下载
  | 'pause_download'        // 暂停下载
  | 'resume_download'       // 恢复下载
  | 'remove_download'       // 移除下载
  | 'get_config'            // 获取配置
  | 'update_config'         // 更新配置
  | 'restart_aria2';        // 重启 Aria2

/** WebSocket 请求消息 */
export interface Aria2WSRequest {
  type: Aria2WSMessageType;
  data?: any;
}

/** WebSocket 响应消息 */
export interface Aria2WSResponse {
  type: string;
  data?: any;
  error?: string;
}

/** 下载组列表响应 */
export interface DownloadGroupsResponse {
  groups: Aria2DownloadGroup[];
  total: number;
}

/** 组内下载任务列表响应 */
export interface GroupDownloadsResponse {
  groupId: string;
  downloads: Aria2Download[];
  total: number;
}
