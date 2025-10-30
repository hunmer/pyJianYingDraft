// Coze Zone 相关类型定义

export interface CozeAccount {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CozeWorkspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  created_time: string;
  updated_time: string;
}


// Coze API 返回的工作流详细信息结构
export interface CozeWorkflowDetail {
  workflow_name: string;
  app_id: string;
  creator: {
    id: string;
    name: string;
  };
  updated_at: number; // Unix 时间戳
  workflow_id: string;
  description?: string;
  icon_url?: string;
  created_at: number; // Unix 时间戳
}

export interface CozeWorkflowInput {
  parameters: Record<string, {
    type: string;
    required?: boolean;
    description?: string;
    default_value?: any;
    items?: any; // 当类型为 array 时定义子类型
    properties?: Record<string, any>; // 当类型为 object 时定义属性
  }>;
}

export interface CozeWorkflowOutput {
  parameters?: Record<string, {
    type: string;
  }>;
  terminate_plan?: 'return_variables' | 'use_answer_content';
  content?: string; // 当 terminate_plan 为 use_answer_content 时
}

export interface CozeWorkflowInfo {
  workflow_detail: CozeWorkflowDetail;
  input?: CozeWorkflowInput;
  output?: CozeWorkflowOutput;
}

export interface CozeWorkflowApiResponse {
  data: CozeWorkflowInfo;
  code: number;
  msg: string;
  detail: {
    logid: string;
  };
}

// 兼容性接口 - 内部使用的格式
export interface CozeWorkflow {
  id: string;
  name: string;
  description?: string;
  created_time: string;
  updated_time: string;
  version: number;
  input_schema?: any;
  output_schema?: any;
  status: 'active' | 'inactive' | 'draft';
  workflow_definition?: any;
  publish_status?: string;

  // 详细信息字段（从API获取）
  icon_url?: string;
  app_id?: string;
  creator_id?: string;
  creator_name?: string;
  category?: string;
  tags?: string[];
  template_id?: string;
  is_template?: boolean;
  use_count?: number;
  like_count?: number;
  publish_time?: string;
  last_used_time?: string;
  node_count?: number;
  connection_count?: number;
  workflow_config?: {
    timeout?: number;
    max_retry_times?: number;
    variables?: Record<string, any>;
  };
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  input_data: any;
  output_data?: any;
  error_message?: string;
  created_time: string;
  completed_time?: string;
  duration?: number;
}

export interface CozeZoneTabData {
  id: string;
  label: string;
  type: 'coze_zone';
  loading: boolean;
  error: string | null;

  // Coze Zone 特有字段
  accountId: string;
  workspaceId: string;

  // 数据
  accounts: CozeAccount[];
  workspaces: CozeWorkspace[];
  workflows: CozeWorkflow[];
  executions: WorkflowExecution[];
  selectedWorkflow?: CozeWorkflow;
  executionHistory: WorkflowExecution[];

  // 状态
  refreshing: boolean;
  executing: boolean;
}

// Coze API 请求和响应类型
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  icon?: string;
}


export interface ExecuteWorkflowRequest {
  workflow_id: string;
  parameters?: Record<string, any>;
  stream?: boolean;
  conversation_id?: string;
  bot_id?: string;
  user_id?: string;
}

export interface ExecuteWorkflowResponse {
  conversation_id: string;
  status: string;
  data: {
    id: string;
    workflow_id: string;
    status: string;
    input_data: any;
    output_data?: any;
    created_time: string;
  };
}

export interface CozeApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
}

// Coze 错误码
export enum CozeErrorCode {
  // 通用错误
  SUCCESS = 0,
  INVALID_REQUEST = 4000,
  UNAUTHORIZED = 4010,
  FORBIDDEN = 4030,
  NOT_FOUND = 4040,
  RATE_LIMITED = 4290,
  INTERNAL_ERROR = 5000,

  // 工作流错误
  WORKFLOW_NOT_FOUND = 14001,
  WORKFLOW_INACTIVE = 14002,
  WORKFLOW_EXECUTION_FAILED = 14003,

  
  // 工作空间错误
  WORKSPACE_NOT_FOUND = 16001,
  WORKSPACE_ACCESS_DENIED = 16002,
}

// 工作流执行状态枚举
export enum WorkflowExecutionStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

// Coze插件数据类型
export interface CozePluginData {
  type: 'audio' | 'image' | 'video' | 'text';
  data: {
    url: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
    timestamp: string;
  };
  clientId: string;
}

// 工作流监控数据
export interface WorkflowMonitorData {
  id: string;
  clientId: string;
  workflowId?: string;
  workflowName?: string;
  data: CozePluginData;
  receivedAt: string;
  isRead: boolean;
}

// 工作流监控状态
export interface WorkflowMonitorState {
  // 监控的工作流
  monitoredWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    clientId: string;
    isActive: boolean;
    startedAt: string;
    lastDataReceived?: string;
    dataCount: number;
  }>;

  // 订阅的客户端ID列表
  subscribedClientIds: string[];

  // 接收到的数据
  monitorData: WorkflowMonitorData[];

  // 状态
  isMonitoring: boolean;
  selectedWorkflowId?: string;

  // 统计信息
  totalDataReceived: number;
  unreadDataCount: number;
}

// 工作流流式响应事件类型
export interface WorkflowStreamEvent {
  event: 'workflow_started' | 'node_started' | 'node_finished' | 'workflow_finished' | 'error' | 'message' | 'data';
  data: any;
  conversation_id?: string;
  workflow_id?: string;
  node_id?: string;
  timestamp: string;
}

// 工作流流式执行状态
export interface WorkflowStreamState {
  isStreaming: boolean;
  events: WorkflowStreamEvent[];
  currentStep?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  output?: any;
  error?: string;
}

// WebSocket 订阅请求
export interface CozeSubscribeRequest {
  clientId: string;
  workflowId?: string;
}

// WebSocket 订阅响应
export interface CozeSubscribeResponse {
  success: boolean;
  clientId: string;
  message: string;
  subscribedAt: string;
}

// Coze数据发送请求
export interface CozeSendDataRequest {
  api_base: string;
  clientId: string;
  data: any;
}

// Coze Zone 配置
export interface CozeZoneConfig {
  defaultBaseUrl: string;
  maxRetries: number;
  timeout: number;
  pollingInterval: number; // 执行状态轮询间隔（毫秒）
}

// 默认配置
export const DEFAULT_COZE_CONFIG: CozeZoneConfig = {
  defaultBaseUrl: 'https://api.coze.cn',
  maxRetries: 3,
  timeout: 30000,
  pollingInterval: 2000,
};