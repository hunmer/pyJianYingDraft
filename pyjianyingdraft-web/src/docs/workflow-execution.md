# 工作流执行功能增强

本文档介绍了新增强的工作流执行功能，包括表单/JSON模式切换、CodeMirror编辑器集成和流式执行支持。

## 新增功能概述

### 1. 工作流参数编辑器 (WorkflowParameterEditor)

- **表单模式**: 根据JSON Schema自动生成表单字段
- **JSON模式**: 使用CodeMirror提供语法高亮和验证
- **智能切换**: 根据参数复杂度自动推荐合适的编辑模式
- **实时验证**: JSON格式实时验证和错误提示

### 2. 流式工作流执行

- **实时事件**: 显示工作流执行的详细过程
- **事件日志**: 带时间戳和图标的执行日志
- **状态跟踪**: 实时显示当前执行步骤和状态
- **取消支持**: 支持中途取消执行

### 3. 增强的执行界面

- **双栏布局**: 输入参数和输出结果并排显示
- **进度指示**: 实时显示执行进度和状态
- **错误处理**: 详细的错误信息显示和处理

## 核心组件

### WorkflowParameterEditor

```typescript
interface WorkflowParameterEditorProps {
  title: string;                    // 编辑器标题
  schema?: ParameterSchema;         // JSON Schema定义
  value: any;                       // 当前值
  onChange: (value: any) => void;   // 值变更回调
  disabled?: boolean;               // 是否禁用
  errorMessage?: string;            // 错误信息
}
```

**支持的参数类型:**
- `string`: 文本输入、下拉选择、多行文本
- `number`: 数字输入，支持最小值/最大值限制
- `boolean`: 开关切换
- `array/object`: 提示使用JSON模式编辑
- `enum`: 下拉选择框

### WorkflowExecutionDialog

```typescript
interface WorkflowExecutionDialogProps {
  open: boolean;                                                                // 是否打开
  workflow: CozeWorkflow | null;                                               // 工作流数据
  onClose: () => void;                                                          // 关闭回调
  onExecute: (workflowId: string, parameters: any, stream: boolean) => Promise<void>; // 执行回调
  onCancel: () => void;                                                         // 取消回调
}
```

### CozeWorkflowService

工作流执行的核心服务类：

```typescript
// 流式执行工作流
static async executeWorkflowStream(
  workflowId: string,
  parameters: Record<string, any>,
  options: CozeWorkflowExecuteOptions
): Promise<void>

// 获取工作流详细信息
static async getWorkflowInfo(
  workflowId: string,
  apiBase: string,
  apiKey: string
): Promise<any>

// 取消工作流执行
static async cancelWorkflowExecution(
  conversationId: string,
  apiBase: string,
  apiKey: string
): Promise<void>
```

### useWorkflowExecution Hook

简化工作流执行的React Hook：

```typescript
const workflowExecution = useWorkflowExecution({
  apiBase: 'https://api.coze.cn',
  apiKey: 'your-api-key',
  botId?: 'your-bot-id',
  userId?: 'user-id',
});

// 执行工作流
await workflowExecution.executeWorkflow(workflow, parameters, true);

// 取消执行
workflowExecution.cancelExecution();

// 重置状态
workflowExecution.resetState();
```

## 使用示例

### 基本用法

```typescript
import WorkflowExecutionDialog from '@/components/WorkflowExecutionDialog';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';

const MyComponent = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const workflowExecution = useWorkflowExecution({
    apiBase: 'https://api.coze.cn',
    apiKey: 'your-api-key-here',
  });

  const handleExecute = async (workflowId: string, parameters: any, stream: boolean) => {
    await workflowExecution.executeWorkflow(selectedWorkflow, parameters, stream);
  };

  return (
    <WorkflowExecutionDialog
      open={dialogOpen}
      workflow={selectedWorkflow}
      onClose={() => setDialogOpen(false)}
      onExecute={handleExecute}
      onCancel={() => workflowExecution.cancelExecution()}
    />
  );
};
```

