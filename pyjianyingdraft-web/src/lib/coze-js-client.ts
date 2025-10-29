/**
 * Coze JS SDK 客户端
 * 使用官方 @coze/api 替代原有的自定义 API 客户端
 */

import { CozeAPI, COZE_CN_BASE_URL } from '@coze/api';

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

export class CozeJsClient {
  private client: CozeAPI;
  private config = DEFAULT_COZE_CONFIG;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new CozeAPI({
      token: apiKey,
      baseURL: baseUrl || COZE_CN_BASE_URL,
    });
  }

  // ==================== 工作空间管理 ====================

  /**
   * 获取工作空间列表
   */
  async getWorkspaces(): Promise<CozeWorkspace[]> {
    try {
      // 使用 @coze/api 的工作空间 API
      const response = await this.client.workspaces.list();
      return response.workspaces?.map((workspace: any) => ({
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        icon: workspace.icon_url || workspace.icon,
        status: workspace.status === 'active' ? 'active' as const : 'inactive' as const,
        created_time: workspace.created_time,
        updated_time: workspace.updated_time,
      })) || [];
    } catch (error) {
      console.error('获取工作空间列表失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 创建工作空间
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<CozeWorkspace> {
    // 注意：@coze/api 可能不直接支持创建工作空间，这里提供接口兼容性
    throw new Error('创建工作流功能在当前 SDK 版本中暂不支持');
  }

  // ==================== 工作流管理 ====================

  /**
   * 获取工作流列表
   */
  async getWorkflows(workspaceId: string): Promise<CozeWorkflow[]> {
    try {
      // 使用 @coze/api 的工作流 API
      const response = await this.client.workflows.list({
        space_id: workspaceId,
      });
      // 根据实际的 @coze/api 响应结构访问数据
      const workflowsData = response.data?.data || response.data || [];
      return workflowsData.map((workflow: any) => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status === 'active' ? 'active' as const : 'inactive' as const,
        created_time: workflow.created_time,
        updated_time: workflow.updated_time,
        version: workflow.version,
        input_schema: workflow.input_schema,
        output_schema: workflow.output_schema,
      })) || [];
    } catch (error) {
      console.error('获取工作流列表失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 获取工作流基本信息
   */
  async getWorkflowInfo(workspaceId: string, workflowId: string): Promise<CozeWorkflow> {
    try {
      // 使用 @coze/api 的工作流信息 API
      const response = await this.client.workflows.retrieve({
        space_id: workspaceId,
        workflow_id: workflowId,
      });
      const workflow = response.data?.data || response.data;
      if (!workflow) {
        throw new Error('工作流不存在');
      }
      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status === 'active' ? 'active' as const : 'inactive' as const,
        created_time: workflow.created_time,
        updated_time: workflow.updated_time,
        version: workflow.version,
        input_schema: workflow.input_schema,
        output_schema: workflow.output_schema,
      };
    } catch (error) {
      console.error('获取工作流信息失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workspaceId: string,
    request: ExecuteWorkflowRequest
  ): Promise<ExecuteWorkflowResponse> {
    try {
      // 使用 @coze/api 的工作流执行 API
      const response = await this.client.workflows.runs.create({
        space_id: workspaceId,
        workflow_id: request.workflow_id,
        parameters: request.parameters,
        stream: request.stream || false,
      });

      const executionData = response.data?.data || response.data;
      if (!executionData) {
        throw new Error('工作流执行失败');
      }

      return {
        conversation_id: executionData.conversation_id,
        status: executionData.status,
        data: {
          id: executionData.id,
          workflow_id: executionData.workflow_id,
          status: executionData.status,
          input_data: executionData.input_data,
          output_data: executionData.output_data,
          created_time: executionData.created_time,
        },
      };
    } catch (error) {
      console.error('执行工作流失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 查询工作流异步执行结果
   */
  async getWorkflowExecutionStatus(
    workspaceId: string,
    executionId: string
  ): Promise<WorkflowExecution> {
    try {
      // 使用 @coze/api 的工作流历史查询 API
      const response = await this.client.workflows.runs.retrieve({
        conversation_id: executionId,
        space_id: workspaceId,
      });

      const history = response.data?.data || response.data;
      if (!history) {
        throw new Error('执行记录不存在');
      }
      return {
        id: history.id,
        workflow_id: history.workflow_id,
        workflow_name: history.workflow_name,
        status: history.status as 'running' | 'success' | 'failed' | 'cancelled',
        input_data: history.input_data,
        output_data: history.output_data,
        error_message: history.error_message,
        created_time: history.created_time,
        completed_time: history.completed_time,
        duration: history.duration,
      };
    } catch (error) {
      console.error('查询工作流执行状态失败:', error);
      throw this.parseError(error);
    }
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
    try {
      const params: any = {
        space_id: workspaceId,
        page_size: pageSize,
        current_page: currentPage,
      };

      if (workflowId) {
        params.workflow_id = workflowId;
      }

      // 使用 @coze/api 的工作流历史列表 API
      const response = await this.client.workflows.runs.list(params);
      const historyData = response.data?.data || response.data || [];
      return historyData.map((history: any) => ({
        id: history.id,
        workflow_id: history.workflow_id,
        workflow_name: history.workflow_name,
        status: history.status as 'running' | 'success' | 'failed' | 'cancelled',
        input_data: history.input_data,
        output_data: history.output_data,
        error_message: history.error_message,
        created_time: history.created_time,
        completed_time: history.completed_time,
        duration: history.duration,
      })) || [];
    } catch (error) {
      console.error('获取工作流执行历史失败:', error);
      throw this.parseError(error);
    }
  }

  // ==================== 文件管理 ====================

  /**
   * 上传文件
   */
  async uploadFile(workspaceId: string, file: File): Promise<CozeFile> {
    try {
      // 使用 @coze/api 的文件上传 API
      const response = await this.client.files.upload({
        file: file,
      });

      const uploadData = response.data?.data || response.data;
      if (!uploadData) {
        throw new Error('文件上传失败');
      }
      return {
        id: uploadData.id,
        name: uploadData.name || file.name,
        size: uploadData.size || file.size,
        type: uploadData.type || file.type,
        upload_time: uploadData.upload_time || new Date().toISOString(),
        url: uploadData.url,
      };
    } catch (error) {
      console.error('上传文件失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 获取文件列表
   */
  async getFiles(workspaceId: string, pageSize = 50, currentPage = 1): Promise<CozeFile[]> {
    try {
      // 使用 @coze/api 的文件列表 API - 暂时返回空数组
      // TODO: 需要查看 @coze/api 文件 API 的正确使用方式
      console.warn('文件列表功能暂时不可用，@coze/api 文件接口需要进一步调研');
      return [];
    } catch (error) {
      console.error('获取文件列表失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 获取文件详情
   */
  async getFileInfo(workspaceId: string, fileId: string): Promise<CozeFile> {
    try {
      // 使用 @coze/api 的文件详情 API
      const response = await this.client.files.retrieve(fileId);

      const file = response.data?.data || response.data;
      if (!file) {
        throw new Error('文件不存在');
      }
      return {
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        upload_time: file.upload_time,
        url: file.url,
        category: file.category,
        description: file.description,
      };
    } catch (error) {
      console.error('获取文件详情失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(workspaceId: string, fileId: string): Promise<void> {
    try {
      // 使用 @coze/api 的文件删除 API
      // TODO: 需要查看 @coze/api 文件删除 API 的正确使用方式
      console.warn('文件删除功能暂时不可用，@coze/api 文件接口需要进一步调研');
      throw new Error('文件删除功能暂时不可用');
    } catch (error) {
      console.error('删除文件失败:', error);
      throw this.parseError(error);
    }
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
      console.error('Coze JS SDK 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      baseUrl: this.client['baseURL'],
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    };
  }

  /**
   * 解析错误信息
   */
  private parseError(error: any): CozeApiError {
    // 尝试从 SDK 错误中提取信息
    if (error.code) {
      return new CozeApiError(
        error.code,
        error.message || '请求失败',
        error.details
      );
    }

    if (error.response?.data) {
      const data = error.response.data;
      return new CozeApiError(
        data.code || error.response.status,
        data.message || `HTTP ${error.response.status}`,
        data.error
      );
    }

    return new CozeApiError(
      CozeErrorCode.INTERNAL_ERROR,
      error.message || '网络请求失败'
    );
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

// 默认 Coze JS SDK 客户端单例
let defaultCozeClient: CozeJsClient | null = null;

/**
 * 获取默认 Coze JS SDK 客户端
 */
export function getDefaultCozeClient(apiKey: string, baseUrl?: string): CozeJsClient {
  if (!defaultCozeClient || defaultCozeClient.getConfig().baseUrl !== (baseUrl || COZE_CN_BASE_URL)) {
    defaultCozeClient = new CozeJsClient(apiKey, baseUrl);
  }
  return defaultCozeClient;
}

// 便捷的 API 调用封装
export const cozeJsApi = {
  /**
   * 创建 API 客户端
   */
  createClient: (apiKey: string, baseUrl?: string) => new CozeJsClient(apiKey, baseUrl),

  /**
   * 获取默认客户端
   */
  getDefaultClient: getDefaultCozeClient,

  /**
   * 测试 API 密钥
   */
  testApiKey: async (apiKey: string, baseUrl?: string): Promise<boolean> => {
    const client = new CozeJsClient(apiKey, baseUrl);
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