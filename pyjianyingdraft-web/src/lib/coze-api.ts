/**
 * Coze API 客户端
 * 参考：https://www.coze.cn/open/docs/developer_guides
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  CozeAccount,
  CozeWorkspace,
  CozeFile,
  CozeWorkflow,
  WorkflowExecution,
  CreateWorkspaceRequest,
  UploadFileResponse,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  CozeApiResponse,
  CozeErrorCode,
  DEFAULT_COZE_CONFIG,
} from '@/types/coze';

export class CozeApiClient {
  private apiKey: string;
  private baseUrl: string;
  private httpClient: AxiosInstance;
  private config = DEFAULT_COZE_CONFIG;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || this.config.defaultBaseUrl;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.httpClient.interceptors.request.use(
      (config) => {
        console.log(`🔗 Coze API 请求: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`🔑 Authorization Header:`, config.headers?.Authorization);
        console.log(`🔑 API Key (前4位): ${this.apiKey.substring(0, 4)}****`);
        return config;
      },
      (error) => {
        console.error('❌ Coze API 请求拦截器错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse<CozeApiResponse>) => {
        const { data } = response;
        if (data.code !== 0) {
          throw new CozeApiError(data.code, data.message || '请求失败', data.error);
        }
        console.log(`✅ Coze API 响应: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return data;
      },
      async (error) => {
        console.error('❌ Coze API 响应错误:', error);

        // 如果是网络错误且有重试次数，则自动重试
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        throw this.parseError(error);
      }
    );
  }

  private shouldRetry(error: any): boolean {
    const retryCount = (error.config as any)?.__retryCount || 0;
    return (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNABORTED' ||
      (error.response?.status >= 500 && error.response?.status < 600)
    ) && retryCount < this.config.maxRetries;
  }

  private async retryRequest(originalConfig: any): Promise<any> {
    const retryCount = (originalConfig as any).__retryCount || 0;
    (originalConfig as any).__retryCount = retryCount + 1;

    // 指数退避
    const delay = Math.pow(2, retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.httpClient(originalConfig);
  }

  private parseError(error: any): CozeApiError {
    if (error.response?.data) {
      const data = error.response.data;
      return new CozeApiError(
        data.code || error.response.status,
        data.message || `HTTP ${error.response.status}`,
        data.error
      );
    }

    if (error.code === 'ECONNABORTED') {
      return new CozeApiError(CozeErrorCode.INTERNAL_ERROR, '请求超时，请检查网络连接');
    }

    return new CozeApiError(
      CozeErrorCode.INTERNAL_ERROR,
      error.message || '网络请求失败'
    );
  }

  // ==================== 工作空间管理 ====================

  /**
   * 获取工作空间列表
   * https://www.coze.cn/open/docs/developer_guides/list_workspace
   */
  async getWorkspaces(): Promise<CozeWorkspace[]> {
    const response = await this.httpClient.get('/v1/workspaces');
    // Coze API 返回结构: { code: 0, data: { total_count: number, workspaces: CozeWorkspace[] } }
    return response.data?.workspaces || [];
  }

  /**
   * 创建工作空间
   * https://www.coze.cn/open/docs/developer_guides/create_workspace
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<CozeWorkspace> {
    const response = await this.httpClient.post<CozeApiResponse<CozeWorkspace>>(
      '/v1/space/create',
      request
    );
    return response.data;
  }

  // ==================== 工作流管理 ====================

  /**
   * 获取工作流列表
   * https://www.coze.cn/open/docs/developer_guides/get_workflow_list
   */
  async getWorkflows(workspaceId: string): Promise<CozeWorkflow[]> {
    const response = await this.httpClient.get(
      `/v1/workflow/list`,
      { params: { space_id: workspaceId } }
    );
    // Coze API 返回结构: { code: 0, data: { total_count: number, workflows: CozeWorkflow[] } }
    return response.data?.workflows || [];
  }

  /**
   * 获取工作流基本信息
   * https://www.coze.cn/open/docs/developer_guides/get_workflow_info
   */
  async getWorkflowInfo(workspaceId: string, workflowId: string): Promise<CozeWorkflow> {
    const response = await this.httpClient.get<CozeApiResponse<CozeWorkflow>>(
      `/v1/workflow/get`,
      { params: { space_id: workspaceId, workflow_id: workflowId } }
    );
    return response.data;
  }

  /**
   * 执��工作流
   * https://www.coze.cn/open/docs/developer_guides/workflow_stream_run
   */
  async executeWorkflow(
    workspaceId: string,
    request: ExecuteWorkflowRequest
  ): Promise<ExecuteWorkflowResponse> {
    const response = await this.httpClient.post<CozeApiResponse<ExecuteWorkflowResponse>>(
      `/v1/workflow/stream_run`,
      {
        ...request,
        space_id: workspaceId,
      }
    );
    return response.data;
  }

  /**
   * 查询工作流异步执行结果
   * https://www.coze.cn/open/docs/developer_guides/workflow_history
   */
  async getWorkflowExecutionStatus(
    workspaceId: string,
    executionId: string
  ): Promise<WorkflowExecution> {
    const response = await this.httpClient.get<CozeApiResponse<WorkflowExecution>>(
      `/v1/workflow/get_history`,
      { params: {
        space_id: workspaceId,
        conversation_id: executionId,
        include_variable: true
      }}
    );
    return response.data;
  }

  /**
   * 获取工作流执行历史
   */
  async getWorkflowExecutionHistory(
    workspaceId: string,
    workflowId?: string,
    pageSize = 20,
    currentPage = 1
  ): Promise<WorkflowExecution[]> {
    const params: any = {
      space_id: workspaceId,
      page_size: pageSize,
      current_page: currentPage,
      include_variable: true,
    };

    if (workflowId) {
      params.workflow_id = workflowId;
    }

    const response = await this.httpClient.get(
      `/v1/workflow/list_history`,
      { params }
    );
    // Coze API 返回结构: { code: 0, data: { total_count: number, histories: WorkflowExecution[] } }
    return response.data?.histories || [];
  }

  // ==================== 文件管理 ====================

  /**
   * 上传文件
   * https://www.coze.cn/open/docs/developer_guides/upload_files
   */
  async uploadFile(workspaceId: string, file: File): Promise<CozeFile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('space_id', workspaceId);

    const response = await this.httpClient.post<CozeApiResponse<UploadFileResponse>>(
      '/v1/files/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const uploadData = response.data;
    return {
      id: uploadData.id,
      name: uploadData.name,
      size: uploadData.size,
      type: file.type,
      upload_time: uploadData.upload_time,
      url: uploadData.url,
    };
  }

  /**
   * 获取文件列表
   */
  async getFiles(workspaceId: string, pageSize = 50, currentPage = 1): Promise<CozeFile[]> {
    const response = await this.httpClient.get(
      `/v1/files/list`,
      {
        params: {
          space_id: workspaceId,
          page_size: pageSize,
          current_page: currentPage,
        },
      }
    );
    // Coze API 返回结构: { code: 0, data: { total_count: number, files: CozeFile[] } }
    return response.data?.files || [];
  }

  /**
   * 获取文件详情
   * https://www.coze.cn/open/docs/developer_guides/retrieve_files
   */
  async getFileInfo(workspaceId: string, fileId: string): Promise<CozeFile> {
    const response = await this.httpClient.get<CozeApiResponse<CozeFile>>(
      `/v1/files/retrieve`,
      {
        params: {
          space_id: workspaceId,
          file_id: fileId,
        },
      }
    );
    return response.data;
  }

  /**
   * 删除文件
   */
  async deleteFile(workspaceId: string, fileId: string): Promise<void> {
    await this.httpClient.delete('/v1/files/delete', {
      params: {
        space_id: workspaceId,
        file_id: fileId,
      },
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getWorkspaces();
      return true;
    } catch (error) {
      console.error('Coze API 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    };
  }
}

// Coze API 错误类
export class CozeApiError extends Error {
  public code: number;
  public details?: any;

  constructor(code: number, message: string, details?: any) {
    super(message);
    this.name = 'CozeApiError';
    this.code = code;
    this.details = details;

    // 保持原型链
    Object.setPrototypeOf(this, CozeApiError.prototype);
  }

  /**
   * 判断是否为特定错误类型
   */
  isErrorCode(errorCode: CozeErrorCode): boolean {
    return this.code === errorCode;
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case CozeErrorCode.UNAUTHORIZED:
        return 'API 密钥无效或已过期，请检查配置';
      case CozeErrorCode.FORBIDDEN:
        return '没有权限访问该资源';
      case CozeErrorCode.NOT_FOUND:
        return '请求的资源不存在';
      case CozeErrorCode.RATE_LIMITED:
        return '请求频率过高，请稍后再试';
      case CozeErrorCode.WORKFLOW_NOT_FOUND:
        return '工作流不存在';
      case CozeErrorCode.WORKFLOW_INACTIVE:
        return '工作流未激活，无法执行';
      case CozeErrorCode.FILE_NOT_FOUND:
        return '文件不存在';
      case CozeErrorCode.FILE_UPLOAD_FAILED:
        return '文件上传失败，请检查文件格式和大小';
      case CozeErrorCode.FILE_SIZE_EXCEEDED:
        return '文件大小超出限制';
      case CozeErrorCode.FILE_TYPE_NOT_SUPPORTED:
        return '不支持的文件类型';
      case CozeErrorCode.WORKSPACE_NOT_FOUND:
        return '工作空间不存在';
      case CozeErrorCode.WORKSPACE_ACCESS_DENIED:
        return '没有权限访问该工作空间';
      default:
        return this.message || '操作失败';
    }
  }
}

// 默认 Coze API 客户端单例
let defaultCozeClient: CozeApiClient | null = null;

/**
 * 获取默认 Coze API 客户端
 */
export function getDefaultCozeClient(apiKey: string, baseUrl?: string): CozeApiClient {
  if (!defaultCozeClient || defaultCozeClient.getConfig().baseUrl !== (baseUrl || DEFAULT_COZE_CONFIG.defaultBaseUrl)) {
    defaultCozeClient = new CozeApiClient(apiKey, baseUrl);
  }
  return defaultCozeClient;
}

// 便捷的 API 调用封装
export const cozeApi = {
  /**
   * 创建 API 客户端
   */
  createClient: (apiKey: string, baseUrl?: string) => new CozeApiClient(apiKey, baseUrl),

  /**
   * 获取默认客户端
   */
  getDefaultClient: getDefaultCozeClient,

  /**
   * 测试 API 密钥
   */
  testApiKey: async (apiKey: string, baseUrl?: string): Promise<boolean> => {
    const client = new CozeApiClient(apiKey, baseUrl);
    return await client.testConnection();
  },

  /**
   * 获取工作空间（使用默认客户端）
   */
  getWorkspaces: async (apiKey: string, baseUrl?: string): Promise<CozeWorkspace[]> => {
    const client = getDefaultCozeClient(apiKey, baseUrl);
    return await client.getWorkspaces();
  },

  /**
   * 获取工作流列表（使用默认客户端）
   */
  getWorkflows: async (apiKey: string, workspaceId: string, baseUrl?: string): Promise<CozeWorkflow[]> => {
    const client = getDefaultCozeClient(apiKey, baseUrl);
    return await client.getWorkflows(workspaceId);
  },

  /**
   * 执行工作流（使用默认客户端）
   */
  executeWorkflow: async (
    apiKey: string,
    workspaceId: string,
    workflowId: string,
    parameters?: Record<string, any>,
    baseUrl?: string
  ): Promise<ExecuteWorkflowResponse> => {
    const client = getDefaultCozeClient(apiKey, baseUrl);
    return await client.executeWorkflow(workspaceId, {
      workflow_id: workflowId,
      parameters,
      stream: false,
    });
  },

  /**
   * 上传文件（使用默认客户端）
   */
  uploadFile: async (
    apiKey: string,
    workspaceId: string,
    file: File,
    baseUrl?: string
  ): Promise<CozeFile> => {
    const client = getDefaultCozeClient(apiKey, baseUrl);
    return await client.uploadFile(workspaceId, file);
  },
};