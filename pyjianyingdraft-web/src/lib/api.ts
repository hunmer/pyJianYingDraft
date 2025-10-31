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
import type { RuleGroupTestRequest, RuleGroupTestResponse, RuleGroup } from '@/types/rule';
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  ExecuteTaskRequest,
  ExecuteTaskResponse,
  TaskListResponse,
  TaskStatistics,
  TaskFilter,
} from '@/types/coze';

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
    // 处理 detail 可能是对象的情况
    let errorMessage: string;
    if (typeof errorData.detail === 'string') {
      errorMessage = errorData.detail;
    } else if (errorData.detail && typeof errorData.detail === 'object') {
      errorMessage = JSON.stringify(errorData.detail);
    } else {
      errorMessage = errorData.message || `请求失败: ${response.status}`;
    }
    throw new Error(errorMessage);
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
  has_rules?: boolean;
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

  /**
   * 获取草稿根目录配置
   */
  async getDraftRoot(): Promise<{ draft_root: string }> {
    const url = `${API_BASE_URL}/api/draft/config/root`;
    const response = await fetch(url);
    return handleResponse<{ draft_root: string }>(response);
  },

  /**
   * 设置草稿根目录配置
   * @param draftRoot - 草稿根目录路径
   */
  async setDraftRoot(draftRoot: string): Promise<{ draft_root: string; message: string }> {
    const url = `${API_BASE_URL}/api/draft/config/root`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ draft_root: draftRoot }),
    });
    return handleResponse<{ draft_root: string; message: string }>(response);
  },

  /**
   * 获取规则组配置 (全局配置,已废弃,建议使用 getAllRuleGroups)
   */
  async getRuleGroups(): Promise<{ rule_groups: any[] }> {
    const url = `${API_BASE_URL}/api/draft/config/rule-groups`;
    const response = await fetch(url);
    return handleResponse<{ rule_groups: any[] }>(response);
  },

  /**
   * 从所有草稿目录收集规则组
   * @param basePath - 可选的草稿根目录路径,不提供则使用配置的根目录
   */
  async getAllRuleGroups(basePath?: string): Promise<{ rule_groups: RuleGroup[]; count: number }> {
    const url = basePath
      ? buildUrl('/api/draft/all-rule-groups', { base_path: basePath })
      : `${API_BASE_URL}/api/draft/all-rule-groups`;
    const response = await fetch(url);
    return handleResponse<{ rule_groups: RuleGroup[]; count: number }>(response);
  },

  /**
   * 设置规则组配置
   * @param ruleGroups - 规则组列表
   */
  async setRuleGroups(ruleGroups: any[]): Promise<{ rule_groups: any[]; message: string }> {
    const url = `${API_BASE_URL}/api/draft/config/rule-groups`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rule_groups: ruleGroups }),
    });
    return handleResponse<{ rule_groups: any[]; message: string }>(response);
  },

  /**
   * 获取指定草稿绑定的规则组
   */
  async getDraftRuleGroups(draftPath: string): Promise<{ rule_groups: RuleGroup[] }> {
    const url = buildUrl('/api/draft/rules', { draft_path: draftPath });
    const response = await fetch(url);
    return handleResponse<{ rule_groups: RuleGroup[] }>(response);
  },

  /**
   * 保存指定草稿的规则组
   */
  async setDraftRuleGroups(
    draftPath: string,
    ruleGroups: RuleGroup[],
  ): Promise<{ rule_groups: RuleGroup[]; message: string }> {
    const url = `${API_BASE_URL}/api/draft/rules`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ draft_path: draftPath, rule_groups: ruleGroups }),
    });
    return handleResponse<{ rule_groups: RuleGroup[]; message: string }>(response);
  },

  /**
   * 导入压缩包草稿
   * @param draftRoot - 草稿根目录路径
   * @param zipPath - 压缩包文件路径
   */
  async importZip(draftRoot: string, zipPath: string): Promise<{ message: string; draft_name: string }> {
    const url = `${API_BASE_URL}/api/draft/import-zip`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ draft_root: draftRoot, zip_path: zipPath }),
    });
    return handleResponse<{ message: string; draft_name: string }>(response);
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
 * 异步任务相关类型
 */
