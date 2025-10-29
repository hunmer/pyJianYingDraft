/**
 * Coze API 客户端
 * 使用官方 @coze/api SDK
 * 参考：https://www.coze.cn/open/docs/developer_guides
 */

// 重新导出新的 JS SDK 客户端
export {
  CozeJsClient as CozeApiClient,
  CozeApiError,
  getDefaultCozeClient,
  cozeJsApi as cozeApi,
} from './coze-js-client';

// 导入类型定义
export type {
  CozeAccount,
  CozeWorkspace,
  CozeWorkflow,
  WorkflowExecution,
  CreateWorkspaceRequest,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  CozeApiResponse,
} from '@/types/coze';

export {
  CozeErrorCode,
  DEFAULT_COZE_CONFIG,
} from '@/types/coze';

// 文件已重新导出到新的 JS SDK 客户端