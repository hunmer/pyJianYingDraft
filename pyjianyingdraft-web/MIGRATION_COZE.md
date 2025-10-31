# Coze API 迁移指南

## 📋 概述

Coze API 调用已从前端迁移到后端，以提高安全性和架构清晰度。

## 🔄 迁移原因

1. **安全性**: API Token 不应暴露在前端代码中
2. **统一管理**: 后端统一处理 Coze API 调用和任务状态
3. **架构优化**: 前端只负责 UI，业务逻辑在后端处理

## ✅ 已完成的迁移

### 后端改动

- ✅ 安装 `cozepy>=0.20.0` SDK
- ✅ 创建 Coze 配置管理模块 (`app/services/coze_config.py`)
- ✅ 创建 Coze API 客户端封装 (`app/services/coze_client.py`)
- ✅ 创建工作流执行服务 (`app/services/coze_workflow_service.py`)
- ✅ 重构 Coze 路由 (`app/routers/coze.py`)，集成真实 API 调用

### 前端改动

- ✅ 更新 API 客户端 (`lib/api.ts`)，添加后端 Coze 接口
- ✅ 标记废弃 `lib/coze-js-client.ts`
- ✅ 标记废弃 `lib/coze-api.ts`

## 📦 前端依赖清理（可选）

### 可以移除的依赖

如果确认不再需要前端直接调用 Coze API，可以移除以下依赖：

```bash
npm uninstall @coze/api
```

**注意**: 移除前请确保：
1. 所有组件已迁移到使用后端 API (`api.coze.*`)
2. 没有任何地方引用 `coze-js-client.ts` 或 `coze-api.ts`
3. 运行 `npm run build` 确认没有编译错误

### 可以删除的文件（可选）

如果确认不再需要，可以删除以下文件：

- `src/lib/coze-js-client.ts`
- `src/lib/coze-api.ts`
- `src/services/cozeWorkflowService.ts`（如果存在）

## 🔧 使用新 API

### 旧方式（已废弃）

```typescript
import { CozeJsClient } from '@/lib/coze-js-client';

const client = new CozeJsClient(apiKey);
const result = await client.executeWorkflow(workflowId, parameters);
```

### 新方式（推荐）

```typescript
import api from '@/lib/api';

// 执行工作流任务
const result = await api.coze.executeTask({
  workflowId: 'workflow_123',
  inputParameters: { key: 'value' },
  saveAsTask: true,
  taskName: '我的任务',
  taskDescription: '任务描述'
});

// 获取任务列表
const tasks = await api.coze.getTasks({
  workflowId: 'workflow_123',
  status: 'completed'
});

// 获取工作空间列表
const workspaces = await api.coze.getWorkspaces();

// 获取工作流详情
const workflow = await api.coze.getWorkflow('workflow_123');
```

## 🎯 关键变化

### 1. 任务状态自动管理

**之前**: 前端需要手动更新任务状态
```typescript
await api.coze.executeTask(...);
await api.coze.updateTask(taskId, { status: 'completed' });
```

**现在**: 后端自动管理任务状态
```typescript
const result = await api.coze.executeTask({
  workflowId: '...',
  inputParameters: {...},
  saveAsTask: true
});
// 任务状态已自动更新为 EXECUTING → RUNNING → COMPLETED/FAILED
```

### 2. 新增的后端 API 端点

- `GET /api/coze/workspaces` - 获取工作空间列表
- `GET /api/coze/workflows/{workflow_id}` - 获取工作流详情
- `GET /api/coze/workflows/{workflow_id}/history` - 获取执行历史
- `POST /api/coze/tasks/execute` - 执行任务（真实调用 Coze API）

### 3. 配置管理

API Token 现在在后端配置：

```json
// pyJianYingDraftServer/config.json
{
  "COZE_API": {
    "api_token": "your_personal_access_token",
    "base_url": "https://api.coze.cn",
    "timeout": 600,
    "max_retries": 3
  }
}
```

或使用环境变量：
```bash
export COZE_API_TOKEN="your_personal_access_token"
export COZE_API_BASE="https://api.coze.cn"
```

## ⚠️ 注意事项

1. **API Token 安全**: 不要在前端代码中硬编码 API Token
2. **错误处理**: 后端统一处理 Coze API 错误，前端接收标准错误响应
3. **任务状态**: 不再需要前端手动管理任务状态
4. **向后兼容**: 旧的前端 SDK 文件被标记为废弃但未删除，可根据需要保留

## 📚 相关文档

- 后端配置: `pyJianYingDraftServer/CLAUDE.md`
- 前端 API: `pyjianyingdraft-web/CLAUDE.md`
- Coze SDK 文档: https://github.com/coze-dev/coze-py
