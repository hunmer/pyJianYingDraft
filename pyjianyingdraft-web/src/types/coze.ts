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
  status: 'active' | 'inactive';
  created_time: string;
  updated_time: string;
}

export interface CozeFile {
  id: string;
  name: string;
  size: number;
  type: string;
  upload_time: string;
  url?: string;
  category?: string;
  description?: string;
}

export interface CozeWorkflow {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_time: string;
  updated_time: string;
  version: number;
  input_schema?: any;
  output_schema?: any;
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
  activeSubTab: 'workflow' | 'files';

  // 数据
  accounts: CozeAccount[];
  workspaces: CozeWorkspace[];
  workflows: CozeWorkflow[];
  files: CozeFile[];
  executions: WorkflowExecution[];
  selectedWorkflow?: CozeWorkflow;
  executionHistory: WorkflowExecution[];

  // 状态
  refreshing: boolean;
  executing: boolean;
  uploading: boolean;
}

// Coze API 请求和响应类型
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  icon?: string;
}

export interface UploadFileResponse {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  upload_time: string;
}

export interface ExecuteWorkflowRequest {
  workflow_id: string;
  parameters?: Record<string, any>;
  stream?: boolean;
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

  // 文件错误
  FILE_NOT_FOUND = 15001,
  FILE_UPLOAD_FAILED = 15002,
  FILE_SIZE_EXCEEDED = 15003,
  FILE_TYPE_NOT_SUPPORTED = 15004,

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

// 文件上传配置
export interface FileUploadConfig {
  maxFileSize: number; // 字节
  allowedTypes: string[];
  multiple: boolean;
}

// Coze Zone 配置
export interface CozeZoneConfig {
  defaultBaseUrl: string;
  maxRetries: number;
  timeout: number;
  pollingInterval: number; // 执行状态轮询间隔（毫秒）
  fileUpload: FileUploadConfig;
}

// 默认配置
export const DEFAULT_COZE_CONFIG: CozeZoneConfig = {
  defaultBaseUrl: 'https://api.coze.cn',
  maxRetries: 3,
  timeout: 30000,
  pollingInterval: 2000,
  fileUpload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/json',
      'text/csv', 'application/vnd.ms-excel'
    ],
    multiple: true,
  },
};