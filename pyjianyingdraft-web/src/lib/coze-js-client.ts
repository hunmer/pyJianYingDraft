/**
 * Coze JS SDK 客户端
 * 使用官方 @coze/api 替代原有的自定义 API 客户端
 */

import { CozeAPI, COZE_CN_BASE_URL } from '@coze/api';

import {
  CozeAccount,
  CozeWorkspace,
  CozeWorkflow,
  WorkflowExecution,
  CreateWorkspaceRequest,
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
        id: String(workspace.id),
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
  async getWorkflows(workspaceId: string, pageNum = 1, pageSize = 20): Promise<CozeWorkflow[]> {
    try {
      // 使用官方 REST API 获取工作流列表，因为 @coze/api SDK 没有提供 list 方法
      const baseUrl = this.client['baseURL'] || COZE_CN_BASE_URL;
      const token = this.client['token'];

      const url = new URL(`${baseUrl}/v1/workflows`);
      url.searchParams.append('workspace_id', workspaceId);
      url.searchParams.append('page_num', pageNum.toString());
      url.searchParams.append('page_size', pageSize.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // 根据官方文档，成功时 code 为 0，数据在 data.items 字段中
      if (result.code !== 0) {
        throw new Error(result.msg || '获取工作流列表失败');
      }

      const workflowsData = result.data.items || [];
      return workflowsData.map((workflow: any) => ({
        id: String(workflow.workflow_id || workflow.id),
        name: workflow.workflow_name || workflow.name,
        description: workflow.description || '',
        status: workflow.status === 'active' ? 'active' as const : 'inactive' as const,
        created_time: workflow.created_at || workflow.created_time,
        updated_time: workflow.updated_at || workflow.updated_time,
        version: workflow.version || '',
        input_schema: workflow.input_schema || null,
        output_schema: workflow.output_schema || null,
        icon_url: workflow.icon_url || '',
      })) || [];
    } catch (error) {
      console.error('获取工作流列表失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 获取工作流基本信息
   * 注意：@coze/api SDK 没有提供获取单个工作流信息的接口，暂时返回空对象
   */
  async getWorkflowInfo(workspaceId: string, workflowId: string): Promise<CozeWorkflow> {
    try {
      // @coze/api SDK 没有提供获取单个工作流信息的接口
      // 可以通过 getWorkflows 获取列表后查找对应的工作流
      const workflows = await this.getWorkflows(workspaceId);
      const workflow = workflows.find(w => w.id === workflowId);

      if (!workflow) {
        throw new Error('工作流不存在');
      }

      return workflow;
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
        workflow_id: request.workflow_id,
        parameters: request.parameters,
        is_async: request.stream || false,
      });

      // 根据API文档，响应数据在data字段中，且是字符串形式的JSON
      let executionData;
      if (typeof response.data === 'string') {
        executionData = JSON.parse(response.data);
      } else {
        executionData = response.data;
      }

      if (!executionData) {
        throw new Error('工作流执行失败');
      }

      return {
        conversation_id: String(executionData.execute_id || executionData.conversation_id),
        status: executionData.execute_status === 'Success' ? 'success' as const : 'failed' as const,
        data: {
          id: String(executionData.execute_id),
          workflow_id: String(request.workflow_id),
          status: executionData.execute_status === 'Success' ? 'success' as const : 'failed' as const,
          input_data: request.parameters || {},
          output_data: executionData.output ? JSON.parse(executionData.output) : {},
          created_time: executionData.create_time,
        },
      };
    } catch (error) {
      console.error('执行工作流失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 查询工作流异步执行结果
   * 注意：需要workflowId参数，@coze/api SDK的history方法需要此参数
   */
  async getWorkflowExecutionStatus(
    workspaceId: string,
    executionId: string,
    workflowId?: string
  ): Promise<WorkflowExecution> {
    try {
      if (!workflowId) {
        throw new Error('查询执行状态需要提供workflowId参数');
      }

      // 使用 @coze/api 的工作流历史查询 API
      const historyList = await this.client.workflows.runs.history(workflowId, executionId);

      if (!historyList || historyList.length === 0) {
        throw new Error('执行记录不存在');
      }

      const history = historyList[0]; // 取最新的记录
      return {
        id: String(history.execute_id),
        workflow_id: String(workflowId),
        workflow_name: '', // API没有返回workflow_name
        status: history.execute_status.toLowerCase() as 'running' | 'success' | 'failed' | 'cancelled',
        input_data: {}, // API没有返回input_data
        output_data: history.output ? JSON.parse(history.output) : {},
        error_message: history.error_message,
        created_time: history.create_time,
        completed_time: history.update_time,
        duration: history.update_time - history.create_time,
      };
    } catch (error) {
      console.error('查询工作流执行状态失败:', error);
      throw this.parseError(error);
    }
  }

  /**
   * 获取工作流执行历史
   * 注意：@coze/api SDK没有提供获取工作流历史列表的接口，暂时返回空数组
   */
  async getWorkflowExecutionHistory(
    workspaceId: string,
    workflowId?: string,
    pageSize = 20,
    currentPage = 1
  ): Promise<WorkflowExecution[]> {
    try {
      // @coze/api SDK 的 runs.list 方法不存在
      // 只有 history 方法可以查询单次执行的结果
      // 暂时返回空数组，建议用户使用 getWorkflowExecutionStatus 查询特定执行
      console.warn('获取工作流执行历史功能暂时不可用，@coze/api SDK 未提供相应接口');
      return [];
    } catch (error) {
      console.error('获取工作流执行历史失败:', error);
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

  };