export interface TaskSubmitResponse {
  task_id: string;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message: string;
  progress: TaskProgress | null;
  draft_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskProgress {
  total_files: number;
  completed_files: number;
  failed_files: number;
  active_files: number;
  total_size: number;
  downloaded_size: number;
  progress_percent: number;
  download_speed: number;
  eta_seconds: number | null;
}

export interface TaskInfo {
  task_id: string;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: TaskProgress | null;
  draft_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface TaskListResponse {
  total: number;
  tasks: TaskInfo[];
}

export interface TaskCancelResponse {
  message: string;
  task_id: string;
}

/**
 * Tasks API - 异步任务管理
 */
export const tasksApi = {
  /**
   * 提交异步任务
   * @param payload - 规则组测试请求载荷（与ruleTestApi相同格式）
   * @returns 任务ID
   */
  async submit(payload: RuleGroupTestRequest): Promise<TaskSubmitResponse> {
    const response = await fetch(`${API_BASE_URL}/api/tasks/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<TaskSubmitResponse>(response);
  },

  /**
   * 查询任务状态
   * @param taskId - 任务ID
   */
  async get(taskId: string): Promise<TaskInfo> {
    const url = `${API_BASE_URL}/api/tasks/${taskId}`;
    const response = await fetch(url);
    return handleResponse<TaskInfo>(response);
  },

  /**
   * 列出任务
   * @param options - 查询选项
   */
  async list(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const url = `${API_BASE_URL}/api/tasks?${params.toString()}`;
    const response = await fetch(url);
    return handleResponse<TaskListResponse>(response);
  },

  /**
   * 取消任务
   * @param taskId - 任务ID
   */
  async cancel(taskId: string): Promise<TaskCancelResponse> {
    const url = `${API_BASE_URL}/api/tasks/${taskId}/cancel`;
    const response = await fetch(url, { method: 'POST' });
    return handleResponse<TaskCancelResponse>(response);
  },
};

/**
 * 生成记录相关类型
 */
export interface GenerationRecord {
  record_id: string;
  task_id?: string;
  rule_group_id?: string;
  rule_group_title?: string;
  rule_group?: any;
  draft_config?: any;
  materials?: any[];
  test_data?: any;
  segment_styles?: any;
  use_raw_segments?: boolean;
  raw_segments?: any[];
  raw_materials?: any[];
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: TaskProgress | null;
  draft_path?: string;
  draft_name?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface GenerationRecordCreateRequest {
  record_id: string;
  task_id?: string;
  rule_group_id?: string;
  rule_group_title?: string;
  rule_group?: any;
  draft_config?: any;
  materials?: any[];
  test_data?: any;
  segment_styles?: any;
  use_raw_segments?: boolean;
  raw_segments?: any[];
  raw_materials?: any[];
}

export interface GenerationRecordListResponse {
  records: GenerationRecord[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Generation Records API - 生成记录管理
 */
export const generationRecordsApi = {
  /**
   * 创建生成记录
   */
  async create(request: GenerationRecordCreateRequest): Promise<GenerationRecord> {
    const response = await fetch(`${API_BASE_URL}/api/generation-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    return handleResponse<GenerationRecord>(response);
  },

  /**
   * 获取生成记录列表
   */
  async list(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<GenerationRecordListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const url = `${API_BASE_URL}/api/generation-records?${params.toString()}`;
    const response = await fetch(url);
    return handleResponse<GenerationRecordListResponse>(response);
  },

  /**
   * 获取生成记录详情
   */
  async get(recordId: string): Promise<GenerationRecord> {
    const url = `${API_BASE_URL}/api/generation-records/${recordId}`;
    const response = await fetch(url);
    return handleResponse<GenerationRecord>(response);
  },

  /**
   * 更新生成记录
   */
  async update(recordId: string, record: GenerationRecord): Promise<GenerationRecord> {
    const response = await fetch(`${API_BASE_URL}/api/generation-records/${recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    });
    return handleResponse<GenerationRecord>(response);
  },

  /**
   * 删除生成记录
   */
  async delete(recordId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/generation-records/${recordId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(response);
  },
};

/**
 * Coze API - 任务管理
 */
export const cozeApi = {
  // ==================== 账号管理 ====================

  /**
   * 获取账号列表
   */
  async getAccounts(): Promise<{ success: boolean; accounts: string[]; count: number }> {
    const url = `${API_BASE_URL}/api/coze/accounts`;
    const response = await fetch(url);
    return handleResponse<{ success: boolean; accounts: string[]; count: number }>(response);
  },

  // ==================== 工作空间管理 ====================

  /**
   * 获取工作空间列表
   */
  async getWorkspaces(accountId: string = 'default'): Promise<any> {
    const url = buildUrl('/api/coze/workspaces', { account_id: accountId });
    const response = await fetch(url);
    return handleResponse<any>(response);
  },

  // ==================== 工作流管理 ====================

  /**
   * 获取工作流列表
   */
  async getWorkflows(
    workspaceId?: string,
    accountId: string = 'default',
    pageNum: number = 1,
    pageSize: number = 30
  ): Promise<any> {
    const params: Record<string, string | number> = {
      account_id: accountId,
      page_num: pageNum,
      page_size: pageSize,
    };
    if (workspaceId) {
      params.workspace_id = workspaceId;
    }
    const url = buildUrl('/api/coze/workflows', params);
    const response = await fetch(url);
    return handleResponse<any>(response);
  },

  /**
   * 获取工作流详情
   */
  async getWorkflow(workflowId: string, accountId: string = 'default'): Promise<any> {
    const url = buildUrl(`/api/coze/workflows/${workflowId}`, { account_id: accountId });
    const response = await fetch(url);
    return handleResponse<any>(response);
  },

  /**
   * 获取工作流执行历史列表
   */
  async getWorkflowHistory(
    workflowId: string,
    accountId: string = 'default',
    pageSize: number = 20,
    pageIndex: number = 1
  ): Promise<any> {
    const url = buildUrl(`/api/coze/workflows/${workflowId}/history`, {
      account_id: accountId,
      page_size: pageSize,
      page_index: pageIndex,
    });
    const response = await fetch(url);
    return handleResponse<any>(response);
  },

  /**
   * 获取单个执行记录详情
   */
  async getExecutionDetail(
    workflowId: string,
    executeId: string,
    accountId: string = 'default'
  ): Promise<any> {
    const url = buildUrl(`/api/coze/workflows/${workflowId}/history/${executeId}`, {
      account_id: accountId,
    });
    const response = await fetch(url);
    return handleResponse<any>(response);
  },

  // ==================== 任务管理 ====================

  /**
   * 获取任务列表
   */
  async getTasks(filter?: TaskFilter): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    if (filter?.workflowId) params.append('workflow_id', filter.workflowId);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.executionStatus) params.append('execution_status', filter.executionStatus);
    if (filter?.limit) params.append('limit', String(filter.limit));
    if (filter?.offset) params.append('offset', String(filter.offset));

    const url = `${API_BASE_URL}/api/coze/tasks?${params.toString()}`;
    const response = await fetch(url);
    return handleResponse<TaskListResponse>(response);
  },

  /**
   * 获取单个任务
   */
  async getTask(taskId: string): Promise<Task> {
    const url = `${API_BASE_URL}/api/coze/tasks/${taskId}`;
    const response = await fetch(url);
    return handleResponse<Task>(response);
  },

  /**
   * 创建任务
   */
  async createTask(request: CreateTaskRequest): Promise<Task> {
    // 转换字段名：camelCase -> snake_case
    const payload = {
      name: request.name,
      description: request.description,
      workflow_id: request.workflowId,
      workflow_name: request.workflowName,
      input_parameters: request.inputParameters,
      tags: request.tags,
      priority: request.priority,
      metadata: request.metadata,
    };

    const response = await fetch(`${API_BASE_URL}/api/coze/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<Task>(response);
  },

  /**
   * 更新任务
   */
  async updateTask(taskId: string, request: UpdateTaskRequest): Promise<Task> {
    // 转换字段名：camelCase -> snake_case
    const payload: any = {};
    if (request.name !== undefined) payload.name = request.name;
    if (request.description !== undefined) payload.description = request.description;
    if (request.inputParameters !== undefined) payload.input_parameters = request.inputParameters;
    if (request.outputData !== undefined) payload.output_data = request.outputData;
    if (request.status !== undefined) payload.status = request.status;
    if (request.executionStatus !== undefined) payload.execution_status = request.executionStatus;
    if (request.errorMessage !== undefined) payload.error_message = request.errorMessage;
    if (request.executedAt !== undefined) payload.executed_at = request.executedAt;
    if (request.completedAt !== undefined) payload.completed_at = request.completedAt;
    if (request.cozeExecutionId !== undefined) payload.coze_execution_id = request.cozeExecutionId;
    if (request.cozeConversationId !== undefined) payload.coze_conversation_id = request.cozeConversationId;
    if (request.tags !== undefined) payload.tags = request.tags;
    if (request.priority !== undefined) payload.priority = request.priority;
    if (request.metadata !== undefined) payload.metadata = request.metadata;

    const response = await fetch(`${API_BASE_URL}/api/coze/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<Task>(response);
  },

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/coze/tasks/${taskId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(response);
  },

  /**
   * 执行任务（默认使用流式执行）
   */
  async executeTask(request: ExecuteTaskRequest): Promise<ExecuteTaskResponse> {
    // 默认使用流式执行，除非明确禁用
    const useStream = request.useStream !== false; // 默认为 true

    if (useStream && (request.onEvent || request.signal)) {
      // 流式执行模式
      let finalResponse: ExecuteTaskResponse | null = null;
      let lastEvent: WorkflowStreamEvent | null = null;

      await this.executeWorkflowStream(
        {
          workflow_id: request.workflowId,
          parameters: request.inputParameters || {},
        },
        (event) => {
          lastEvent = event;

          // 调用用户提供的回调
          if (request.onEvent) {
            request.onEvent(event);
          }

          // 检查是否为完成事件
          if (event.event === 'workflow_finished') {
            finalResponse = {
              taskId: request.taskId,
              executionId: event.data?.conversation_id || `stream_${Date.now()}`,
              status: event.data?.status === 'completed' ? 'success' : 'failed',
              message: event.data?.status === 'completed' ? '流式执行完成' : '流式执行失败',
              data: {
                output_data: event.data || {}
              }
            };
          }
        },
        request.signal
      );

      // 如果没有收到完成事件，创建默认响应
      if (!finalResponse) {
        finalResponse = {
          taskId: request.taskId,
          executionId: lastEvent?.data?.conversation_id || `stream_${Date.now()}`,
          status: 'success',
          message: '流式执行完成',
          data: {
            output_data: lastEvent?.data || {}
          }
        };
      }

      return finalResponse;
    } else {
      // 传统同步执行模式（向后兼容）
      const payload = {
        task_id: request.taskId,
        workflow_id: request.workflowId,
        input_parameters: request.inputParameters,
        save_as_task: request.saveAsTask,
        task_name: request.taskName,
        task_description: request.taskDescription,
      };

      const response = await fetch(`${API_BASE_URL}/api/coze/tasks/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      return handleResponse<ExecuteTaskResponse>(response);
    }
  },

  /**
   * 流式执行工作流
   */
  async executeWorkflowStream(
    request: {
      workflow_id: string;
      parameters?: Record<string, any>;
      bot_id?: string;
      conversation_id?: string;
      user_id?: string;
    },
    onEvent?: (event: WorkflowStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/coze/workflows/stream_run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // 保留最后一行（可能不完整）
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const eventData = JSON.parse(data);
              const streamEvent = this.parseStreamEvent(eventData);
              if (streamEvent) {
                onEvent?.(streamEvent);
              }
            } catch (error) {
              console.warn('解析事件数据失败:', error, 'Raw data:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * 解析流式事件
   */
  private parseStreamEvent(eventData: any): WorkflowStreamEvent | null {
    const timestamp = new Date().toISOString();

    if (eventData.event === 'workflow_started') {
      return {
        event: 'workflow_started',
        data: eventData.data || {},
        workflow_id: eventData.data?.workflow_id,
        timestamp,
      };
    }

    if (eventData.event === 'workflow_finished') {
      return {
        event: 'workflow_finished',
        data: eventData.data || {},
        workflow_id: eventData.data?.workflow_id,
        timestamp,
      };
    }

    if (eventData.event === 'node_started') {
      return {
        event: 'node_started',
        data: eventData.data || {},
        node_id: eventData.data?.node_id,
        workflow_id: eventData.data?.workflow_id,
        timestamp,
      };
    }

    if (eventData.event === 'node_finished') {
      return {
        event: 'node_finished',
        data: eventData.data || {},
        node_id: eventData.data?.node_id,
        workflow_id: eventData.data?.workflow_id,
        timestamp,
      };
    }

    if (eventData.event === 'error') {
      return {
        event: 'error',
        data: eventData.data || { message: '执行出错' },
        timestamp,
      };
    }

    // 处理消息类型事件
    if (eventData.event === 'message' || eventData.event === 'data') {
      const data = eventData.data || {};

      // 检查是否为 End 节点的消息
      if (data.type === 'Message' && data.message?.node_title === 'End') {
        // 解析 End 节点的消息内容
        let parsedOutput = {};
        try {
          if (data.message.content) {
            const content = JSON.parse(data.message.content);
            parsedOutput = content;
          }
        } catch (parseError) {
          console.warn('解析 End 节点内容失败:', parseError);
          parsedOutput = { raw_content: data.message.content };
        }

        // 创建工作流完成事件，包含解析后的输出
        return {
          event: 'workflow_finished',
          data: {
            output: parsedOutput,
            workflow_id: eventData.data?.workflow_id,
            status: 'completed',
            node_title: data.message.node_title,
            usage: data.message.usage
          },
          workflow_id: eventData.data?.workflow_id,
          timestamp,
        };
      }

      return {
        event: eventData.event,
        data: eventData.data || {},
        timestamp,
      };
    }

    // 未知事件类型，作为通用数据事件处理
    return {
      event: 'data',
      data: eventData,
      timestamp,
    };
  },

  /**
   * 取消工作流执行
   */
  async cancelWorkflowExecution(
    conversationId: string,
    accountId: string = "default"
  ): Promise<{ success: boolean; message: string; conversationId: string }> {
    const response = await fetch(`${API_BASE_URL}/api/coze/workflows/cancel_run?account_id=${accountId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
      }),
    });
    return handleResponse<{ success: boolean; message: string; conversationId: string }>(response);
  },

  /**
   * 获取任务统计信息
   */
  async getTaskStatistics(workflowId?: string): Promise<TaskStatistics> {
    const url = workflowId
      ? buildUrl('/api/coze/tasks/statistics', { workflow_id: workflowId })
      : `${API_BASE_URL}/api/coze/tasks/statistics`;
    const response = await fetch(url);
    return handleResponse<TaskStatistics>(response);
  },

  // ==================== 事件日志管理 ====================

  /**
   * 获取事件日志列表（分页）
   */
  async getEventLogs(options?: {
    limit?: number;
    offset?: number;
    workflowId?: string;
    executeId?: string;
    level?: string;
  }): Promise<{
    success: boolean;
    logs: any[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }> {
    const params: Record<string, string | number> = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.workflowId) params.workflow_id = options.workflowId;
    if (options?.executeId) params.execute_id = options.executeId;
    if (options?.level) params.level = options.level;

    const url = buildUrl('/api/coze/event-logs', params);
    const response = await fetch(url);
    return handleResponse<{
      success: boolean;
      logs: any[];
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    }>(response);
  },

  /**
   * 清空事件日志
   */
  async clearEventLogs(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/coze/event-logs`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(response);
  },

  /**
   * 获取事件日志总数
   */
  async getEventLogsCount(): Promise<{ success: boolean; count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/coze/event-logs/count`);
    return handleResponse<{ success: boolean; count: number }>(response);
  },
};

/**
 * 所有API集合
 */
const api = {
  draft: draftApi,
  subdrafts: subdraftsApi,
  materials: materialsApi,
  ruleTest: ruleTestApi,
  tasks: tasksApi,
  tracks: tracksApi,
  fileWatch: fileWatchApi,
  generationRecords: generationRecordsApi,
  coze: cozeApi,
};

export default api;