### 自定义参数编辑器

```typescript
import WorkflowParameterEditor from '@/components/WorkflowParameterEditor';

const MyForm = () => {
  const [parameters, setParameters] = useState({});

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', title: '姓名' },
      age: { type: 'number', title: '年龄', minimum: 0, maximum: 150 },
      active: { type: 'boolean', title: '是否激活' },
    },
    required: ['name'],
  };

  return (
    <WorkflowParameterEditor
      title="用户信息"
      schema={schema}
      value={parameters}
      onChange={setParameters}
    />
  );
};
```

## JSON Schema 支持

### 基本类型

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "title": "标题",
      "description": "请输入标题",
      "default": "默认标题"
    },
    "count": {
      "type": "number",
      "title": "数量",
      "minimum": 1,
      "maximum": 100,
      "default": 10
    },
    "enabled": {
      "type": "boolean",
      "title": "启用状态",
      "default": true
    },
    "category": {
      "type": "string",
      "title": "分类",
      "enum": ["工作", "生活", "学习"],
      "default": "工作"
    }
  },
  "required": ["title"]
}
```

### 复杂类型

```json
{
  "type": "object",
  "properties": {
    "config": {
      "type": "object",
      "title": "配置信息",
      "description": "复杂配置对象，建议使用JSON模式编辑"
    },
    "tags": {
      "type": "array",
      "title": "标签列表",
      "items": { "type": "string" },
      "description": "标签数组，建议使用JSON模式编辑"
    }
  }
}
```

## 流式事件类型

### 支持的事件

- `workflow_started`: 工作流开始执行
- `node_started`: 节点开始执行
- `node_finished`: 节点执行完成
- `workflow_finished`: 工作流执行完成
- `error`: 执行出错
- `message`: 消息事件
- `data`: 数据事件

### 事件格式

```typescript
interface WorkflowStreamEvent {
  event: 'workflow_started' | 'node_started' | 'node_finished' | 'workflow_finished' | 'error' | 'message' | 'data';
  data: any;                           // 事件数据
  conversation_id?: string;            // 会话ID
  workflow_id?: string;                // 工作流ID
  node_id?: string;                    // 节点ID
  timestamp: string;                   // 时间戳
}
```

## 配置选项

### CozeWorkflowExecuteOptions

```typescript
interface CozeWorkflowExecuteOptions {
  apiBase: string;                     // API基础URL
  apiKey: string;                      // API密钥
  botId?: string;                      // Bot ID（可选）
  conversationId?: string;             // 会话ID（可选）
  userId?: string;                     // 用户ID（可选）
  stream?: boolean;                    // 是否启用流式执行
  onEvent?: (event: WorkflowStreamEvent) => void; // 事件回调
  signal?: AbortSignal;                // 取消信号
}
```

## 依赖项

确保安装了以下依赖：

```bash
npm install @uiw/react-codemirror @uiw/codemirror-theme-vscode
# 或使用 cnpm
cnpm install @uiw/react-codemirror @uiw/codemirror-theme-vscode
```

## 注意事项

1. **API密钥安全**: 请妥善保管Coze API密钥，不要在前端代码中暴露
2. **错误处理**: 始终包含适当的错误处理逻辑
3. **流式响应**: 流式执行需要服务器支持Server-Sent Events
4. **浏览器兼容**: CodeMirror和流式API需要现代浏览器支持
5. **网络环境**: 确保网络环境可以访问Coze API服务

## 故障排除

### 常见问题

1. **CodeMirror无法加载**: 检查依赖是否正确安装
2. **流式执行失败**: 检查API配置和网络连接
3. **参数验证错误**: 检查JSON Schema格式是否正确
4. **事件不显示**: 检查事件处理逻辑和数据格式

### 调试技巧

1. 打开浏览器开发者工具查看网络请求
2. 检查控制台错误信息
3. 验证API密钥和权限设置
4. 使用简单的工作流进行测试