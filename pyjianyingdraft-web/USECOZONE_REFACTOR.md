# useCoZone.ts 重构指南

## 需要移除的导入

```typescript
// ❌ 删除这些
import { CozeApiClient, CozeApiError, CozeErrorCode } from '@/lib/coze-api';
import { WorkflowEvent, WorkflowEventType, WorkflowEventInterrupt } from '@coze/api';

// ✅ 添加这个
import api from '@/lib/api';
```

## 需要移除的代码

### 1. clientRef (Line 129)
```typescript
// ❌ 删除
const clientRef = useRef<CozeApiClient | null>(null);
```

### 2. getClient() 方法
```typescript
// ❌ 删除或改为返回 null
getClient: () => CozeApiClient | null;
```

## 需要替换的方法

### 1. validateAccount (Line 242-250)

**原代码**:
```typescript
const validateAccount = useCallback(async (apiKey: string, baseUrl?: string): Promise<boolean> => {
  try {
    const client = new CozeApiClient(apiKey, baseUrl);
    return await client.testConnection();
  } catch (error) {
    console.error('账号验证失败:', error);
    return false;
  }
}, []);
```

**新代码**:
```typescript
const validateAccount = useCallback(async (apiKey: string, baseUrl?: string): Promise<boolean> => {
  try {
    // 账号验证功能暂时移除
    // 因为 API Token 现在在后端配置，前端无法验证
    // 可以考虑添加后端验证接口
    console.warn('账号验证功能已禁用：API Token 现在在后端配置');
    return true; // 暂时返回 true
  } catch (error) {
    console.error('账号验证失败:', error);
    return false;
  }
}, []);
```

### 2. loadWorkspaces (Line 254-285)

**原代码**:
```typescript
const client = new CozeApiClient(account.apiKey, account.baseUrl);
const workspaces = await client.getWorkspaces();
```

**新代码**:
```typescript
const response = await api.coze.getWorkspaces('default');
const workspaces = response.workspaces || [];
```

### 3. loadExecutionHistory (Line 316-331)

**原代码**:
```typescript
const history = await clientRef.current.getWorkflowExecutionHistory(
  state.currentWorkspace.id,
  workflowId,
  50,
  1
);
```

**新代码**:
```typescript
if (!workflowId) return;
const response = await api.coze.getWorkflowHistory(
  workflowId,
  'default',
  50,
  1
);
const history = response.histories || [];
```

### 4. pollExecutionStatus (Line 333-...)

**这个方法可能需要重新设计**，因为后端现在自动管理任务状态。考虑：
- 移除轮询逻辑
- 改为查询任务状态 `api.coze.getTask(taskId)`

### 5. loadWorkflows (Line 465-470)

**原代码**:
```typescript
const workflows = await clientRef.current.getWorkflows(workspaceId);
```

**新代码**:
```typescript
// 暂时返回空数组，或添加后端工作流列表接口
const workflows = [];
console.warn('工作流列表功能需要后端支持');
```

### 6. executeWorkflowStream (Line 610)

**原代码**:
```typescript
const response = await clientRef.current.executeWorkflowStream(
  workflowId,
  parameters,
  undefined,
  conversationId
);
```

**新代码**:
```typescript
const response = await api.coze.executeTask({
  workflowId,
  inputParameters: parameters,
  saveAsTask: true,
  taskName: `执行工作流 ${workflowId}`
});
```

## 删除 CozeApiClient 实例化

删除所有创建 `CozeApiClient` 实例的代码：

- Line 152: `clientRef.current = new CozeApiClient(...)`
- Line 180: `clientRef.current = new CozeApiClient(...)`
- Line 244: `const client = new CozeApiClient(...)`
- Line 269: `const client = new CozeApiClient(...)`

## 注意事项

1. **账号管理**: 前端账号管理功能现在主要用于 UI 展示，实际的 API Token 在后端配置
2. **工作流列表**: 可能需要添加后端接口 `GET /api/coze/workspaces/{id}/workflows`
3. **流式执行**: 如需流式执行，需要后端支持 WebSocket 或 SSE
4. **错误处理**: 使用统一的错误处理逻辑

## 测试清单

重构后需要测试：
- [ ] 工作空间列表加载
- [ ] 工作流执行
- [ ] 任务创建和查询
- [ ] 任务状态更新
- [ ] 执行历史查询
