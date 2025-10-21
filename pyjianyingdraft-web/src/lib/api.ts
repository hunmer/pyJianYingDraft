/**
 * pyJianYingDraft API 客户端
 * 与 FastAPI 服务端通信的封装
 */

import type {
  DraftInfo,
  TrackInfo,
  MaterialInfo,
  MaterialStatistics,
  TrackStatistics,
  SubdraftInfo,
  TrackType,
  MaterialType,
} from '@/types/draft';
import type { RuleGroupTestRequest, RuleGroupTestResponse } from '@/types/rule';

/**
 * API基础配置
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 创建带查询参数的URL
 */
function buildUrl(path: string, params: Record<string, string | number | boolean>): string {
  const url = new URL(path, API_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

/**
 * 统一的错误处理
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(errorData.detail || `请求失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 草稿列表项
 */
export interface DraftListItem {
  name: string;
  path: string;
  modified_time: number;
  folder_path: string;
}

/**
 * 草稿列表响应
 */
export interface DraftListResponse {
  count: number;
  drafts: DraftListItem[];
}

/**
 * Draft API - 草稿基础信息
 */
export const draftApi = {
  /**
   * 获取草稿基础信息
   * @param filePath - draft_content.json 的绝对路径
   */
  async getInfo(filePath: string): Promise<DraftInfo> {
    const url = buildUrl('/api/draft/info', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<DraftInfo>(response);
  },

  /**
   * 获取草稿原始内容
   */
  async getRaw(filePath: string): Promise<Record<string, any>> {
    const url = buildUrl('/api/draft/raw', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<Record<string, any>>(response);
  },

  /**
   * 验证草稿文件是否有效
   * @param filePath - draft_content.json 的绝对路径
   */
  async validate(filePath: string): Promise<{ valid: boolean; message?: string }> {
    const url = buildUrl('/api/draft/validate', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<{ valid: boolean; message?: string }>(response);
  },

  /**
   * 列出指定目录下的所有草稿
   * @param basePath - 剪映草稿根目录路径
   */
  async list(basePath: string): Promise<DraftListResponse> {
    const url = buildUrl('/api/draft/list', { base_path: basePath });
    const response = await fetch(url);
    return handleResponse<DraftListResponse>(response);
  },
};

/**
 * Subdrafts API - 复合片段操作
 */
export const subdraftsApi = {
  /**
   * 获取所有复合片段列表
   * @param filePath - draft_content.json 的绝对路径
   */
  async list(filePath: string): Promise<SubdraftInfo[]> {
    const url = buildUrl('/api/subdrafts/list', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<SubdraftInfo[]>(response);
  },

  /**
   * 获取指定索引的复合片段详细信息
   * @param filePath - draft_content.json 的绝对路径
   * @param index - 复合片段索引
   */
  async get(filePath: string, index: number): Promise<SubdraftInfo> {
    const url = buildUrl(`/api/subdrafts/${index}`, { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<SubdraftInfo>(response);
  },

  /**
   * 获取复合片段中的轨道信息
   * @param filePath - draft_content.json 的绝对路径
   * @param index - 复合片段索引
   */
  async getTracks(filePath: string, index: number): Promise<TrackInfo[]> {
    const url = buildUrl(`/api/subdrafts/${index}/tracks`, { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<TrackInfo[]>(response);
  },

  /**
   * 获取复合片段中的素材统计
   * @param filePath - draft_content.json 的绝对路径
   * @param index - 复合片段索引
   */
  async getMaterials(filePath: string, index: number): Promise<MaterialStatistics> {
    const url = buildUrl(`/api/subdrafts/${index}/materials`, { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<MaterialStatistics>(response);
  },
};

/**
 * 素材分类信息
 */
export interface MaterialCategory {
  count: number;
  items: MaterialInfo[];
}

/**
 * 所有素材的返回格式（按分类）
 */
export interface AllMaterialsResponse {
  videos?: MaterialCategory;
  audios?: MaterialCategory;
  texts?: MaterialCategory;
  images?: MaterialCategory;
  effects?: MaterialCategory;
  filters?: MaterialCategory;
  transitions?: MaterialCategory;
  stickers?: MaterialCategory;
  ai_translates?: MaterialCategory;
  audio_balances?: MaterialCategory;
  [key: string]: MaterialCategory | undefined;
}

/**
 * Materials API - 素材管理
 */
export const materialsApi = {
  /**
   * 获取所有素材信息（按分类返回）
   * @param filePath - draft_content.json 的绝对路径
   */
  async getAll(filePath: string): Promise<AllMaterialsResponse> {
    const url = buildUrl('/api/materials/all', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<AllMaterialsResponse>(response);
  },

  /**
   * 根据类型获取素材
   * @param filePath - draft_content.json 的绝对路径
   * @param type - 素材类型
   */
  async getByType(filePath: string, type: MaterialType): Promise<MaterialInfo[]> {
    const url = buildUrl(`/api/materials/type/${type}`, { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<MaterialInfo[]>(response);
  },

  /**
   * 获取所有视频素材
   * @param filePath - draft_content.json 的绝对路径
   */
  async getVideos(filePath: string): Promise<MaterialInfo[]> {
    const url = buildUrl('/api/materials/videos', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<MaterialInfo[]>(response);
  },

  /**
   * 获取所有音频素材
   * @param filePath - draft_content.json 的绝对路径
   */
  async getAudios(filePath: string): Promise<MaterialInfo[]> {
    const url = buildUrl('/api/materials/audios', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<MaterialInfo[]>(response);
  },

  /**
   * 获取所有文本素材
   * @param filePath - draft_content.json 的绝对路径
   */
  async getTexts(filePath: string): Promise<MaterialInfo[]> {
    const url = buildUrl('/api/materials/texts', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<MaterialInfo[]>(response);
  },

  /**
   * 获取素材统计信息
   * @param filePath - draft_content.json 的绝对路径
   */
  async getStatistics(filePath: string): Promise<MaterialStatistics> {
    const url = buildUrl('/api/materials/statistics', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<MaterialStatistics>(response);
  },
};

/**
 * 规则组测试 API
 */
export const ruleTestApi = {
  /**
   * 触发规则组测试
   */
  async runTest(payload: RuleGroupTestRequest): Promise<RuleGroupTestResponse> {
    const response = await fetch(`${API_BASE_URL}/api/rules/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<RuleGroupTestResponse>(response);
    return {
      status_code: data.status_code ?? response.status,
      draft_path: data.draft_path,
      message: data.message,
    };
  },
};

/**
 * Tracks API - 轨道管理
 */
export const tracksApi = {
  /**
   * 根据类型获取轨道列表
   * @param filePath - draft_content.json 的绝对路径
   * @param type - 轨道类型
   */
  async getByType(filePath: string, type: TrackType): Promise<TrackInfo[]> {
    const url = buildUrl(`/api/tracks/type/${type}`, { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<TrackInfo[]>(response);
  },

  /**
   * 获取所有视频轨道
   * @param filePath - draft_content.json 的绝对路径
   */
  async getVideoTracks(filePath: string): Promise<TrackInfo[]> {
    const url = buildUrl('/api/tracks/video', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<TrackInfo[]>(response);
  },

  /**
   * 获取所有音频轨道
   * @param filePath - draft_content.json 的绝对路径
   */
  async getAudioTracks(filePath: string): Promise<TrackInfo[]> {
    const url = buildUrl('/api/tracks/audio', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<TrackInfo[]>(response);
  },

  /**
   * 获取所有文本轨道
   * @param filePath - draft_content.json 的绝对路径
   */
  async getTextTracks(filePath: string): Promise<TrackInfo[]> {
    const url = buildUrl('/api/tracks/text', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<TrackInfo[]>(response);
  },

  /**
   * 获取轨道统计信息
   * @param filePath - draft_content.json 的绝对路径
   */
  async getStatistics(filePath: string): Promise<TrackStatistics> {
    const url = buildUrl('/api/tracks/statistics', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<TrackStatistics>(response);
  },
};

/**
 * 文件监控相关类型
 */
export interface WatchedFileInfo {
  file_path: string;
  watch_name: string;
  is_watching: boolean;
  latest_version: number;
  total_versions: number;
  created_at: string;
  last_modified?: string;
}

export interface FileVersionInfo {
  version: number;
  timestamp: string;
  file_size: number;
  file_hash: string;
}

export interface FileVersionListResponse {
  file_path: string;
  versions: FileVersionInfo[];
}

export interface FileContentResponse {
  file_path: string;
  version: number;
  content: string;
  timestamp: string;
  file_size: number;
}

/**
 * FileWatch API - 文件监控
 */
export const fileWatchApi = {
  /**
   * 添加文件监控
   * @param filePath - 文件路径
   * @param watchName - 可选的监控名称
   */
  async addWatch(filePath: string, watchName?: string): Promise<WatchedFileInfo> {
    const response = await fetch(`${API_BASE_URL}/api/file-watch/watch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_path: filePath, watch_name: watchName }),
    });
    return handleResponse<WatchedFileInfo>(response);
  },

  /**
   * 移除文件监控
   * @param filePath - 文件路径
   */
  async removeWatch(filePath: string): Promise<{ message: string; file_path: string }> {
    const url = buildUrl('/api/file-watch/watch', { file_path: filePath });
    const response = await fetch(url, { method: 'DELETE' });
    return handleResponse<{ message: string; file_path: string }>(response);
  },

  /**
   * 获取所有监控文件列表
   */
  async getWatchedFiles(): Promise<WatchedFileInfo[]> {
    const url = `${API_BASE_URL}/api/file-watch/watch/list`;
    const response = await fetch(url);
    return handleResponse<WatchedFileInfo[]>(response);
  },

  /**
   * 开始监控文件
   * @param filePath - 文件路径
   */
  async startWatch(filePath: string): Promise<{ message: string; file_path: string }> {
    const url = buildUrl('/api/file-watch/watch/start', { file_path: filePath });
    const response = await fetch(url, { method: 'POST' });
    return handleResponse<{ message: string; file_path: string }>(response);
  },

  /**
   * 停止监控文件
   * @param filePath - 文件路径
   */
  async stopWatch(filePath: string): Promise<{ message: string; file_path: string }> {
    const url = buildUrl('/api/file-watch/watch/stop', { file_path: filePath });
    const response = await fetch(url, { method: 'POST' });
    return handleResponse<{ message: string; file_path: string }>(response);
  },

  /**
   * 获取文件版本列表
   * @param filePath - 文件路径
   */
  async getVersions(filePath: string): Promise<FileVersionListResponse> {
    const url = buildUrl('/api/file-watch/versions', { file_path: filePath });
    const response = await fetch(url);
    return handleResponse<FileVersionListResponse>(response);
  },

  /**
   * 获取指定版本的文件内容
   * @param filePath - 文件路径
   * @param version - 版本号
   */
  async getVersionContent(filePath: string, version: number): Promise<FileContentResponse> {
    const url = buildUrl('/api/file-watch/version/content', { file_path: filePath, version });
    const response = await fetch(url);
    return handleResponse<FileContentResponse>(response);
  },
};

/**
 * 默认导出所有API
 */
export default {
  draft: draftApi,
  subdrafts: subdraftsApi,
  materials: materialsApi,
  ruleTest: ruleTestApi,
  tracks: tracksApi,
  fileWatch: fileWatchApi,
};
